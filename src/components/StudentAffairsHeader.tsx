import { Menu, ChevronsRight } from "lucide-react";
import { AnniversaryLogo } from "@/components/AnniversaryLogo";

interface StudentAffairsHeaderProps {
  onOpenDrawer: () => void;
}

export function StudentAffairsHeader({ onOpenDrawer }: StudentAffairsHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200 shadow-xs">
      <div className="w-full px-3 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between gap-3 sm:gap-6">
        {/* Left Side: Hamburger Menu + College Logo + Divider */}
        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
          {/* Hamburger button (3 lines) */}
          <button
            type="button"
            onClick={onOpenDrawer}
            aria-label="Open Available Events & Clubs Menu"
            className="p-2 sm:p-2.5 rounded-xl text-slate-800 hover:text-primary hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <Menu className="h-7 w-7 sm:h-8 sm:w-8 stroke-[2.5]" />
          </button>

          {/* College Logo (Circular Crest Badge) */}
          <div className="relative flex items-center justify-center">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full border-2 border-[#1e3a8a] bg-white flex flex-col items-center justify-center text-center p-1 shadow-xs">
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-tight text-[#1e3a8a] leading-none">
                College
              </span>
              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-tight text-[#1e3a8a] leading-none mt-0.5">
                Logo
              </span>
            </div>
          </div>

          {/* Vertical Divider */}
          <div className="h-9 sm:h-11 w-[1.5px] bg-slate-300 mx-1" />
        </div>

        {/* Center: Seamless Scrolling Welcome Message Banner */}
        <div className="flex-1 max-w-3xl min-w-0">
          <div className="relative bg-[#dbeafe]/70 hover:bg-[#dbeafe]/90 border border-[#bfdbfe] rounded-full py-1.5 sm:py-2 px-3 sm:px-6 flex items-center overflow-hidden shadow-xs">
            {/* Left Chevron indicator */}
            <div className="flex-shrink-0 text-[#1e3a8a] flex items-center pr-2 z-10 bg-[#dbeafe]/70">
              <ChevronsRight className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5]" />
            </div>

            {/* Seamless Continuous Scrolling Marquee Track */}
            <div className="relative flex-1 overflow-hidden">
              <div className="flex whitespace-nowrap animate-continuous-marquee">
                {/* Loop 1 */}
                <div className="flex items-center gap-12 pr-12">
                  <span className="text-xs sm:text-sm md:text-base font-bold text-[#1e3a8a] tracking-wide">
                    Welcome to Dean Student Affairs Portal
                  </span>
                  <span className="text-xs sm:text-sm md:text-base font-bold text-[#1e3a8a] tracking-wide">
                    &gt;&gt;
                  </span>
                </div>
                {/* Loop 2 (for seamless loop) */}
                <div className="flex items-center gap-12 pr-12">
                  <span className="text-xs sm:text-sm md:text-base font-bold text-[#1e3a8a] tracking-wide">
                    Welcome to Dean Student Affairs Portal
                  </span>
                  <span className="text-xs sm:text-sm md:text-base font-bold text-[#1e3a8a] tracking-wide">
                    &gt;&gt;
                  </span>
                </div>
                {/* Loop 3 */}
                <div className="flex items-center gap-12 pr-12">
                  <span className="text-xs sm:text-sm md:text-base font-bold text-[#1e3a8a] tracking-wide">
                    Welcome to Dean Student Affairs Portal
                  </span>
                  <span className="text-xs sm:text-sm md:text-base font-bold text-[#1e3a8a] tracking-wide">
                    &gt;&gt;
                  </span>
                </div>
              </div>
            </div>

            {/* Right Chevron indicator */}
            <div className="flex-shrink-0 text-[#1e3a8a] flex items-center pl-2 z-10 bg-[#dbeafe]/70">
              <ChevronsRight className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5]" />
            </div>
          </div>
        </div>

        {/* Extreme Right: 28 Years of Excellence Logo */}
        <div className="flex-shrink-0 pl-1 sm:pl-3">
          <AnniversaryLogo className="h-12 w-12 sm:h-16 sm:w-16" />
        </div>
      </div>
    </header>
  );
}
