import { useState } from "react";
import { X, Image as ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import type { HomepagePhoto } from "@/lib/local-homepage-store";

interface PhotoGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  photos: HomepagePhoto[];
}

export function PhotoGalleryModal({ isOpen, onClose, photos }: PhotoGalleryModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const categories = ["All", "Campus", "Events", "Clubs", "Academic", "Sports"];

  const filteredPhotos =
    selectedCategory === "All"
      ? photos
      : photos.filter((p) => p.category.toLowerCase() === selectedCategory.toLowerCase());

  const handleNextPhoto = () => {
    if (activePhotoIndex === null) return;
    setActivePhotoIndex((prev) => ((prev! + 1) % filteredPhotos.length));
  };

  const handlePrevPhoto = () => {
    if (activePhotoIndex === null) return;
    setActivePhotoIndex((prev) => (prev! - 1 + filteredPhotos.length) % filteredPhotos.length);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#0f172a] text-white">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 leading-tight">
                GNITS Campus & Student Gallery
              </h3>
              <p className="text-xs text-slate-500">
                Explore moments from Student Affairs, campus events, and student clubs
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-2 overflow-x-auto bg-white">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? "bg-[#0f172a] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
          <span className="text-xs text-slate-400 ml-auto font-medium">
            {filteredPhotos.length} {filteredPhotos.length === 1 ? "photo" : "photos"}
          </span>
        </div>

        {/* Gallery Grid */}
        <div className="p-6 overflow-y-auto flex-1 min-h-[300px]">
          {filteredPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <ImageIcon className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm font-semibold">No photos in this category yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {filteredPhotos.map((photo, idx) => (
                <div
                  key={photo.id}
                  onClick={() => setActivePhotoIndex(idx)}
                  className="group relative rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-slate-200">
                    <img
                      src={photo.image_url}
                      alt={photo.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-3.5 bg-white flex flex-col justify-between flex-1">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
                          {photo.category}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(photo.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors line-clamp-1">
                        {photo.title}
                      </h4>
                      {photo.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {photo.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Lightbox View if photo clicked */}
      {activePhotoIndex !== null && filteredPhotos[activePhotoIndex] && (
        <div className="fixed inset-0 z-60 bg-black/95 flex flex-col items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setActivePhotoIndex(null)}
            className="absolute top-4 right-4 text-white p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="h-8 w-8" />
          </button>

          <div className="relative max-w-4xl max-h-[75vh] flex items-center justify-center">
            <img
              src={filteredPhotos[activePhotoIndex]!.image_url}
              alt={filteredPhotos[activePhotoIndex]!.title}
              className="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />

            {/* Prev Button */}
            {filteredPhotos.length > 1 && (
              <button
                type="button"
                onClick={handlePrevPhoto}
                className="absolute left-2 text-white bg-black/50 p-2 rounded-full hover:bg-black/80 transition-colors"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            {/* Next Button */}
            {filteredPhotos.length > 1 && (
              <button
                type="button"
                onClick={handleNextPhoto}
                className="absolute right-2 text-white bg-black/50 p-2 rounded-full hover:bg-black/80 transition-colors"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>

          <div className="mt-4 text-center max-w-lg">
            <h4 className="text-base font-bold text-white">
              {filteredPhotos[activePhotoIndex]!.title}
            </h4>
            <p className="text-xs text-slate-300 mt-1">
              {filteredPhotos[activePhotoIndex]!.description}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
