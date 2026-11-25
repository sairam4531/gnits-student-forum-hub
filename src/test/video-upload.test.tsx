import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { CollegeVideosManage } from "@/components/admin/CollegeVideosManage";
import { sanitizeVideoRecord } from "@/lib/client-portal-store";
import type { HomepageVideo } from "@/lib/local-homepage-store";

const mockSaveVideoAdminServerFn = vi.fn().mockResolvedValue({ success: true });
const mockDeleteVideoAdminServerFn = vi.fn().mockResolvedValue({ success: true });
const mockSetFeaturedVideoAdminServerFn = vi.fn().mockResolvedValue({ success: true });

vi.mock("@/lib/homepage.functions", () => ({
  saveVideoAdminServerFn: (args: unknown) => mockSaveVideoAdminServerFn(args),
  deleteVideoAdminServerFn: (args: unknown) => mockDeleteVideoAdminServerFn(args),
  setFeaturedVideoAdminServerFn: (args: unknown) => mockSetFeaturedVideoAdminServerFn(args),
}));

vi.mock("@/lib/video-storage", () => ({
  saveLocalVideoBlob: vi.fn().mockResolvedValue("blob:http://localhost/test-video"),
  clearLocalVideoBlob: vi.fn().mockResolvedValue(undefined),
}));

describe("College Video Upload (File-Only, No URL Input)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => "blob:http://localhost/mock-preview");
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn();
    }
  });

  afterEach(() => {
    cleanup();
  });

  it("opens Upload College Video modal without any Video URL input or divider", () => {
    render(<CollegeVideosManage videos={[]} onRefresh={vi.fn().mockResolvedValue(undefined)} />);

    fireEvent.click(screen.getByRole("button", { name: /upload college video/i }));

    expect(screen.getByText(/upload video file/i)).toBeTruthy();
    expect(screen.queryByText(/or via video url/i)).toBeNull();
    expect(screen.queryByText(/direct video link/i)).toBeNull();
    expect(document.querySelector('input[type="url"]')).toBeNull();
  });

  it("shows a file selection error when submitted without a video file", async () => {
    render(<CollegeVideosManage videos={[]} onRefresh={vi.fn().mockResolvedValue(undefined)} />);

    fireEvent.click(screen.getByRole("button", { name: /upload college video/i }));
    fireEvent.click(screen.getByRole("button", { name: /save college video/i }));

    const errorEl = await screen.findByText(/please select a video file to upload/i);
    expect(errorEl).toBeTruthy();
    expect(mockSaveVideoAdminServerFn).not.toHaveBeenCalled();
  });

  it("uploads a selected MP4 file directly without URL validation errors even when editing a legacy video", async () => {
    const legacyVideo: HomepageVideo = {
      id: "video-1",
      title: "Old Video",
      description: "",
      video_url: "/assets/campus_loop_video.mp4",
      thumbnail_url: "",
      is_active: true,
      is_featured: true,
      display_order: 1,
      created_at: "2026-11-22T00:00:00.000Z",
      updated_at: "2026-11-22T00:00:00.000Z",
    };

    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<CollegeVideosManage videos={[legacyVideo]} onRefresh={onRefresh} />);

    // Open Edit modal on legacy record that used /assets/campus_loop_video.mp4
    fireEvent.click(screen.getByTitle(/replace video file/i));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const file = new File(["dummy mp4 content"], "GNITS VIDEO.mp4", { type: "video/mp4" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText(/selected: gnits video\.mp4/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /save college video/i }));

    await waitFor(() => {
      expect(mockSaveVideoAdminServerFn).toHaveBeenCalledTimes(1);
    });

    const callArg = mockSaveVideoAdminServerFn.mock.calls[0]?.[0] as {
      data: { id?: string; title: string; videoBase64?: string; videoFileName?: string };
    };
    expect(callArg.data.id).toBe("video-1");
    expect(callArg.data.title).toBe("GNITS VIDEO");
    expect(callArg.data.videoFileName).toBe("GNITS VIDEO.mp4");
    expect(callArg.data.videoBase64).toContain("data:video/mp4;base64,");
  });

  it("sanitizes legacy broken video URLs and keeps valid uploaded data URLs", () => {
    const base: HomepageVideo = {
      id: "v-1",
      title: "Campus",
      description: "",
      video_url: "",
      thumbnail_url: "",
      is_active: true,
      is_featured: true,
      display_order: 1,
      created_at: "2026-11-22T00:00:00.000Z",
      updated_at: "2026-11-22T00:00:00.000Z",
    };

    expect(
      sanitizeVideoRecord({ ...base, video_url: "/assets/campus_loop_video.mp4" }).video_url,
    ).toBe("");
    expect(sanitizeVideoRecord({ ...base, video_url: "GNITS VIDEO.mp4" }).video_url).toBe("");
    expect(
      sanitizeVideoRecord({ ...base, video_url: "data:video/mp4;base64,AAAA" }).video_url,
    ).toBe("data:video/mp4;base64,AAAA");
  });
});
