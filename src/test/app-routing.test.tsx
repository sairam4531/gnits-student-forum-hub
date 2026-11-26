import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";

import { routeTree } from "@/routeTree.gen";
import {
  forums,
  findClub,
  forumSlug,
  ACADEMIC_YEARS,
  institutionalForumSlugWithAy,
  parseInstitutionalForumSlug,
} from "@/lib/student-forums";
import {
  isSupportedReport,
  isSupportedPhoto,
  isSubmissionPath,
  isKnownForum,
  eventSubmissionSchema,
} from "@/lib/event-validation";
import { getLocalEvents, saveLocalEvent, deleteLocalEvent } from "@/lib/local-events-store";
import { getHomepageStore } from "@/lib/local-homepage-store";

describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
    expect(matches.at(-1)?.routeId).toBe("/");
  });

  it("matches a page for /admin instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/admin");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
    expect(matches.at(-1)?.routeId).toBe("/admin");
  });

  it("defines all six required GNITS clubs and their flagship forums", () => {
    expect(forums.length).toBeGreaterThanOrEqual(6);

    const techClub = findClub("technical-events");
    expect(techClub).toBeDefined();
    expect(techClub?.forums).toContain("ISTE");
    expect(techClub?.forums).toContain("IEEE");
    expect(techClub?.forums).toContain("CSI");

    const culturalClub = findClub("cultural-events");
    expect(culturalClub).toBeDefined();
    expect(culturalClub?.forums).toContain("Samskruthi");
    expect(culturalClub?.forums).toContain("Nrityastra");

    const outreachClub = findClub("outreach-events");
    expect(outreachClub).toBeDefined();
    expect(outreachClub?.forums).toContain("Rotaract Club");
    expect(outreachClub?.forums).toContain("NSS");

    // Check slug helper
    expect(forumSlug("technical-events", "ISTE")).toBe("iste");
    expect(forumSlug("outreach-events", "Environmental Club (Unnat Bharat Abhiyan)")).toBe(
      "environmental-club",
    );
  });

  it("validates event submission formats for docx reports and jpg photos", () => {
    // Tests the exact format the user submitted
    expect(isSupportedReport({ name: "HARI_Examination_Platform_User_Guide.docx", type: "" })).toBe(
      true,
    );
    expect(isSupportedReport({ name: "annual_report.pdf", type: "application/pdf" })).toBe(true);
    expect(isSupportedPhoto({ type: "image/jpeg" })).toBe(true);
    expect(isSupportedPhoto({ type: "image/png" })).toBe(true);

    const subId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const reportPath = `submissions/${subId}/guide.docx`;
    const photoPath = `submissions/${subId}/0_img1.jpg`;

    expect(isSubmissionPath(reportPath)).toBe(true);
    expect(isSubmissionPath(photoPath)).toBe(true);

    const validPayload = {
      clubSlug: "technical-events",
      forumSlug: "iste",
      eventName: "Hands-on Examination Workshop",
      eventStart: "2026-11-20",
      eventEnd: "2026-11-21",
      resourcePersons: "Dr. K. Smitha",
      submitterName: "dewrwe",
      submitterEmail: "sairohit4531@gmail.com",
      reportObjectPath: reportPath,
      reportFileName: "HARI_Examination_Platform_User_Guide.docx",
      reportContentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      photoObjectPaths: [photoPath],
      photoFileNames: ["img1.jpg"],
    };

    const parsed = eventSubmissionSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
  });

  it("persists and reads events from local store", () => {
    const testId = "test-event-" + Date.now();
    saveLocalEvent({
      id: testId,
      club_slug: "technical-events",
      forum_slug: "iste",
      event_name: "Test Conducted Event on ISTE",
      event_start: "2026-11-20",
      event_end: "2026-11-21",
      resource_persons: "Dr. Test",
      submitter_name: "Test Submitter",
      submitter_email: "test@gnits.ac.in",
      report_object_path: `submissions/uuid/test.docx`,
      report_file_name: "test.docx",
      report_content_type: "application/docx",
      photo_object_paths: [],
      photo_file_names: [],
      created_at: new Date().toISOString(),
    });

    const events = getLocalEvents();
    const found = events.find((e) => e.id === testId);
    expect(found).toBeDefined();
    expect(found?.event_name).toBe("Test Conducted Event on ISTE");

    // Clean up test event immediately so data/events.json is never polluted
    deleteLocalEvent(testId);
  });

  it("stores and provides dynamic homepage photos, video, and dean details", () => {
    const store = getHomepageStore();

    expect(store).toBeDefined();
    expect(Array.isArray(store.photos)).toBe(true);
    expect(store.photos.length).toBeGreaterThan(0);
    expect(Array.isArray(store.videos)).toBe(true);
    expect(store.dean).toBeDefined();
    expect(store.dean.name).toContain("Dr.");
    expect(store.dean.email).toContain("@gnits.ac.in");
  });

  it("signs and verifies admin sessions using Web Crypto HMAC-SHA256", async () => {
    process.env["ADMIN_SESSION_SECRET"] = "unit-test-admin-secret-key-12345";
    const { signSession, verifySession } = await import("@/lib/admin-session.server");

    const token = await signSession("studentcouncil");
    expect(token).toBeDefined();
    expect(token).toContain(".");

    const verified = await verifySession(token);
    expect(verified).not.toBeNull();
    expect(verified?.username).toBe("studentcouncil");

    // Tampered token test
    const tampered = token.slice(0, -3) + "xyz";
    const tamperedResult = await verifySession(tampered);
    expect(tamperedResult).toBeNull();

    // Invalid format test
    expect(await verifySession("invalid-token-without-dot")).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });

  it("keeps /events in Student Portal mode unless ?mode=admin is explicitly provided", async () => {
    const { Route: EventsRoute } = await import("@/routes/events");
    const validateSearch = EventsRoute.options.validateSearch as (
      search: Record<string, unknown>,
    ) => { club?: string; forum?: string; slug?: string; mode?: string };

    const defaultSearch = validateSearch({
      club: "technical-events",
      forum: "ISTE",
      slug: "iste",
    });
    expect(defaultSearch.mode).toBeUndefined();

    const adminSearch = validateSearch({
      club: "technical-events",
      forum: "ISTE",
      slug: "iste",
      mode: "admin",
    });
    expect(adminSearch.mode).toBe("admin");

    const spoofedSearch = validateSearch({
      club: "technical-events",
      forum: "ISTE",
      slug: "iste",
      mode: "anything-else",
    });
    expect(spoofedSearch.mode).toBeUndefined();
  });

  it("bridges Vercel / non-Worker environments to Cloudflare KV via REST API when CLOUDFLARE_API_TOKEN is set", async () => {
    const { getCloudflareKVNamespace } = await import("@/lib/local-homepage-store");

    const prevToken = process.env["CLOUDFLARE_API_TOKEN"];
    const prevAccount = process.env["CLOUDFLARE_ACCOUNT_ID"];
    const prevNamespace = process.env["CLOUDFLARE_KV_NAMESPACE_ID"];
    const prevFetch = globalThis.fetch;

    try {
      delete process.env["CLOUDFLARE_API_TOKEN"];
      expect(getCloudflareKVNamespace()).toBeNull();

      process.env["CLOUDFLARE_API_TOKEN"] = "cf-test-token-123";
      process.env["CLOUDFLARE_ACCOUNT_ID"] = "acc-test-1";
      process.env["CLOUDFLARE_KV_NAMESPACE_ID"] = "ns-test-2";

      const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const headers = init?.headers as Record<string, string> | undefined;
        expect(headers?.["Authorization"]).toBe("Bearer cf-test-token-123");

        if (init?.method === "GET" && url.endsWith("/values/homepage_store")) {
          return new Response(JSON.stringify({ videos: [{ id: "v1" }] }), { status: 200 });
        }
        if (init?.method === "GET" && url.endsWith("/values/missing_key")) {
          return new Response("Not Found", { status: 404 });
        }
        if (init?.method === "PUT" && url.endsWith("/values/video_chunk%3Av1%3A0")) {
          return new Response(null, { status: 200 });
        }
        if (init?.method === "DELETE" && url.endsWith("/values/old_key")) {
          return new Response(null, { status: 200 });
        }
        return new Response("Unexpected", { status: 500 });
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const kv = getCloudflareKVNamespace();
      expect(kv).not.toBeNull();

      const loaded = await kv!.get<{ videos: { id: string }[] }>("homepage_store", "json");
      expect(loaded?.videos[0]?.id).toBe("v1");

      const missing = await kv!.get("missing_key", "json");
      expect(missing).toBeNull();

      await kv!.put("video_chunk:v1:0", new Uint8Array([1, 2, 3]).buffer);
      await kv!.delete?.("old_key");
      expect(fetchMock).toHaveBeenCalledTimes(4);
    } finally {
      globalThis.fetch = prevFetch;
      if (prevToken === undefined) delete process.env["CLOUDFLARE_API_TOKEN"];
      else process.env["CLOUDFLARE_API_TOKEN"] = prevToken;
      if (prevAccount === undefined) delete process.env["CLOUDFLARE_ACCOUNT_ID"];
      else process.env["CLOUDFLARE_ACCOUNT_ID"] = prevAccount;
      if (prevNamespace === undefined) delete process.env["CLOUDFLARE_KV_NAMESPACE_ID"];
      else process.env["CLOUDFLARE_KV_NAMESPACE_ID"] = prevNamespace;
    }
  });

  it("overrides stale browser localStorage Dean and video cache with authoritative server data", async () => {
    const {
      HOMEPAGE_KEY,
      saveClientDeanDetails,
      mergeServerWithClient,
      getClientHomepageData,
    } = await import("@/lib/client-portal-store");

    localStorage.clear();
    // Simulate a stale Edge browser cache holding an old Dean spelling
    saveClientDeanDetails({
      id: "dean-1",
      name: "Dr. Aparna Patle",
      designation: "Dean, Student Affairs & Professor",
      profile_photo: "",
      email: "aparna.patle@gnits.ac.in",
      contact_number: "GNITS",
      office: "GNITS",
      updated_at: "2026-11-20T00:00:00.000Z",
    });

    const merged = mergeServerWithClient({
      photos: [],
      videos: [
        {
          id: "vid-server-1",
          title: "Campus Walkthrough",
          description: "",
          video_url: "/api/campus-video?id=vid-server-1",
          thumbnail_url: "/assets/student-affairs-reference.jpg",
          is_active: true,
          is_featured: true,
          display_order: 1,
          created_at: "2026-11-25T00:00:00.000Z",
          updated_at: "2026-11-25T00:00:00.000Z",
        },
      ],
      dean: {
        id: "dean-1",
        name: "Dr. Aparna Palle",
        designation: "Dean, Student Affairs & Professor",
        profile_photo: "",
        email: "palle.aparna@gnits.ac.in",
        contact_number: "Dean – Student Affairs, GNITS, Hyderabad",
        office: "Dean – Student Affairs, GNITS, Hyderabad",
        updated_at: "2026-11-25T10:00:00.000Z",
      },
    });

    expect(merged.dean.name).toBe("Dr. Aparna Palle");
    expect(merged.dean.email).toBe("palle.aparna@gnits.ac.in");
    expect(merged.videos).toHaveLength(1);
    expect(getClientHomepageData().dean.name).toBe("Dr. Aparna Palle");
    expect(localStorage.getItem(HOMEPAGE_KEY)).toContain("Dr. Aparna Palle");
  });

  it("supports AY:2023-24 through AY:2027-28 for institutional events while leaving Student Forums untouched", async () => {
    expect(ACADEMIC_YEARS).toEqual([
      "AY:2023-24",
      "AY:2024-25",
      "AY:2025-26",
      "AY:2026-27",
      "AY:2027-28",
    ]);

    const scopedSlug = institutionalForumSlugWithAy("Annual day", "AY:2024-25");
    expect(scopedSlug).toBe("annual-day--ay-2024-25");
    expect(parseInstitutionalForumSlug(scopedSlug)).toEqual({
      baseSlug: "annual-day",
      academicYear: "AY:2024-25",
    });

    expect(isKnownForum("institutional-events", scopedSlug)).toBe(true);
    expect(isKnownForum("institutional-events", "annual-day--ay-1999-00")).toBe(false);
    expect(isKnownForum("technical-events", "iste")).toBe(true);
    expect(isKnownForum("technical-events", "iste--ay-2024-25")).toBe(false);

    const { Route: EventsRoute } = await import("@/routes/events");
    const validateSearch = EventsRoute.options.validateSearch as (
      search: Record<string, unknown>,
    ) => { club?: string; forum?: string; slug?: string; ay?: string; mode?: string };

    const instSearch = validateSearch({
      club: "institutional-events",
      forum: "Annual day",
      slug: scopedSlug,
      ay: "AY:2024-25",
      mode: "it-admin",
    });
    expect(instSearch.ay).toBe("AY:2024-25");
    expect(instSearch.mode).toBe("it-admin");

    const clubAdminSearch = validateSearch({
      club: "technical-events",
      forum: "ISTE",
      slug: "iste",
      mode: "admin",
    });
    expect(clubAdminSearch.mode).toBe("admin");

    const studentForumSearch = validateSearch({
      club: "technical-events",
      forum: "ISTE",
      slug: "iste",
      ay: "AY:2024-25",
    });
    expect(studentForumSearch.ay).toBeUndefined();
    expect(studentForumSearch.mode).toBeUndefined();
  });
});
