import { useState, useRef } from "react";
import {
  Video as VideoIcon,
  Plus,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  Star,
  Play,
  Upload,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import {
  saveVideoAdminServerFn,
  deleteVideoAdminServerFn,
  setFeaturedVideoAdminServerFn,
} from "@/lib/homepage.functions";
import type { HomepageVideo } from "@/lib/local-homepage-store";

interface CollegeVideosManageProps {
  videos: HomepageVideo[];
  onRefresh: () => Promise<void>;
}

export function CollegeVideosManage({ videos, onRefresh }: CollegeVideosManageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<HomepageVideo | null>(null);
  const [previewingVideo, setPreviewingVideo] = useState<HomepageVideo | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [displayOrder, setDisplayOrder] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(true);

  // Media upload state
  const [videoBase64, setVideoBase64] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [thumbnailBase64, setThumbnailBase64] = useState<string | null>(null);
  const [thumbnailFileName, setThumbnailFileName] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const thumbFileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenAdd = () => {
    setEditingVideo(null);
    setTitle("");
    setDescription("");
    setVideoUrl("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4");
    setThumbnailUrl("/assets/student-affairs-reference.jpg");
    setDisplayOrder(videos.length + 1);
    setIsActive(true);
    setIsFeatured(videos.length === 0);
    setVideoBase64(null);
    setVideoFileName(null);
    setThumbnailBase64(null);
    setThumbnailFileName(null);
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (v: HomepageVideo) => {
    setEditingVideo(v);
    setTitle(v.title);
    setDescription(v.description || "");
    setVideoUrl(v.video_url);
    setThumbnailUrl(v.thumbnail_url || "");
    setDisplayOrder(v.display_order);
    setIsActive(v.is_active);
    setIsFeatured(v.is_featured);
    setVideoBase64(null);
    setVideoFileName(null);
    setThumbnailBase64(null);
    setThumbnailFileName(null);
    setError(null);
    setIsModalOpen(true);
  };

  const handleVideoFile = (file: File) => {
    setVideoFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setVideoBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleThumbnailFile = (file: File) => {
    setThumbnailFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setThumbnailBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await saveVideoAdminServerFn({
        data: {
          id: editingVideo?.id,
          title: title.trim(),
          description: description.trim(),
          video_url: videoUrl.trim() || undefined,
          videoBase64: videoBase64 || undefined,
          videoFileName: videoFileName || undefined,
          thumbnail_url: thumbnailUrl.trim() || undefined,
          thumbnailBase64: thumbnailBase64 || undefined,
          thumbnailFileName: thumbnailFileName || undefined,
          is_active: isActive,
          is_featured: isFeatured,
          display_order: Number(displayOrder),
        },
      });

      await onRefresh();
      setIsModalOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save video.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this video?")) return;
    try {
      await deleteVideoAdminServerFn({ data: { id } });
      await onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error deleting video.");
    }
  };

  const handleSetFeatured = async (id: string) => {
    try {
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
            College Video Management
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Upload campus and student affair videos, custom thumbnails, and select which video is featured on the homepage.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] text-white px-4 py-2.5 text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Video</span>
        </button>
      </div>

      {/* Videos List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {videos.map((vid) => (
          <div
            key={vid.id}
            className={`rounded-2xl border bg-white p-4 shadow-xs flex flex-col justify-between transition-all ${
              vid.is_featured
                ? "border-amber-400 ring-2 ring-amber-100"
                : vid.is_active
                  ? "border-slate-200"
                  : "border-slate-200 opacity-60 bg-slate-50"
            }`}
          >
            <div>
              {/* Thumbnail with Play Preview Button */}
              <div
                onClick={() => setPreviewingVideo(vid)}
                className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 mb-3 cursor-pointer group"
              >
                <img
                  src={vid.thumbnail_url || "/assets/student-affairs-reference.jpg"}
                  alt={vid.title}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="h-12 w-12 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play className="h-6 w-6 fill-current ml-0.5" />
                  </div>
                </div>

                {vid.is_featured && (
                  <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                    ★ Featured on Homepage
                  </span>
                )}
              </div>

              {/* Title & Description */}
              <h4 className="text-base font-bold text-slate-900">{vid.title}</h4>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                {vid.description || "No description provided."}
              </p>

              <div className="text-[11px] text-slate-400 mt-2 truncate font-mono">
                Source: {vid.video_url}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleSetFeatured(vid.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  vid.is_featured
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700"
                }`}
              >
                <Star className={`h-3.5 w-3.5 ${vid.is_featured ? "fill-amber-500 text-amber-500" : ""}`} />
                <span>{vid.is_featured ? "Featured Video" : "Set as Featured"}</span>
              </button>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(vid)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(vid.id)}
                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Video Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-black text-slate-900 pb-3 border-b border-slate-100">
              {editingVideo ? "Edit Video Details" : "Upload or Add College Video"}
            </h3>

            {error && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Video Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. GNITS Campus Tour & Cultural Highlights"
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Overview of the video content..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
                />
              </div>

              {/* Video Source (File or URL) */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Video Source (Upload MP4/WebM or Video URL)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://.../video.mp4"
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
                  />
                  <button
                    type="button"
                    onClick={() => videoFileInputRef.current?.click()}
                    className="px-3 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Browse</span>
                  </button>
                  <input
                    ref={videoFileInputRef}
                    type="file"
                    accept="video/mp4,video/webm"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleVideoFile(e.target.files[0]);
                      }
                    }}
                  />
                </div>
                {videoFileName && (
                  <p className="text-[11px] text-emerald-600 font-semibold">
                    ✓ Video selected: {videoFileName}
                  </p>
                )}
              </div>

              {/* Thumbnail Poster */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Custom Thumbnail Poster (JPG/PNG)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                    placeholder="/assets/campus-preview.jpg or URL"
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
                  />
                  <button
                    type="button"
                    onClick={() => thumbFileInputRef.current?.click()}
                    className="px-3 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload</span>
                  </button>
                  <input
                    ref={thumbFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleThumbnailFile(e.target.files[0]);
                      }
                    }}
                  />
                </div>
                {thumbnailFileName && (
                  <p className="text-[11px] text-emerald-600 font-semibold">
                    ✓ Poster image selected: {thumbnailFileName}
                  </p>
                )}
              </div>

              {/* Options */}
              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded text-[#0f172a]"
                  />
                  <span className="text-xs font-semibold text-slate-700">Active</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="rounded text-amber-500"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Feature on Homepage Video Card
                  </span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-xl shadow-xs disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingVideo ? "Save Changes" : "Save Video"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Video Preview Modal */}
      {previewingVideo && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-3xl bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/20">
            <button
              type="button"
              onClick={() => setPreviewingVideo(null)}
              className="absolute top-3 right-3 z-30 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <video
              src={previewingVideo.video_url}
              poster={previewingVideo.thumbnail_url}
              controls
              autoPlay
              className="w-full aspect-video"
            />
            <div className="p-4 bg-slate-900 text-white">
              <h4 className="text-sm font-bold">{previewingVideo.title}</h4>
              <p className="text-xs text-slate-400 mt-0.5">{previewingVideo.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
