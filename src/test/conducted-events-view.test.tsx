import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { ConductedEventsView } from "@/components/ConductedEventsView";
import { AdminEventsView } from "@/components/AdminEventsView";
import { saveClientEvent } from "@/lib/client-portal-store";
import { forums } from "@/lib/student-forums";

const mockGetPublicForumEvents = vi.fn();
const mockSubmitStudentEvent = vi.fn();
const mockGetAdminForumEventsServerFn = vi.fn();
const mockDeleteAdminEventServerFn = vi.fn();

vi.mock("@/lib/events.functions", () => ({
  getPublicForumEvents: (args: unknown) => mockGetPublicForumEvents(args),
  submitStudentEvent: (args: unknown) => mockSubmitStudentEvent(args),
}));

vi.mock("@/lib/admin.functions", () => ({
  getAdminForumEventsServerFn: (args: unknown) => mockGetAdminForumEventsServerFn(args),
  deleteAdminEventServerFn: (args: unknown) => mockDeleteAdminEventServerFn(args),
}));

describe("ConductedEventsView Loading & Cross-Tab Sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders submitted events from getPublicForumEvents without getting stuck in Loading events or looping BroadcastChannel", async () => {
    const postMessages: unknown[] = [];
    const OriginalBC = globalThis.BroadcastChannel;

    class SpyBroadcastChannel {
      onmessage: ((ev: MessageEvent) => void) | null = null;
      name: string;
      constructor(name: string) {
        this.name = name;
      }
      postMessage(msg: unknown) {
        postMessages.push(msg);
      }
      close() {}
    }
    // @ts-expect-error test spy for BroadcastChannel
    globalThis.BroadcastChannel = SpyBroadcastChannel;

    try {
      const sampleEvents = [
        {
          id: "f9948d38-83e6-44b0-97da-611354f3c3d4",
          club_slug: "technical-events",
          forum_slug: "iste",
          event_name: "sedger",
          event_start: "2026-11-25",
          event_end: "2026-11-26",
          created_at: "2026-11-25T17:06:42.050Z",
          resource_persons: "Speaker 1",
        },
        {
          id: "335b2b5c-c547-4f45-be96-478d7b541d6a",
          club_slug: "technical-events",
          forum_slug: "iste",
          event_name: "Tha",
          event_start: "2026-11-25",
          event_end: "2026-11-25",
          created_at: "2026-11-25T17:04:07.325Z",
          resource_persons: "Speaker 2",
        },
      ];
      mockGetPublicForumEvents.mockResolvedValue(sampleEvents);

      const techClub = forums[0]!;
      render(
        <ConductedEventsView
          club={techClub}
          forumName="ISTE"
          forumSlug="iste"
          isAdmin={false}
        />,
      );

      await waitFor(() => {
        expect(screen.queryByText(/loading events\.\.\./i)).toBeNull();
      });

      expect(screen.getByText("sedger")).toBeTruthy();
      expect(screen.getByText("Tha")).toBeTruthy();
      expect(screen.getAllByRole("button", { name: /^edit$/i }).length).toBe(2);
      expect(mockGetPublicForumEvents).toHaveBeenCalledTimes(1);
      // Hydrating server results must NOT emit cross-tab sync broadcasts
      expect(postMessages.length).toBe(0);

      // Saving an already identical event with default broadcast must also avoid re-broadcasting
      saveClientEvent(sampleEvents[0]!);
      expect(postMessages.length).toBe(0);
    } finally {
      globalThis.BroadcastChannel = OriginalBC;
    }
  });

  it("displays submitted student data, report download, photos, and Delete Event button in AdminEventsView", async () => {
    mockGetAdminForumEventsServerFn.mockResolvedValue([
      {
        id: "ev-admin-1",
        club_slug: "technical-events",
        forum_slug: "iste",
        event_name: "AI Workshop",
        event_start: "2026-11-25",
        event_end: "2026-11-26",
        resource_persons: "Dr. Aparna Patle",
        submitter_name: "Ananya Reddy",
        submitter_email: "ananya@gnits.ac.in",
        report_object_path: "submissions/ev-admin-1/report.pdf",
        report_file_name: "AI_Report.pdf",
        report_content_type: "application/pdf",
        photo_object_paths: ["submissions/ev-admin-1/0_stage.jpg"],
        photo_file_names: ["stage.jpg"],
        created_at: "2026-11-25T17:00:00.000Z",
        report_download_url: "/api/event-file?path=submissions%2Fev-admin-1%2Freport.pdf",
        photo_download_urls: ["/api/event-file?path=submissions%2Fev-admin-1%2F0_stage.jpg"],
      },
    ]);

    const techClub = forums[0]!;
    render(<AdminEventsView club={techClub} forumName="ISTE" forumSlug="iste" />);

    expect(await screen.findByText("AI Workshop")).toBeTruthy();
    expect(screen.getByText("Ananya Reddy")).toBeTruthy();
    expect(screen.getByText("ananya@gnits.ac.in")).toBeTruthy();
    expect(screen.getByText("Dr. Aparna Patle")).toBeTruthy();
    expect(screen.getByText(/report:\s*ai_report\.pdf/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /download/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /view photos \(1\)/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /delete event/i })).toBeTruthy();
  });
});
