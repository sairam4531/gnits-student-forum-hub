import { useState, useRef, useEffect } from "react";
import { AnniversaryLogo } from "@/components/AnniversaryLogo";
import { GnitsCollegeLogo } from "@/components/GnitsCollegeLogo";

interface StudentAffairsHeaderProps {
  onOpenDrawer: () => void;
  title?: string;
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

  // Frame-by-frame animation: One title scrolls from right to left.
  // When "Welcome" touches the left logo (x <= 0), the next title starts from the right side.
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      let dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Prevent sudden jumps if browser tab is backgrounded
      if (dt > 0.1) dt = 0.1;

      const speed = 85; // pixels per second - readable, elegant pace
      const cWidth = containerWidthRef.current;
      const tWidth = textWidthRef.current;

      if (cWidth > 0 && tWidth > 0) {
        setMessages((prev) => {
          let needsSpawn = false;

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

          const updated = prev.map((msg) => {
            const nextX = msg.x - speed * dt;
            let triggered = msg.triggered;

            // When the front word "Welcome" reaches / touches the left logo (x <= 0)
            if (!triggered && nextX <= 0) {
              triggered = true;
              needsSpawn = true;
            }

            return {
              ...msg,
              x: nextX,
              triggered,
            };
          });

          // Filter out items that have completely slid past the left logo
          const remaining = updated.filter((msg) => msg.x > -tWidth - 10);

          // When front touched the logo, spawn the next scroll from the right boundary
          if (needsSpawn) {
            idCounterRef.current += 1;
            remaining.push({
              id: idCounterRef.current,
              x: cWidth,
              triggered: false,
            });
          }

          return remaining;
        });
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

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
          <div className="h-13 w-13 sm:h-16 sm:w-16 flex items-center justify-center flex-shrink-0">
            <GnitsCollegeLogo className="h-full w-full" />
          </div>
        </div>

        {/* Center: Heading Scrolling one after one from Right to Left till Logo */}
        <div
          ref={containerRef}
          className="flex-1 min-w-0 overflow-hidden relative h-full flex items-center"
        >
          {/* Invisible text element used for exact responsive measurement */}
          <span
            ref={textMeasureRef}
            className="absolute invisible pointer-events-none whitespace-nowrap text-base sm:text-xl md:text-2xl font-black tracking-wide"
            aria-hidden="true"
          >
            {title}
          </span>

          {/* Scrolling Messages - Single title scrolling across one after one */}
          {messages.map((item) => (
            <div
              key={item.id}
              style={{
                transform: `translate3d(${item.x}px, 0, 0)`,
              }}
              className="absolute whitespace-nowrap text-base sm:text-xl md:text-2xl font-black text-black tracking-wide drop-shadow-xs will-change-transform pointer-events-none"
            >
              {title}
            </div>
          ))}
        </div>

        {/* Right Boundary: 28 Years of Excellence Logo */}
        <div className="flex-shrink-0 z-20 bg-[#2563eb] pl-2 flex items-center justify-center">
          <div className="h-13 w-13 sm:h-16 sm:w-16 flex items-center justify-center flex-shrink-0">
            <AnniversaryLogo className="h-full w-full" />
          </div>
        </div>
      </div>
    </header>
  );
}
