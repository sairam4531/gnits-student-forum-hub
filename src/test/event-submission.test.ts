import { eventSubmissionSchema, MAX_UPLOAD_BYTES } from "@/lib/event-validation";

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

  describe("Server-side private attachment uploads", () => {
    it("enforces the 20 MB attachment limit before decoding", async () => {
      const { decodeEventFileDataUrl } = await import("@/lib/events.server");
      expect(MAX_UPLOAD_BYTES).toBe(20 * 1024 * 1024);
      const oversizedPayload = `data:application/pdf;base64,${"A".repeat(
        Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 256,
      )}`;
      expect(() => decodeEventFileDataUrl(oversizedPayload, "application/pdf")).toThrow(
        /20 MB or smaller/i,
      );
    });
  });

  // -------------------------------------------------------------
  // 2. Event Input Validation
  // -------------------------------------------------------------
  describe("Event Input Validation (eventSubmissionSchema)", () => {
    const validSubId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const validEvent = {
      id: validSubId,
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

    it("rejects Student Forums payload missing resourcePersons or submitterName", () => {
      const missingFields = {
        ...validEvent,
        resourcePersons: "",
        submitterName: "",
      };
      const result = eventSubmissionSchema.safeParse(missingFields);
      expect(result.success).toBe(false);
    });

    it("accepts institutional events with AY without resourcePersons, submitterName, or submitterEmail", () => {
      const instEvent = {
        id: validSubId,
        clubSlug: "institutional-events",
        forumSlug: "annual-day--ay-2024-25",
        eventName: "Annual Day Celebration 2024-25",
        eventStart: "2025-03-10",
        eventEnd: "2025-03-10",
        reportObjectPath: `submissions/${validSubId}/report.pdf`,
        reportFileName: "report.pdf",
        reportContentType: "application/pdf",
        photoObjectPaths: [`submissions/${validSubId}/0_photo.jpg`],
        photoFileNames: ["photo.jpg"],
      };
      const result = eventSubmissionSchema.safeParse(instEvent);
      expect(result.success).toBe(true);
    });

    it("rejects attachments stored outside the event's own submission folder", () => {
      const wrongFolder = {
        ...validEvent,
        reportObjectPath: "submissions/b1b2c3d4-e5f6-7890-abcd-ef1234567890/report.pdf",
      };
      const result = eventSubmissionSchema.safeParse(wrongFolder);
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

  // -------------------------------------------------------------
  // 4. Cloudflare KV Event Submission & Admin File Access
  // -------------------------------------------------------------
  describe("Cloudflare KV Event Submission Fallback & File Security", () => {
    it("commits event & files to Cloudflare KV when SUPABASE_SERVICE_ROLE_KEY holds publishable key, enforces admin auth on updates, and serves files only to admins", async () => {
      const { processStudentEventSubmission } = await import("@/lib/events.server");
      const { handleEventFileRequest } = await import("@/lib/event-file.server");
      const { signSession, SESSION_COOKIE_NAME } = await import("@/lib/admin-session.server");
      const { deleteLocalEvent } = await import("@/lib/local-events-store");
      const fs = await import("node:fs");
      const path = await import("node:path");

      const kvMap = new Map<string, string | ArrayBuffer>();
      const subId = "b1b2c3d4-e5f6-4890-abcd-ef1234567891";
      const reportPath = `submissions/${subId}/report.pdf`;
      const photoPath = `submissions/${subId}/0_photo.png`;

      type GlobalEnvHolder = { __env__?: Record<string, unknown> | undefined };
      const holder = globalThis as unknown as GlobalEnvHolder;
      const prevEnv = holder.__env__;
      const prevEventsStore = globalThis.__gnitsEventsStore;

      const samplePdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]); // %PDF-1.4
      const samplePdfBase64 = `data:application/pdf;base64,${Buffer.from(samplePdfBytes).toString("base64")}`;
      const sampleImgBase64 = `data:image/png;base64,${Buffer.from([137, 80, 78, 71]).toString("base64")}`;

      const payload = {
        id: subId,
        clubSlug: "technical-events",
        forumSlug: "iste",
        eventName: "Cloudflare KV Fallback Symposium",
        eventStart: "2026-11-24",
        eventEnd: "2026-11-25",
        resourcePersons: "Dr. A. Tester",
        submitterName: "Student Coordinator",
        submitterEmail: "coord@gnits.ac.in",
        reportObjectPath: reportPath,
        reportFileName: "report.pdf",
        reportContentType: "application/pdf",
        photoObjectPaths: [photoPath],
        photoFileNames: ["photo.png"],
        reportBase64: samplePdfBase64,
        photoBase64s: [sampleImgBase64],
      };

      try {
        // Without KV and with publishable key as service role key -> rejects cleanly
        holder.__env__ = {
          ADMIN_SESSION_SECRET: "test-admin-secret-for-vitest",
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_PUBLISHABLE_KEY: "sb_publishable_same_key",
          SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_same_key",
        };
        await expect(processStudentEventSubmission(payload, undefined)).rejects.toThrow(
          /Configuration error/i,
        );

        // With Cloudflare KV bound even while SUPABASE_SERVICE_ROLE_KEY is publishable -> succeeds
        globalThis.__gnitsEventsStore = undefined;
        holder.__env__ = {
          ADMIN_SESSION_SECRET: "test-admin-secret-for-vitest",
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_PUBLISHABLE_KEY: "sb_publishable_same_key",
          SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_same_key",
          KV: {
            get: async (key: string, type: string) => {
              const val = kvMap.get(key) ?? null;
              if (val === null) return null;
              if (type === "json" && typeof val === "string") return JSON.parse(val);
              return val;
            },
            put: async (key: string, value: string | ArrayBuffer | ArrayBufferView) => {
              if (typeof value === "string" || value instanceof ArrayBuffer) {
                kvMap.set(key, value);
              } else {
                const copy = new Uint8Array(value.byteLength);
                copy.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
                kvMap.set(key, copy.buffer);
              }
            },
            delete: async (key: string) => {
              kvMap.delete(key);
            },
          },
        };

        const result = await processStudentEventSubmission(payload, undefined);
        expect(result.id).toBe(subId);
        expect(result.success).toBe(true);
        expect(typeof result.editToken).toBe("string");
        expect(result.editToken!.length).toBeGreaterThanOrEqual(16);

        const storedEventsRaw = kvMap.get("events_store") as string;
        expect(storedEventsRaw).toBeTruthy();
        const storedEvents = JSON.parse(storedEventsRaw) as Array<{
          id: string;
          report_download_url?: string;
          photo_download_urls?: string[];
        }>;
        const saved = storedEvents.find((e) => e.id === subId);
        expect(saved?.report_download_url).toBe(
          `/api/event-file?path=${encodeURIComponent(reportPath)}`,
        );
        expect(saved?.photo_download_urls?.[0]).toBe(
          `/api/event-file?path=${encodeURIComponent(photoPath)}`,
        );

        // Unauthenticated edit attempt without matching editToken must fail
        await expect(
          processStudentEventSubmission({ ...payload, eventName: "Tampered" }, undefined),
        ).rejects.toThrow(/Unauthorized/i);

        // Student Portal edit WITH valid editToken succeeds and preserves existing KV files when not re-uploaded
        const studentUpdated = await processStudentEventSubmission(
          {
            ...payload,
            eventName: "Student Edited Symposium",
            reportObjectPath: `submissions/${subId}/report.pdf`,
            reportBase64: undefined,
            photoObjectPaths: [],
            photoFileNames: [],
            photoBase64s: undefined,
            editToken: result.editToken,
          },
          undefined,
        );
        expect(studentUpdated.success).toBe(true);
        const afterStudentEdit = JSON.parse(kvMap.get("events_store") as string) as Array<{
          id: string;
          event_name: string;
          report_object_path: string;
          report_download_url?: string;
          photo_object_paths: string[];
        }>;
        const editedRec = afterStudentEdit.find((e) => e.id === subId);
        expect(editedRec?.event_name).toBe("Student Edited Symposium");
        expect(editedRec?.report_object_path).toBe(reportPath);
        expect(editedRec?.photo_object_paths).toEqual([photoPath]);

        // Unauthenticated request to /api/event-file must be blocked
        const unauthFileRes = await handleEventFileRequest(
          new Request(`http://localhost/api/event-file?path=${encodeURIComponent(reportPath)}`),
        );
        expect(unauthFileRes.status).toBe(401);

        // Authenticated admin gets 400 on invalid path traversal, 200 on valid submission path
        const token = await signSession("studentcouncil");
        const cookieHeader = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`;

        const badPathRes = await handleEventFileRequest(
          new Request("http://localhost/api/event-file?path=submissions/../secret.txt", {
            headers: { Cookie: cookieHeader },
          }),
        );
        expect(badPathRes.status).toBe(400);

        const okFileRes = await handleEventFileRequest(
          new Request(`http://localhost/api/event-file?path=${encodeURIComponent(reportPath)}`, {
            headers: { Cookie: cookieHeader },
          }),
        );
        expect(okFileRes.status).toBe(200);
        expect(okFileRes.headers.get("Content-Type")).toBe("application/pdf");
        const returnedBytes = new Uint8Array(await okFileRes.arrayBuffer());
        expect(Array.from(returnedBytes)).toEqual(Array.from(samplePdfBytes));

        // Authenticated admin edit on existing event ID succeeds
        const updated = await processStudentEventSubmission(
          { ...payload, eventName: "Updated Symposium" },
          token,
        );
        expect(updated.success).toBe(true);
      } finally {
        deleteLocalEvent(subId);
        globalThis.__gnitsEventsStore = prevEventsStore;
        const subDir = path.resolve(process.cwd(), "public", "submissions", subId);
        if (fs.existsSync(subDir)) {
          fs.rmSync(subDir, { recursive: true, force: true });
        }
        if (prevEnv === undefined) {
          delete holder.__env__;
        } else {
          holder.__env__ = prevEnv;
        }
      }
    });
  });
});
