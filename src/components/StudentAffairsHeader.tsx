import { Menu } from "lucide-react";
import { AnniversaryLogo } from "@/components/AnniversaryLogo";
import { GnitsCollegeLogo } from "@/components/GnitsCollegeLogo";

interface StudentAffairsHeaderProps {
  onOpenDrawer: () => void;
}

export function StudentAffairsHeader({ onOpenDrawer }: StudentAffairsHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#2563eb] text-white border-b-2 border-blue-700/80 shadow-md select-none">
      <div className="w-full px-2 sm:px-4 lg:px-6 h-18 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left Boundary: Hamburger Menu (Three Lines) + GNITS College Logo */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 z-20 bg-[#2563eb] pr-2">
          {/* Hamburger button (three horizontal lines) */}
          <button
            type="button"
            onClick={onOpenDrawer}
            aria-label="Open Available Events & Clubs Menu"
            className="p-1.5 sm:p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer"
            title="Available Events & Clubs"
          >
            <div className="flex flex-col gap-1.5 justify-center items-center w-7 sm:w-8 py-1">
              <span className="block h-1 w-6 sm:w-7 bg-black rounded-full" />
              <span className="block h-1 w-6 sm:w-7 bg-black rounded-full" />
              <span className="block h-1 w-6 sm:w-7 bg-black rounded-full" />
            </div>
          </button>

          {/* Official GNITS College Logo */}
          <div className="h-13 w-13 sm:h-16 sm:w-16 flex items-center justify-center">
            <GnitsCollegeLogo className="h-full w-full" />
          </div>
        </div>

        {/* Center: Heading Scrolling from Right to Left till Logos */}
        <div className="flex-1 min-w-0 overflow-hidden relative h-full flex items-center">
          <div className="w-full overflow-hidden whitespace-nowrap">
            <div className="inline-block animate-header-marquee will-change-transform">
              <span className="text-base sm:text-xl md:text-2xl font-black text-black tracking-wide drop-shadow-xs px-8">
                Welcome to Dean Student Affairs Portal
              </span>
              <span className="text-base sm:text-xl md:text-2xl font-black text-black tracking-wide drop-shadow-xs px-8">
                Welcome to Dean Student Affairs Portal
              </span>
              <span className="text-base sm:text-xl md:text-2xl font-black text-black tracking-wide drop-shadow-xs px-8">
                Welcome to Dean Student Affairs Portal
              </span>
            </div>
          </div>
        </div>

        {/* Right Boundary: 28 Years of Excellence Logo */}
        <div className="flex-shrink-0 z-20 bg-[#2563eb] pl-2">
          <AnniversaryLogo className="h-13 w-13 sm:h-16 sm:w-16" />
        </div>
      </div>
    </header>
  );
}
