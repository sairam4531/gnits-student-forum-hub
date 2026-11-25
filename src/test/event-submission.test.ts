import { eventSubmissionSchema } from "@/lib/event-validation";

describe("Event Submission Flow & Security Audit", () => {
  // -------------------------------------------------------------
  // 1. Service Role Key Validation & Project Verification
  // -------------------------------------------------------------
  describe("Supabase Service Role Key Validation", () => {
    it("rejects missing or empty service-role key", async () => {
      const { validateServiceRoleKey } = await import(
        "@/integrations/supabase/client.server"
      );
      const res = validateServiceRoleKey(undefined);
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("not configured");
    });

    it("rejects publishable key being passed as service-role key", async () => {
      const { validateServiceRoleKey } = await import(
        "@/integrations/supabase/client.server"
      );
      const publishable = "sb_publishable_ZHHX8iAzpgsynmvP16wbQw_nUEmRiHH";
      const res = validateServiceRoleKey(publishable, publishable);
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("public publishable key");
    });

    it("rejects keys starting with sb_publishable_", async () => {
      const { validateServiceRoleKey } = await import(
        "@/integrations/supabase/client.server"
      );
      const res = validateServiceRoleKey("sb_publishable_some_random_key");
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("sb_publishable_");
    });

    it("rejects JWT with anon role", async () => {
      const { validateServiceRoleKey } = await import(
        "@/integrations/supabase/client.server"
      );
      // JWT with payload {"role":"anon","ref":"test-project"}
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(JSON.stringify({ role: "anon", ref: "test-project" })).toString("base64url");
      const fakeJwt = `${header}.${payload}.fakesignature`;

      const res = validateServiceRoleKey(fakeJwt);
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("'anon' role");
    });

    it("accepts genuine service role secret key format (sb_secret_)", async () => {
      const { validateServiceRoleKey } = await import(
        "@/integrations/supabase/client.server"
      );
      const res = validateServiceRoleKey(
        "sb_secret_VALID_SERVICE_ROLE_SECRET_KEY_12345",
        "sb_publishable_DIFFERENT_KEY",
      );
      expect(res.valid).toBe(true);
    });

    it("accepts genuine JWT with service_role role", async () => {
      const { validateServiceRoleKey } = await import(
        "@/integrations/supabase/client.server"
      );
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({ role: "service_role", ref: "xwfwndjhwbswzxyjprvn" }),
      ).toString("base64url");
      const validJwt = `${header}.${payload}.fakesignature`;

      const res = validateServiceRoleKey(validJwt);
      expect(res.valid).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // 2. Event Input Validation
  // -------------------------------------------------------------
  describe("Event Input Validation (eventSubmissionSchema)", () => {
    const validSubId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const validEvent = {
      clubSlug: "technical-events",
      forumSlug: "iste",
      eventName: "Hands-on Examination Workshop",
      eventStart: "2026-11-20",
      eventEnd: "2026-11-21",
      resourcePersons: "Dr. K. Smitha, Professor",
      submitterName: "Sai Rohit",
      submitterEmail: "sairohit@gnits.ac.in",
      reportObjectPath: `submissions/${validSubId}/report.pdf`,
      reportFileName: "report.pdf",
      reportContentType: "application/pdf",
      photoObjectPaths: [`submissions/${validSubId}/0_photo.jpg`],
      photoFileNames: ["photo.jpg"],
    };

    it("accepts valid event proposal payload", () => {
      const result = eventSubmissionSchema.safeParse(validEvent);
      expect(result.success).toBe(true);
    });

    it("rejects event if eventStart is after eventEnd", () => {
      const invalidDates = {
        ...validEvent,
        eventStart: "2026-11-25",
        eventEnd: "2026-11-20",
      };
      const result = eventSubmissionSchema.safeParse(invalidDates);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("eventEnd"))).toBe(true);
      }
    });

    it("rejects unknown club or forum combinations", () => {
      const unknownForum = {
        ...validEvent,
        clubSlug: "technical-events",
        forumSlug: "non-existent-forum-xyz",
      };
      const result = eventSubmissionSchema.safeParse(unknownForum);
      expect(result.success).toBe(false);
    });

    it("rejects invalid submitter email", () => {
      const badEmail = {
        ...validEvent,
        submitterEmail: "not-an-email",
      };
      const result = eventSubmissionSchema.safeParse(badEmail);
      expect(result.success).toBe(false);
    });

    it("rejects mismatched photo paths and photo file names arrays", () => {
      const mismatchedPhotos = {
        ...validEvent,
        photoObjectPaths: [
          `submissions/${validSubId}/0_photo.jpg`,
          `submissions/${validSubId}/1_photo.jpg`,
        ],
        photoFileNames: ["only_one_name.jpg"],
      };
      const result = eventSubmissionSchema.safeParse(mismatchedPhotos);
      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 3. Runtime Environment Access Pattern
  // -------------------------------------------------------------
  describe("Cloudflare Worker Runtime Environment Access", () => {
    it("reads SUPABASE_SERVICE_ROLE_KEY from globalThis.__env__ (Cloudflare bindings)", async () => {
      const { getSupabaseServerConfig } = await import(
        "@/integrations/supabase/client.server"
      );
      type GlobalEnvHolder = { __env__?: Record<string, string | undefined> | undefined };
      const holder = globalThis as unknown as GlobalEnvHolder;
      const originalEnv = holder.__env__;
      try {
        holder.__env__ = {
          SUPABASE_URL: "https://cf-runtime-test.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "sb_secret_cf_runtime_secret_key",
          SUPABASE_PUBLISHABLE_KEY: "sb_publishable_public_key",
        };

        const config = getSupabaseServerConfig();
        expect(config.url).toBe("https://cf-runtime-test.supabase.co");
        expect(config.serviceRoleKey).toBe("sb_secret_cf_runtime_secret_key");
        expect(config.publishableKey).toBe("sb_publishable_public_key");
      } finally {
        if (originalEnv === undefined) {
          delete holder.__env__;
        } else {
          holder.__env__ = originalEnv;
        }
      }
    });
  });
});
