import { useState, useRef, useEffect } from "react";
import { AnniversaryLogo } from "@/components/AnniversaryLogo";
import { GnitsCollegeLogo } from "@/components/GnitsCollegeLogo";

interface StudentAffairsHeaderProps {
  onOpenDrawer: () => void;
  title?: string | undefined;
}

interface ScrollingItem {
  id: number;
  x: number;
  triggered: boolean;
}

export function StudentAffairsHeader({
  onOpenDrawer,
  title = "Welcome to Dean Student Affairs Portal",
}: StudentAffairsHeaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textMeasureRef = useRef<HTMLSpanElement>(null);

  const [messages, setMessages] = useState<ScrollingItem[]>([]);
  const containerWidthRef = useRef<number>(0);
  const textWidthRef = useRef<number>(0);
  const idCounterRef = useRef<number>(0);

  // Measure container and text width dynamically across screen sizes
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        containerWidthRef.current = containerRef.current.clientWidth;
      }
      if (textMeasureRef.current) {
        textWidthRef.current = textMeasureRef.current.offsetWidth;
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    if (textMeasureRef.current) {
      resizeObserver.observe(textMeasureRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [title]);

  // Reset messages when title changes
  useEffect(() => {
    setMessages([]);
    idCounterRef.current = 0;
  }, [title]);

  // Frame-by-frame marquee animation: smooth right-to-left scrolling with guaranteed spacing
  // Prevents text overlapping or premature clipping on any screen width (desktop, tablet, mobile).
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      let dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Prevent sudden jumps if browser tab is backgrounded
      if (dt > 0.1) dt = 0.1;

      const speed = 80; // pixels per second - comfortable, readable pace
      const cWidth = containerWidthRef.current;
      const tWidth = textWidthRef.current;

      if (cWidth > 0 && tWidth > 0) {
        const minGap = Math.max(96, Math.round(cWidth * 0.15));

        setMessages((prev) => {
          // If no messages exist yet, spawn the initial one from the right edge
          if (prev.length === 0) {
            idCounterRef.current += 1;
            return [
              {
                id: idCounterRef.current,
                x: cWidth,
                triggered: false,
              },
            ];
          }

          // Advance all active messages to the left
          const updated = prev.map((msg) => ({
            ...msg,
            x: msg.x - speed * dt,
          }));

          // Check if rightmost message has advanced enough to spawn the next title
          const lastMsg = updated[updated.length - 1];
          const canSpawn = lastMsg && lastMsg.x + tWidth + minGap <= cWidth;

          if (canSpawn) {
            idCounterRef.current += 1;
            updated.push({
              id: idCounterRef.current,
              x: cWidth,
              triggered: false,
            });
          }

          // Filter out items that have completely slid past the left logo
          return updated.filter((msg) => msg.x + tWidth > -30);
        });
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-white text-slate-900 border-b border-slate-200 shadow-sm select-none">
      <div className="w-full px-2 sm:px-4 lg:px-6 h-18 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left Boundary: Hamburger Menu (Three Lines) + GNITS College Logo */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 z-20 bg-white pr-1 sm:pr-2">
          {/* Hamburger button (three horizontal lines) */}
          <button
            type="button"
            onClick={onOpenDrawer}
            aria-label="Open Available Events & Clubs Menu"
            className="p-1.5 sm:p-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 cursor-pointer flex-shrink-0"
            title="Available Events & Clubs"
          >
            <div className="flex flex-col gap-1.5 justify-center items-center w-7 sm:w-8 py-1">
              <span className="block h-1 w-6 sm:w-7 bg-black rounded-full" />
              <span className="block h-1 w-6 sm:w-7 bg-black rounded-full" />
              <span className="block h-1 w-6 sm:w-7 bg-black rounded-full" />
            </div>
          </button>

          {/* Official GNITS College Logo */}
          <div className="h-13 w-13 sm:h-16 sm:w-16 flex items-center justify-center flex-shrink-0">
            <GnitsCollegeLogo className="h-full w-full" />
          </div>
        </div>

        {/* Center: Heading Scrolling smoothly from Right to Left between Logos */}
        <div
          ref={containerRef}
          className="flex-1 min-w-0 overflow-hidden relative h-full flex items-center"
          style={{
            maskImage:
              "linear-gradient(to right, transparent 0%, black 16px, black calc(100% - 16px), transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, black 16px, black calc(100% - 16px), transparent 100%)",
          }}
        >
          {/* Invisible text element used for exact responsive measurement */}
          <span
            ref={textMeasureRef}
            className="absolute invisible pointer-events-none whitespace-nowrap text-base sm:text-xl md:text-2xl font-black tracking-wide"
            aria-hidden="true"
          >
            {title}
          </span>

          {/* Scrolling Messages - Single title scrolling across with comfortable spacing */}
          {messages.map((item) => (
            <div
              key={item.id}
              style={{
                transform: `translate3d(${item.x}px, -50%, 0)`,
                top: "50%",
              }}
              className="absolute whitespace-nowrap text-base sm:text-xl md:text-2xl font-black text-black tracking-wide drop-shadow-xs will-change-transform pointer-events-none select-none"
            >
              {title}
            </div>
          ))}
        </div>

        {/* Right Boundary: 28 Years of Excellence Logo */}
        <div className="flex-shrink-0 z-20 bg-white pl-1 sm:pl-2 flex items-center justify-center">
          <div className="h-13 w-13 sm:h-16 sm:w-16 flex items-center justify-center flex-shrink-0">
            <AnniversaryLogo className="h-full w-full" />
          </div>
        </div>
      </div>
    </header>
  );
}
