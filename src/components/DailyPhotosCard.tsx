import { Camera, ArrowRight } from "lucide-react";
import type { HomepagePhoto } from "@/lib/local-homepage-store";

interface DailyPhotosCardProps {
  photos: HomepagePhoto[];
  onOpenGallery: () => void;
}

export function DailyPhotosCard({ photos, onOpenGallery }: DailyPhotosCardProps) {
  // Grab top 2 photos for polaroid stack
  const photo1 = photos[0] || {
    id: "default-1",
    title: "Sunrise Campus Vista",
    image_url: "/assets/student-forum-dance-01.jpg",
  };
  const photo2 = photos[1] || {
    id: "default-2",
    title: "Green Campus Quad",
    image_url: "/assets/student-forum-team-02.webp",
  };

  return (
    <div className="relative rounded-3xl bg-gradient-to-br from-white/95 via-white/90 to-blue-50/80 backdrop-blur-md p-6 sm:p-7 border border-white/80 shadow-xl flex flex-col justify-between overflow-hidden min-h-[300px] sm:min-h-[340px] md:min-h-[360px]">
      {/* Top Left: Camera Icon and Heading */}
      <div className="z-10 relative">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#0f172a] text-white shadow-md">
          <Camera className="h-6 w-6 stroke-[2.2]" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-[#0f172a] leading-tight tracking-tight mt-3">
          Daily
          <br />
          Photos
        </h2>
      </div>

      {/* Polaroid Tilted Photos Stack (Right Side of Card) */}
      <div className="absolute right-4 sm:right-6 top-8 sm:top-10 w-44 sm:w-56 h-48 sm:h-56 pointer-events-none select-none">
        {/* Back Photo (Tilted Right) */}
        <div className="absolute right-0 top-6 sm:top-8 w-28 sm:w-36 aspect-[4/3] rotate-[8deg] rounded-md bg-white p-1.5 shadow-xl border border-slate-200 transition-transform duration-300">
          <img
            src={photo2.image_url}
            alt={photo2.title}
            className="h-full w-full object-cover rounded-xs"
            loading="lazy"
          />
        </div>

        {/* Front Photo (Tilted Left, Overlapping) */}
        <div className="absolute left-2 sm:left-4 top-0 w-32 sm:w-40 aspect-[4/3] -rotate-[6deg] rounded-md bg-white p-1.5 shadow-2xl border border-slate-200 transition-transform duration-300 hover:rotate-0">
          <img
            src={photo1.image_url}
            alt={photo1.title}
            className="h-full w-full object-cover rounded-xs"
            loading="lazy"
          />
        </div>
      </div>

      {/* Bottom Button: View Gallery → */}
      <div className="z-10 mt-6 pt-2">
        <button
          type="button"
          onClick={onOpenGallery}
          className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] hover:bg-[#1e293b] text-white px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#0f172a]/30 active:scale-95 cursor-pointer"
        >
          <span>View Gallery</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
