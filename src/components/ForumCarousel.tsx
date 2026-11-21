import { Sparkles, Video } from "lucide-react";
import { useState } from "react";

interface CarouselSlide {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  badge: string;
  primaryUrl: string;
  fallbackUrl: string;
}

const FORUM_SLIDES: CarouselSlide[] = [
  {
    id: "dance-01",
    title: "Nrityastra & Samskruthi Dance Showcase",
    subtitle: "Traditional & contemporary choreography celebrating cultural heritage",
    category: "Cultural Wing",
    badge: "01 • Cultural Fest",
    primaryUrl: "/assets/student-forum-dance-01.jpg",
    fallbackUrl:
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "team-02",
    title: "Technical Forums Steering Committee",
    subtitle: "Student leaders driving ISTE, IEEE, CSI, and technical symposiums",
    category: "Technical Wing",
    badge: "02 • Tech Innovation",
    primaryUrl: "/assets/student-forum-team-02.webp",
    fallbackUrl:
      "https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "team-03",
    title: "GNITS Student Council Collaboration",
    subtitle: "Empowering women leaders across academic research and outreach cells",
    category: "Student Council",
    badge: "03 • Leadership",
    primaryUrl: "/assets/student-forum-team-03.webp",
    fallbackUrl:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "stage-04",
    title: "Annual Auditorium Stage Spectacular",
    subtitle: "Lighting up the main campus auditorium with electrifying performances",
    category: "Stage & Arts",
    badge: "04 • Grand Stage",
    primaryUrl: "/assets/student-forum-stage-04.webp",
    fallbackUrl:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "dance-05",
    title: "Artistic Expression & Talantia Finale",
    subtitle: "Honoring champions of inter-collegiate competitions and social causes",
    category: "Outreach & Cells",
    badge: "05 • Celebration",
    primaryUrl: "/assets/student-forum-dance-05.webp",
    fallbackUrl:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop",
  },
];

export function ForumCarousel() {
  const [activeSlide, setActiveSlide] = useState<CarouselSlide | null>(null);

  // Duplicating the slides array creates a seamless infinite looping marquee
  const loopedSlides = [...FORUM_SLIDES, ...FORUM_SLIDES];

  return (
    <section
      aria-label="Student Forum Highlights Video Reel"
      className="relative w-full overflow-hidden bg-gradient-to-b from-primary/5 via-card to-background py-5 border-y border-border/70 shadow-inner"
    >
      {/* Decorative ambiance bar */}
      <div className="mx-auto max-w-7xl px-4 pb-3 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary border border-primary/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          <Video className="h-3.5 w-3.5" />
          <span>CAMPUS LIFE HIGHLIGHTS REEL</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span>Scrolls automatically • Hover to pause</span>
        </div>
      </div>

      {/* Infinite Marquee Track with Smooth Momentum */}
      <div className="forum-marquee relative w-full overflow-hidden">
        <div className="forum-marquee-track flex gap-4 sm:gap-6 w-max pl-4">
          {loopedSlides.map((slide, index) => (
            <div
              key={`${slide.id}-${index}`}
              onClick={() => setActiveSlide(slide)}
              className="group relative h-48 w-72 sm:h-60 sm:w-88 flex-shrink-0 cursor-pointer overflow-hidden rounded-xl border border-border/80 bg-muted/30 shadow-md transition-all duration-300 hover:border-primary/50 hover:shadow-xl hover:scale-[1.02]"
            >
              {/* Image with fallback resilience */}
              <img
                src={slide.primaryUrl}
                alt={slide.title}
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src !== slide.fallbackUrl) {
                    target.src = slide.fallbackUrl;
                  }
                }}
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
                loading="lazy"
              />

              {/* Gradient Scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10 transition-opacity group-hover:opacity-90" />

              {/* Top Badge */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-2.5 py-0.5 text-[11px] font-semibold text-white/90 border border-white/10">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                <span>{slide.badge}</span>
              </div>

              {/* Bottom Caption */}
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent/90">
                  {slide.category}
                </span>
                <h4 className="line-clamp-1 text-sm font-semibold text-white drop-shadow-sm group-hover:text-primary-foreground">
                  {slide.title}
                </h4>
                <p className="line-clamp-1 text-xs text-white/70 drop-shadow-sm">
                  {slide.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox Modal when a slide is tapped */}
      {activeSlide && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveSlide(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl w-full overflow-hidden rounded-2xl bg-card border border-border shadow-2xl"
          >
            <div className="relative aspect-video w-full overflow-hidden bg-black">
              <img
                src={activeSlide.primaryUrl}
                alt={activeSlide.title}
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src !== activeSlide.fallbackUrl) {
                    target.src = activeSlide.fallbackUrl;
                  }
                }}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => setActiveSlide(null)}
                className="absolute top-3 right-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/90 transition-colors"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {activeSlide.category}
              </span>
              <h3 className="mt-2 text-lg font-bold text-foreground">{activeSlide.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{activeSlide.subtitle}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
