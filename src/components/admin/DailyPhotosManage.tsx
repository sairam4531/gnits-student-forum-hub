import { useState, useRef } from "react";
import {
  Upload,
  Plus,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  Star,
  StarOff,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  savePhotoAdminServerFn,
  deletePhotoAdminServerFn,
  togglePhotoStatusServerFn,
} from "@/lib/homepage.functions";
import type { HomepagePhoto } from "@/lib/local-homepage-store";

interface DailyPhotosManageProps {
  photos: HomepagePhoto[];
  onRefresh: () => Promise<void>;
}

export function DailyPhotosManage({ photos, onRefresh }: DailyPhotosManageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<HomepagePhoto | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Campus");
  const [displayOrder, setDisplayOrder] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  // File Upload State
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = ["Campus", "Events", "Clubs", "Academic", "Sports"];

  const handleOpenAdd = () => {
    setEditingPhoto(null);
    setTitle("");
    setDescription("");
    setCategory("Campus");
    setDisplayOrder(photos.length + 1);
    setIsActive(true);
    setIsFeatured(false);
    setImageBase64(null);
    setImageFileName(null);
    setImagePreviewUrl(null);
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (photo: HomepagePhoto) => {
    setEditingPhoto(photo);
    setTitle(photo.title);
    setDescription(photo.description || "");
    setCategory(photo.category || "Campus");
    setDisplayOrder(photo.display_order);
    setIsActive(photo.is_active);
    setIsFeatured(photo.is_featured);
    setImageBase64(null);
    setImageFileName(null);
    setImagePreviewUrl(photo.image_url);
    setError(null);
    setIsModalOpen(true);
  };

  const handleFileProcess = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, WebP).");
      return;
    }
    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setImageBase64(b64);
      setImagePreviewUrl(b64);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      if (!editingPhoto && !imageBase64 && !imagePreviewUrl) {
        throw new Error("Please select an image to upload.");
      }

      await savePhotoAdminServerFn({
        data: {
          id: editingPhoto?.id,
          title: title.trim(),
          description: description.trim(),
          category,
          is_active: isActive,
          is_featured: isFeatured,
          display_order: Number(displayOrder),
          image_url: editingPhoto?.image_url,
          imageBase64: imageBase64 || undefined,
          imageFileName: imageFileName || undefined,
        },
      });

      await onRefresh();
      setIsModalOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save photo.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this photo?")) return;
    try {
      await deletePhotoAdminServerFn({ data: { id } });
      await onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error deleting photo.");
    }
  };

  const handleToggle = async (id: string, field: "is_active" | "is_featured", currentVal: boolean) => {
    try {
      await togglePhotoStatusServerFn({
        data: { id, field, value: !currentVal },
      });
      await onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error updating status.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Add Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Daily Photos Management
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Upload, categorize, and choose which photos appear in the Daily Photos card on the homepage.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] text-white px-4 py-2.5 text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Photo</span>
        </button>
      </div>

      {/* Photos Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className={`rounded-2xl border bg-white p-3.5 shadow-xs flex flex-col justify-between transition-all ${
              photo.is_featured
                ? "border-blue-400 ring-2 ring-blue-100"
                : photo.is_active
                  ? "border-slate-200"
                  : "border-slate-200 opacity-60 bg-slate-50"
            }`}
          >
            <div>
              {/* Photo Preview Container */}
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 mb-3 border border-slate-100">
                <img
                  src={photo.image_url}
                  alt={photo.title}
                  className="h-full w-full object-cover"
                />

                {/* Badges Overlay */}
                <div className="absolute top-2 left-2 flex gap-1">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-black/70 text-white backdrop-blur-xs">
                    {photo.category}
                  </span>
                </div>

                <div className="absolute top-2 right-2 flex gap-1">
                  {photo.is_featured && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                      ★ Featured
                    </span>
                  )}
                  {!photo.is_active && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-600 text-white shadow-xs">
                      Disabled
                    </span>
                  )}
                </div>
              </div>

              {/* Title & Description */}
              <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{photo.title}</h4>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                {photo.description || "No description provided."}
              </p>

              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100">
                <span>Order: #{photo.display_order}</span>
                <span>{new Date(photo.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100">
              <div className="flex items-center gap-1">
                {/* Active Toggle */}
                <button
                  type="button"
                  title={photo.is_active ? "Disable Photo" : "Enable Photo"}
                  onClick={() => handleToggle(photo.id, "is_active", photo.is_active)}
                  className={`p-1.5 rounded-lg text-xs transition-colors ${
                    photo.is_active
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {photo.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>

                {/* Featured Toggle */}
                <button
                  type="button"
                  title={photo.is_featured ? "Remove from Homepage Stack" : "Feature on Homepage Stack"}
                  onClick={() => handleToggle(photo.id, "is_featured", photo.is_featured)}
                  className={`p-1.5 rounded-lg text-xs transition-colors ${
                    photo.is_featured
                      ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {photo.is_featured ? <Star className="h-4 w-4 fill-amber-500" /> : <StarOff className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex items-center gap-1">
                {/* Edit */}
                <button
                  type="button"
                  onClick={() => handleOpenEdit(photo)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => handleDelete(photo.id)}
                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Upload & Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 pb-3 border-b border-slate-100">
              {editingPhoto ? "Edit Photo Details" : "Upload New Daily Photo"}
            </h3>

            {error && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Drag and drop image upload area */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Photo File (JPG, PNG, WebP)
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`cursor-pointer rounded-2xl border-2 border-dashed p-4 text-center transition-all flex flex-col items-center justify-center min-h-[140px] ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : imagePreviewUrl
                        ? "border-emerald-300 bg-emerald-50/30"
                        : "border-slate-200 hover:border-slate-300 bg-slate-50"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileProcess(e.target.files[0]);
                      }
                    }}
                  />

                  {imagePreviewUrl ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={imagePreviewUrl}
                        alt="Preview"
                        className="h-16 w-24 object-cover rounded-lg border border-slate-200 shadow-xs"
                      />
                      <div className="text-left">
                        <span className="text-xs font-bold text-slate-800 line-clamp-1">
                          {imageFileName || "Selected Image"}
                        </span>
                        <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                          ✓ Ready to upload. Click to replace.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-slate-400 mb-2" />
                      <p className="text-xs font-bold text-slate-700">
                        Drag & Drop photo here, or click to browse
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        High-resolution JPG, PNG, or WebP up to 15MB
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Photo Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Annual Fest Stage Celebrations"
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief note about the event, participants, or scene..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
                />
              </div>

              {/* Category & Order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 1)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
                  />
                </div>
              </div>

              {/* Checkboxes: Active & Featured */}
              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded text-[#0f172a] focus:ring-0"
                  />
                  <span className="text-xs font-semibold text-slate-700">Active (Public)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-0"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Feature on Homepage Stack
                  </span>
                </label>
              </div>

              {/* Form Buttons */}
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
                  <span>{editingPhoto ? "Save Changes" : "Upload Photo"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
