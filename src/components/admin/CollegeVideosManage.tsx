import { useState, useRef } from "react";
import {
  Plus,
  Trash2,
  Edit,
  Upload,
  AlertCircle,
  Loader2,
  X,
  CheckCircle2,
  Film,
} from "lucide-react";
import {
  saveVideoAdminServerFn,
  deleteVideoAdminServerFn,
  setFeaturedVideoAdminServerFn,
} from "@/lib/homepage.functions";
import type { HomepageVideo } from "@/lib/local-homepage-store";
import { saveLocalVideoBlob, clearLocalVideoBlob } from "@/lib/video-storage";
import {
  saveClientVideo,
  deleteClientVideo,
} from "@/lib/client-portal-store";

interface CollegeVideosManageProps {
  videos: HomepageVideo[];
  onRefresh: () => Promise<void>;
}

const MAX_VIDEO_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read video file."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read video file."));
    reader.readAsDataURL(file);
  });
}

function isUsableVideoSource(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "/assets/campus_loop_video.mp4" || trimmed.includes("ForBiggerBlazes")) {
    return false;
  }
  return (
    trimmed.startsWith("data:video/") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  );
}

export function CollegeVideosManage({ videos, onRefresh }: CollegeVideosManageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<HomepageVideo | null>(null);

  // Form State: file upload only
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [videoBlobPreview, setVideoBlobPreview] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const videoFileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenAdd = () => {
    setEditingVideo(null);
    setVideoFile(null);
    setVideoFileName(null);
    setVideoBlobPreview(null);
    setError(null);
    setSuccessMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (v: HomepageVideo) => {
    setEditingVideo(v);
    setVideoFile(null);
    setVideoFileName(null);
    setVideoBlobPreview(isUsableVideoSource(v.video_url) ? v.video_url : null);
    setError(null);
    setSuccessMsg(null);
    setIsModalOpen(true);
  };

  const handleVideoFile = (file: File) => {
    const isVideoType =
      file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogg)$/i.test(file.name);
    if (!isVideoType) {
      setError("Please select a valid video file (MP4, WebM, or MOV).");
      return;
    }

    if (file.size > MAX_VIDEO_FILE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setError(
        `Video file is ${sizeMb} MB, which exceeds the 15 MB cloud upload limit. Please upload a smaller video file.`,
      );
      return;
    }

    setVideoFile(file);
    setVideoFileName(file.name);
    setError(null);

    if (videoBlobPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(videoBlobPreview);
    }
    const previewUrl = URL.createObjectURL(file);
    setVideoBlobPreview(previewUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const hasExistingValidVideo = Boolean(editingVideo && isUsableVideoSource(editingVideo.video_url));
    if (!videoFile && !hasExistingValidVideo) {
      setError("Please select a video file to upload.");
      return;
    }

    setSaving(true);

    try {
      if (videoFile) {
        const cleanTitle = videoFile.name.replace(/\.[^/.]+$/, "") || "GNITS Campus Video";
        const videoId = editingVideo?.id || `video-${Date.now()}`;
        const base64 = await readFileAsDataUrl(videoFile);

        await saveVideoAdminServerFn({
          data: {
            id: editingVideo ? editingVideo.id : undefined,
            title: cleanTitle,
            videoBase64: base64,
            videoFileName: videoFile.name,
            is_active: true,
            is_featured: true,
            display_order: 1,
          },
        });

        // Cache locally in IndexedDB as a companion copy for offline/fast playback
        await saveLocalVideoBlob(videoFile, videoFile.name);
        saveClientVideo({
          id: videoId,
          title: cleanTitle,
          description: "",
          video_url: base64.length < 500 * 1024 ? base64 : "",
          thumbnail_url: "",
          is_active: true,
          is_featured: true,
          display_order: 1,
          created_at: editingVideo?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } else if (editingVideo) {
        await saveVideoAdminServerFn({
          data: {
            id: editingVideo.id,
            title: editingVideo.title || "GNITS Campus Video",
            video_url: editingVideo.video_url,
            is_active: true,
            is_featured: true,
            display_order: editingVideo.display_order || 1,
          },
        });
      }

      await onRefresh();
      setSuccessMsg("College video saved successfully!");
      setTimeout(() => {
        setIsModalOpen(false);
      }, 1000);
    } catch (err: unknown) {
      console.error("Save video error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save video. Please try selecting a valid video file.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this video?")) return;
    try {
      deleteClientVideo(id);
      await clearLocalVideoBlob();

      await deleteVideoAdminServerFn({ data: { id } });
      await onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error deleting video.");
    }
  };

  const handleSetFeatured = async (id: string) => {
    try {
      const currentVid = videos.find((v) => v.id === id);
      if (currentVid) {
        saveClientVideo({ ...currentVid, is_featured: true });
      }
      await setFeaturedVideoAdminServerFn({ data: { id } });
      await onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error setting featured video.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            College Video for Dashboard
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Upload or update the campus loop video displayed on the Student Affairs portal.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] text-white px-5 py-2.5 text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Upload College Video</span>
        </button>
      </div>

      {/* Videos List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {videos.map((vid) => (
          <div
            key={vid.id}
            className={`rounded-2xl border bg-white p-4 shadow-xs flex flex-col justify-between transition-all ${
              vid.is_featured
                ? "border-emerald-500 ring-2 ring-emerald-100"
                : "border-slate-200"
            }`}
          >
            <div>
              {/* Video Player Preview */}
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black mb-3">
                {isUsableVideoSource(vid.video_url) ? (
                  <video
                    src={vid.video_url}
                    className="w-full h-full object-cover"
                    controls
                    preload="metadata"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                    Click Edit to upload a new video file
                  </div>
                )}
                {vid.is_featured && (
                  <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600 text-white shadow-xs pointer-events-none">
                    Active on Dashboard
                  </span>
                )}
              </div>

              <div className="text-xs font-semibold text-slate-700 truncate">
                {vid.title || "GNITS Campus Video"}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleSetFeatured(vid.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  vid.is_featured
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                }`}
              >
                <span>{vid.is_featured ? "Active on Dashboard" : "Set Active"}</span>
              </button>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(vid)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Replace video file"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(vid.id)}
                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Delete video"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Upload College Video Modal - File Upload Only */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Film className="h-5 w-5 text-blue-600" />
                <span>Upload College Video</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs border border-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              {/* Direct File Upload Box */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Upload Video File (MP4, WebM, MOV)
                </label>
                <div
                  onClick={() => videoFileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-blue-50/50 transition-all text-center group"
                >
                  <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="h-6 w-6" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">
                    {videoFileName ? videoFileName : "Click to Browse Video from Device"}
                  </span>
                  <span className="text-xs text-slate-500 mt-1">
                    Select any college MP4/WebM video file (max 15 MB)
                  </span>
                  <input
                    ref={videoFileInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleVideoFile(e.target.files[0]);
                      }
                    }}
                  />
                </div>
                {videoFileName && (
                  <p className="mt-2 text-xs text-emerald-600 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Selected: {videoFileName}</span>
                  </p>
                )}
              </div>

              {/* Instant Video Preview if selected */}
              {videoBlobPreview && (
                <div className="rounded-2xl overflow-hidden bg-black aspect-video border border-slate-200 shadow-inner">
                  <video
                    src={videoBlobPreview}
                    controls
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-[#0f172a] hover:bg-[#1e293b] rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving Video...</span>
                    </>
                  ) : (
                    <span>Save College Video</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
