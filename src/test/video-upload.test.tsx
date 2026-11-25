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
  getLocalVideoBlobUrl: vi.fn().mockResolvedValue(null),
}));

describe("College Video Upload (File-Only, No URL Input, No Size Limit)", () => {
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
    vi.restoreAllMocks();
  });

  it("opens Upload College Video modal without any Video URL input or 15 MB limit notice", () => {
    render(<CollegeVideosManage videos={[]} onRefresh={vi.fn().mockResolvedValue(undefined)} />);

    fireEvent.click(screen.getByRole("button", { name: /upload college video/i }));

    expect(screen.getByText(/upload video file/i)).toBeTruthy();
    expect(screen.queryByText(/max 15 mb/i)).toBeNull();
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

  it("uploads a small MP4 file directly via saveVideoAdminServerFn", async () => {
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

  it("accepts and chunk-uploads large videos (e.g., 60.7 MB) with no size limit error", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<CollegeVideosManage videos={[]} onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole("button", { name: /upload college video/i }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    // Simulate a 60.7 MB MP4 file without allocating 60 MB in jsdom RAM
    const bigSize = Math.round(60.7 * 1024 * 1024);
    const largeFile = new File(["mp4header"], "GNITS VIDEO.mp4", { type: "video/mp4" });
    Object.defineProperty(largeFile, "size", { value: bigSize });
    Object.defineProperty(largeFile, "slice", {
      value: () => new Blob([new Uint8Array(16)]),
    });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    expect(screen.queryByText(/exceeds the 15 mb/i)).toBeNull();
    expect(await screen.findByText(/selected: gnits video\.mp4/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /save college video/i }));

    await waitFor(() => {
      expect(mockSaveVideoAdminServerFn).toHaveBeenCalledTimes(1);
    });

    // Should have uploaded 25 chunks + 1 complete call = 26 fetch calls to /api/campus-video
    expect(fetchSpy).toHaveBeenCalledTimes(26);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("/api/campus-video?action=chunk");
    expect(String(fetchSpy.mock.calls[25]?.[0])).toContain("/api/campus-video?action=complete");

    const savedArg = mockSaveVideoAdminServerFn.mock.calls[0]?.[0] as {
      data: { title: string; video_url?: string };
    };
    expect(savedArg.data.title).toBe("GNITS VIDEO");
    expect(savedArg.data.video_url).toMatch(/^\/api\/campus-video\?id=vid-/);
  });

  it("sanitizes legacy broken video URLs and keeps valid uploaded data or stream URLs", () => {
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
    expect(
      sanitizeVideoRecord({ ...base, video_url: "/api/campus-video?id=vid-123" }).video_url,
    ).toBe("/api/campus-video?id=vid-123");
  });

  it("streams chunked videos from KV with auth enforcement and HTTP 206 Range support", async () => {
    process.env["ADMIN_SESSION_SECRET"] = "unit-test-video-stream-secret-12345";
    const { signSession, SESSION_COOKIE_NAME } = await import("@/lib/admin-session.server");
    const { handleCampusVideoRequest, parseByteRange } = await import(
      "@/lib/video-stream.server"
    );

    expect(parseByteRange("bytes=0-", 100)).toEqual({ start: 0, end: 99 });
    expect(parseByteRange("bytes=10-20", 100)).toEqual({ start: 10, end: 20 });
    expect(parseByteRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange("bytes=200-300", 100)).toBeNull();

    const kvMap = new Map<string, string | ArrayBuffer>();
    type Holder = { __env__?: Record<string, unknown> | undefined };
    const holder = globalThis as unknown as Holder;
    const prevEnv = holder.__env__;
    holder.__env__ = {
      KV: {
        get: async (key: string, type: string) => {
          const val = kvMap.get(key) ?? null;
          if (val === null) return null;
          if (type === "json" && typeof val === "string") return JSON.parse(val);
          return val;
        },
        put: async (key: string, value: string | ArrayBuffer | ArrayBufferView) => {
          if (typeof value === "string") {
            kvMap.set(key, value);
          } else if (value instanceof ArrayBuffer) {
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

    try {
      // Unauthenticated upload must return 401
      const unauthRes = await handleCampusVideoRequest(
        new Request("http://localhost/api/campus-video?action=chunk&id=vid_1&index=0&total=2", {
          method: "POST",
          body: new Uint8Array([1, 2, 3, 4]),
        }),
      );
      expect(unauthRes.status).toBe(401);

      // Authenticated admin chunk upload
      const token = await signSession("studentcouncil");
      const cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`;

      const chunk0 = new Uint8Array([10, 11, 12, 13, 14]);
      const chunk1 = new Uint8Array([20, 21, 22]);

      const r0 = await handleCampusVideoRequest(
        new Request(
          "http://localhost/api/campus-video?action=chunk&id=vid_1&index=0&total=2&size=8&chunkSize=5&type=video%2Fmp4",
          {
            method: "POST",
            headers: { Cookie: cookie },
            body: chunk0,
          },
        ),
      );
      expect(r0.status).toBe(200);

      const r1 = await handleCampusVideoRequest(
        new Request(
          "http://localhost/api/campus-video?action=chunk&id=vid_1&index=1&total=2&size=8&chunkSize=5&type=video%2Fmp4",
          {
            method: "POST",
            headers: { Cookie: cookie },
            body: chunk1,
          },
        ),
      );
      expect(r1.status).toBe(200);

      const rc = await handleCampusVideoRequest(
        new Request(
          "http://localhost/api/campus-video?action=complete&id=vid_1&total=2&size=8&chunkSize=5&type=video%2Fmp4&name=GNITS.mp4",
          {
            method: "POST",
            headers: { Cookie: cookie },
          },
        ),
      );
      expect(rc.status).toBe(200);

      // Range request across second chunk (bytes=5-7)
      const rangeRes = await handleCampusVideoRequest(
        new Request("http://localhost/api/campus-video?id=vid_1", {
          method: "GET",
          headers: { Range: "bytes=5-7" },
        }),
      );
      expect(rangeRes.status).toBe(206);
      expect(rangeRes.headers.get("Content-Range")).toBe("bytes 5-7/8");
      expect(rangeRes.headers.get("Accept-Ranges")).toBe("bytes");
      const bytes = new Uint8Array(await rangeRes.arrayBuffer());
      expect(Array.from(bytes)).toEqual([20, 21, 22]);

      // Out-of-bounds range returns 416
      const badRangeRes = await handleCampusVideoRequest(
        new Request("http://localhost/api/campus-video?id=vid_1", {
          method: "GET",
          headers: { Range: "bytes=50-60" },
        }),
      );
      expect(badRangeRes.status).toBe(416);
    } finally {
      if (prevEnv === undefined) {
        delete holder.__env__;
      } else {
        holder.__env__ = prevEnv;
      }
    }
  });
});
