import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { ConductedEventsView } from "@/components/ConductedEventsView";
import { saveClientEvent } from "@/lib/client-portal-store";
import { forums } from "@/lib/student-forums";

const mockGetPublicForumEvents = vi.fn();
const mockSubmitStudentEvent = vi.fn();

vi.mock("@/lib/events.functions", () => ({
  getPublicForumEvents: (args: unknown) => mockGetPublicForumEvents(args),
  submitStudentEvent: (args: unknown) => mockSubmitStudentEvent(args),
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
          isAdmin={true}
        />,
      );

      await waitFor(() => {
        expect(screen.queryByText(/loading events\.\.\./i)).toBeNull();
      });

      expect(screen.getByText("sedger")).toBeTruthy();
      expect(screen.getByText("Tha")).toBeTruthy();
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
});
