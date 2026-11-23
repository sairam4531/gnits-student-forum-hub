import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";

import { routeTree } from "@/routeTree.gen";
import { forums, findClub, forumSlug } from "@/lib/student-forums";
import {
  isSupportedReport,
  isSupportedPhoto,
  isSubmissionPath,
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
});
