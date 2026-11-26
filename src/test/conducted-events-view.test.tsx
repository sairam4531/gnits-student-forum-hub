import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { ConductedEventsView } from "@/components/ConductedEventsView";
import { AdminEventsView } from "@/components/AdminEventsView";
import { EventsClubsDrawer } from "@/components/EventsClubsDrawer";
import { saveClientEvent } from "@/lib/client-portal-store";
import { forums } from "@/lib/student-forums";

function renderWithRouter(ui: React.ReactNode) {
  const rootRoute = createRootRoute({
    component: () => <>{ui}</>,
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => null,
  });
  const adminRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/admin",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, adminRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

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
      close() { }
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
      expect(screen.queryByRole("button", { name: /add new event/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /^edit$/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
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

  it("navigates directly on non-Student-Forum sidebar events without rendering AY items in the drawer while keeping Student Forums untouched", async () => {
    for (const portalMode of ["student", "admin", "it-admin"] as const) {
      const onSelectForum = vi.fn();
      const onClose = vi.fn();
      renderWithRouter(
        <EventsClubsDrawer
          isOpen={true}
          onClose={onClose}
          onSelectForum={onSelectForum}
          portalMode={portalMode}
          allowedClubSlug={portalMode === "admin" ? "technical-events" : null}
        />,
      );

      expect(
        screen.getByText(
          portalMode === "it-admin"
            ? "IT-Admin Affairs Portal"
            : portalMode === "admin"
              ? "Admin Affairs Portal"
              : "Student Affairs Portal",
        ),
      ).toBeTruthy();

      // Click an institutional event ("Annual day") — navigates directly with no AY list in sidebar
      fireEvent.click(await screen.findByRole("button", { name: /annual day/i }));
      for (const ay of [
        "AY:2023-24",
        "AY:2024-25",
        "AY:2025-26",
        "AY:2026-27",
        "AY:2027-28",
      ]) {
        expect(screen.queryByRole("button", { name: new RegExp(ay, "i") })).toBeNull();
      }
      expect(onSelectForum).toHaveBeenCalledWith(
        expect.objectContaining({ slug: "institutional-events" }),
        "Annual day",
        "annual-day--ay-2023-24",
        "AY:2023-24",
      );
      expect(onClose).toHaveBeenCalled();

      // Student Forums stays untouched (expands into Technical Clubs, etc., without AY items)
      fireEvent.click(screen.getByRole("button", { name: /student forums/i }));
      expect(screen.getByRole("button", { name: /technical clubs/i })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /AY:2025-26/i })).toBeNull();

      cleanup();
    }
  });

  it("omits resource person and submitter fields when adding institutional events in AdminEventsView, while preserving them for Student Forums", async () => {
    mockGetAdminForumEventsServerFn.mockResolvedValue([]);

    // 1. Institutional Event (IT-Admin): no resource person, submitter name, or mail id
    const instClub = forums.find((f) => f.slug === "institutional-events")!;
    render(
      <AdminEventsView
        club={instClub}
        forumName="Annual day"
        forumSlug="annual-day--ay-2024-25"
        academicYear="AY:2024-25"
        portalRole="it-admin"
        canAdd={true}
        canEdit={true}
        canDelete={true}
      />,
    );

    const addInstBtns = await screen.findAllByRole("button", { name: /add new event on annual day/i });
    fireEvent.click(addInstBtns[0]!);

    expect(screen.queryByText(/resource person names/i)).toBeNull();
    expect(screen.queryByText(/submitter name/i)).toBeNull();
    expect(screen.queryByText(/submitter student email/i)).toBeNull();
    expect(screen.getByText(/event name \*/i)).toBeTruthy();

    cleanup();

    // 2. Student Forum (Category Admin on Technical Events / ISTE): keeps all original fields
    const techClub = forums[0]!;
    render(
      <AdminEventsView
        club={techClub}
        forumName="ISTE"
        forumSlug="iste"
        portalRole="admin"
        canAdd={true}
        canEdit={true}
        canDelete={false}
      />,
    );

    const addForumBtns = await screen.findAllByRole("button", { name: /add new event on iste/i });
    fireEvent.click(addForumBtns[0]!);

    expect(screen.getByText(/resource person names/i)).toBeTruthy();
    expect(screen.getByText(/submitter name/i)).toBeTruthy();
    expect(screen.getByText(/submitter student email/i)).toBeTruthy();
  });

  it("hides empty submitter/resource cards in AdminEventsView for institutional events", async () => {
    mockGetAdminForumEventsServerFn.mockResolvedValue([
      {
        id: "ev-inst-1",
        club_slug: "institutional-events",
        forum_slug: "annual-day--ay-2024-25",
        event_name: "Annual Day 2024-25",
        event_start: "2025-03-10",
        event_end: "2025-03-10",
        resource_persons: "",
        submitter_name: null,
        submitter_email: null,
        report_object_path: "submissions/ev-inst-1/report.pdf",
        report_file_name: "AnnualDay_Report.pdf",
        report_content_type: "application/pdf",
        photo_object_paths: [],
        photo_file_names: [],
        created_at: "2025-03-11T10:00:00.000Z",
        report_download_url: "/api/event-file?path=submissions%2Fev-inst-1%2Freport.pdf",
        photo_download_urls: [],
      },
    ]);

    const instClub = forums.find((f) => f.slug === "institutional-events")!;
    render(
      <AdminEventsView
        club={instClub}
        forumName="Annual day"
        forumSlug="annual-day--ay-2024-25"
        academicYear="AY:2024-25"
      />,
    );

    expect(await screen.findByText("Annual Day 2024-25")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: /submitted events on annual day \(ay:2024-25\)/i }),
    ).toBeTruthy();
    expect(screen.queryByText(/student submitter/i)).toBeNull();
    expect(screen.queryByText(/submitter email/i)).toBeNull();
    expect(screen.queryByText(/resource person/i)).toBeNull();
    expect(screen.getByRole("button", { name: /delete event/i })).toBeTruthy();
  });

  it("immediately shows newly added Institutional and Student Forum events in AdminEventsView even if KV read returns stale empty array after submit", async () => {
    if (typeof URL.createObjectURL !== "function") {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        writable: true,
        value: vi.fn(() => "blob:mock-url"),
      });
    }

    const instClub = forums.find((f) => f.slug === "institutional-events")!;
    const techClub = forums[0]!;
    const pdfFile = new File(["%PDF-1.4\ntest"], "event-report.pdf", { type: "application/pdf" });

    // Case 1: Institutional Event (IT-Admin: Add, Edit, Delete)
    mockGetAdminForumEventsServerFn.mockResolvedValue([]);
    mockSubmitStudentEvent.mockResolvedValue({
      id: "inst-new-2023",
      success: true,
      editToken: "tok-inst",
    });

    const { container: instContainer } = render(
      <AdminEventsView
        club={instClub}
        forumName="Annual day"
        forumSlug="annual-day--ay-2023-24"
        academicYear="AY:2023-24"
        portalRole="it-admin"
        canAdd={true}
        canEdit={true}
        canDelete={true}
      />,
    );

    const instAddBtns = await screen.findAllByRole("button", {
      name: /add new event on annual day/i,
    });
    fireEvent.click(instAddBtns[0]!);
    fireEvent.change(screen.getByPlaceholderText(/national level hackathon/i), {
      target: { value: "Annual Day Celebration 2024" },
    });
    const instDateInputs = instContainer.querySelectorAll('input[type="date"]');
    fireEvent.change(instDateInputs[0]!, { target: { value: "2024-03-15" } });
    fireEvent.change(instDateInputs[1]!, { target: { value: "2024-03-16" } });
    const instReportInput = instContainer.querySelector(
      'input[type="file"]:not([multiple])[accept*=".pdf"]',
    )!;
    fireEvent.change(instReportInput, { target: { files: [pdfFile] } });

    fireEvent.submit(screen.getByRole("button", { name: /submit to portal/i }).closest("form")!);

    expect(await screen.findByText(/event submitted to portal successfully!/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /done/i }));
    expect(await screen.findByText("Annual Day Celebration 2024")).toBeTruthy();
    expect(screen.queryByText(/no events uploaded for annual day yet/i)).toBeNull();
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /delete event/i })).toBeTruthy();

    cleanup();
    localStorage.clear();

    // Case 2: Student Forum (Category Admin: Add & Edit to IT-Admin, NO Delete)
    mockGetAdminForumEventsServerFn.mockResolvedValue([]);
    mockSubmitStudentEvent.mockResolvedValue({
      id: "iste-new-2026",
      success: true,
      editToken: "tok-iste",
    });

    const { container: forumContainer } = render(
      <AdminEventsView
        club={techClub}
        forumName="ISTE"
        forumSlug="iste"
        portalRole="admin"
        canAdd={true}
        canEdit={true}
        canDelete={false}
      />,
    );

    const forumAddBtns = await screen.findAllByRole("button", { name: /add new event on iste/i });
    fireEvent.click(forumAddBtns[0]!);
    fireEvent.change(screen.getByPlaceholderText(/national level hackathon/i), {
      target: { value: "ISTE AI Workshop" },
    });
    const forumDateInputs = forumContainer.querySelectorAll('input[type="date"]');
    fireEvent.change(forumDateInputs[0]!, { target: { value: "2026-09-10" } });
    fireEvent.change(forumDateInputs[1]!, { target: { value: "2026-09-11" } });
    fireEvent.change(screen.getByPlaceholderText(/dr\. k\. radhika/i), {
      target: { value: "Dr. R. Rao" },
    });
    fireEvent.change(screen.getByPlaceholderText(/ananya reddy/i), {
      target: { value: "Ananya" },
    });
    fireEvent.change(screen.getByPlaceholderText(/gnits\.ac\.in/i), {
      target: { value: "ananya@gnits.ac.in" },
    });
    const forumReportInput = forumContainer.querySelector(
      'input[type="file"]:not([multiple])[accept*=".pdf"]',
    )!;
    fireEvent.change(forumReportInput, { target: { files: [pdfFile] } });

    fireEvent.submit(screen.getByRole("button", { name: /submit to it-admin/i }).closest("form")!);

    expect(await screen.findByText(/event submitted to it-admin successfully!/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /done/i }));
    expect(await screen.findByText("ISTE AI Workshop")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /delete event/i })).toBeNull();
  });

  it("supports uploading PDF and Word Documents across all events (institutional and student forums) and displays read-only files to other admins", async () => {
    if (typeof URL.createObjectURL !== "function") {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        writable: true,
        value: vi.fn(() => "blob:mock-doc-url"),
      });
    }

    const techClub = forums[0]!;
    const reportPdf = new File(["%PDF-1.4\nreport"], "main-report.pdf", { type: "application/pdf" });
    const circularPdf = new File(["%PDF-1.4\ncircular"], "Circular.pdf", {
      type: "application/pdf",
    });
    const attendanceDocx = new File(
      ["PK\u0003\u0004attendance"],
      "Attendance.docx",
      { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    );

    mockGetAdminForumEventsServerFn.mockResolvedValue([]);
    mockSubmitStudentEvent.mockResolvedValue({
      id: "iste-with-docs-1",
      success: true,
      editToken: "tok-docs-1",
    });

    const { container } = render(
      <AdminEventsView
        club={techClub}
        forumName="ISTE"
        forumSlug="iste"
        portalRole="admin"
        canAdd={true}
        canEdit={true}
        canDelete={false}
      />,
    );

    const addBtns = await screen.findAllByRole("button", { name: /add new event on iste/i });
    fireEvent.click(addBtns[0]!);
    expect(screen.getByText(/documents \(pdf \/ word\)/i)).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/national level hackathon/i), {
      target: { value: "ISTE Cloud Seminar" },
    });
    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0]!, { target: { value: "2026-10-05" } });
    fireEvent.change(dateInputs[1]!, { target: { value: "2026-10-06" } });
    fireEvent.change(screen.getByPlaceholderText(/dr\. k\. radhika/i), {
      target: { value: "Dr. M. Rao" },
    });
    fireEvent.change(screen.getByPlaceholderText(/ananya reddy/i), {
      target: { value: "Sneha" },
    });
    fireEvent.change(screen.getByPlaceholderText(/gnits\.ac\.in/i), {
      target: { value: "sneha@gnits.ac.in" },
    });

    const reportInput = container.querySelector('input[type="file"]:not([multiple])[accept*=".pdf"]')!;
    fireEvent.change(reportInput, { target: { files: [reportPdf] } });

    const docsInput = container.querySelector('input[type="file"][multiple][accept*=".pdf"]')!;
    fireEvent.change(docsInput, { target: { files: [circularPdf, attendanceDocx] } });

    expect(screen.getByText("Circular.pdf")).toBeTruthy();
    expect(screen.getByText("Attendance.docx")).toBeTruthy();

    fireEvent.submit(screen.getByRole("button", { name: /submit to it-admin/i }).closest("form")!);

    expect(await screen.findByText(/event submitted to it-admin successfully!/i)).toBeTruthy();
    expect(mockSubmitStudentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentFileNames: ["Circular.pdf", "Attendance.docx"],
          documentObjectPaths: expect.arrayContaining([
            expect.stringContaining("Circular.pdf"),
            expect.stringContaining("Attendance.docx"),
          ]),
          documentBase64s: expect.arrayContaining([expect.stringMatching(/^data:/)]),
        }),
      }),
    );

    cleanup();
    localStorage.clear();

    mockGetAdminForumEventsServerFn.mockResolvedValue([
      {
        id: "iste-with-docs-1",
        club_slug: "technical-events",
        forum_slug: "iste",
        event_name: "ISTE Cloud Seminar",
        event_start: "2026-10-05",
        event_end: "2026-10-06",
        resource_persons: "Dr. M. Rao",
        submitter_name: null,
        submitter_email: null,
        report_object_path: "submissions/iste-with-docs-1/report.pdf",
        report_file_name: "main-report.pdf",
        report_content_type: "application/pdf",
        photo_object_paths: [],
        photo_file_names: [],
        document_object_paths: [
          "submissions/iste-with-docs-1/doc_0_Circular.pdf",
          "submissions/iste-with-docs-1/doc_1_Attendance.docx",
        ],
        document_file_names: ["Circular.pdf", "Attendance.docx"],
        document_content_types: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        document_download_urls: [
          "/api/event-file?path=Circular.pdf",
          "/api/event-file?path=Attendance.docx",
        ],
        created_at: "2026-10-06T12:00:00.000Z",
        report_download_url: "/api/event-file?path=report.pdf",
        photo_download_urls: [],
      },
    ]);

    render(
      <AdminEventsView
        club={techClub}
        forumName="ISTE"
        forumSlug="iste"
        portalRole="admin"
        canAdd={false}
        canEdit={false}
        canDelete={false}
      />,
    );
    expect(await screen.findByText("ISTE Cloud Seminar")).toBeTruthy();
    expect(screen.getByText(/documents \(2\)/i)).toBeTruthy();
    expect(screen.getByText("Circular.pdf")).toBeTruthy();
    expect(screen.getByText("Attendance.docx")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /add new event/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^edit$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete event/i })).toBeNull();
  });
});
