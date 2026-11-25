import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { Route as AdminRoute } from "@/routes/admin";

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
}

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
  useNavigate: () => vi.fn(),
  useRouter: () => ({ navigate: vi.fn(), state: {} }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/lib/admin.functions", () => ({
  adminLoginServerFn: vi.fn(),
  getAdminSessionServerFn: vi
    .fn()
    .mockResolvedValue({ authenticated: true, username: "studentcouncil" }),
  adminLogoutServerFn: vi.fn().mockResolvedValue({ success: true }),
  getAdminProfileServerFn: vi.fn().mockResolvedValue({
    username: "studentcouncil",
    display_name: "GNITS Student Council Admin",
    avatar_url: null,
    updated_at: "2026-11-25T00:00:00.000Z",
  }),
  getAllAdminEventsServerFn: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/homepage.functions", () => ({
  getAdminHomepageDataServerFn: vi.fn().mockResolvedValue({
    photos: [],
    videos: [],
    dean: {
      id: "dean-1",
      name: "Dr. Aparna Patle",
      designation: "Dean, Student Affairs & Professor",
      profile_photo: "",
      email: "aparna.patle@gnits.ac.in",
      contact_number: "Dean – Student Affairs, GNITS, Hyderabad",
      office: "Dean – Student Affairs, GNITS, Hyderabad",
      updated_at: "2026-11-25T00:00:00.000Z",
    },
  }),
  saveVideoAdminServerFn: vi.fn().mockResolvedValue({ success: true }),
  deleteVideoAdminServerFn: vi.fn().mockResolvedValue({ success: true }),
  setFeaturedVideoAdminServerFn: vi.fn().mockResolvedValue({ success: true }),
  updateDeanDetailsAdminServerFn: vi.fn().mockResolvedValue({ success: true }),
}));

describe("Admin Dashboard Simplified Layout", () => {
  afterEach(() => {
    cleanup();
  });

  it("displays ONLY video showcase with Edit Video button and Dean Details, with no filters, data tables, or extra buttons", async () => {
    const AdminComponent = (AdminRoute as unknown as { options: { component: React.ComponentType } })
      .options.component;

    render(<AdminComponent />);

    // Wait for session verification and dashboard render
    const editVideoBtn = await screen.findByRole("button", { name: /edit video/i });
    expect(editVideoBtn).toBeTruthy();

    // Dean Details section is visible
    expect(screen.getByRole("heading", { name: /^dean details$/i })).toBeTruthy();

    // Removed buttons, filters, and submitted data tables must NOT exist on the dashboard
    expect(screen.queryByRole("button", { name: /manage videos/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /manage photos/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /export master excel/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /dean's profile/i })).toBeNull();
    expect(screen.queryByText(/submitted student event reports/i)).toBeNull();
    expect(screen.queryByText(/verified submissions repository/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/search by event title/i)).toBeNull();
    expect(screen.queryByLabelText(/filter events by club/i)).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();

    // Clicking Edit Video opens the video upload modal
    fireEvent.click(editVideoBtn);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /upload college video/i })).toBeTruthy();
    });
  });
});
