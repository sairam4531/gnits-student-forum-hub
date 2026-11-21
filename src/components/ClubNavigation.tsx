import {
  Cpu,
  Sparkles,
  HeartHandshake,
  Lightbulb,
  Microscope,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  Layers,
} from "lucide-react";
import { forums, forumSlug, type ForumClub } from "@/lib/student-forums";

interface ClubNavigationProps {
  selectedClub: ForumClub | null;
  selectedForum: string | null;
  onSelectClub: (club: ForumClub) => void;
  onSelectForum: (club: ForumClub, forumName: string, forumSlug: string) => void;
  isAdmin?: boolean;
}

const clubIcons: Record<string, React.ElementType> = {
  "technical-events": Cpu,
  "cultural-events": Sparkles,
  "outreach-events": HeartHandshake,
  "innovation-incubation-cell": Lightbulb,
  "research-development-cell": Microscope,
  "women-protection-abhaya": ShieldCheck,
};

const clubBadgeStyles: Record<string, string> = {
  "technical-events":
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  "cultural-events": "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
  "outreach-events": "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  "innovation-incubation-cell":
    "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  "research-development-cell":
    "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
  "women-protection-abhaya": "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20",
};

export function ClubNavigation({
  selectedClub,
  selectedForum,
  onSelectClub,
  onSelectForum,
  isAdmin = false,
}: ClubNavigationProps) {
  // Split 6 clubs into two columns: 3 on left side, 3 on right side
  const leftClubs = forums.slice(0, 3);
  const rightClubs = forums.slice(3, 6);

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Title strictly in middle with CAPITAL LETTERS as requested */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-primary border border-primary/20 mb-3">
          <Layers className="h-3.5 w-3.5" />
          {isAdmin ? "ADMIN EVENT PORTAL" : "ACADEMIC YEAR 2024-2025 • STUDENT BODY"}
        </span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-foreground uppercase">
          GNITS STUDENT FORUMS
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
          Explore all six primary student councils and wings. Select a club below to view its active
          forums, conducted initiatives, or submit new event records.
        </p>
      </div>

      {/* SIX CLUBS: Displayed oneside 3 and another side three */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        {/* Left Side: 3 Clubs (1. Technical, 2. Cultural, 3. Outreach) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span>Core Campus Wings (1 - 3)</span>
          </div>

          {leftClubs.map((club) => {
            const Icon = clubIcons[club.slug] ?? Cpu;
            const isSelected = selectedClub?.slug === club.slug;

            return (
              <div
                key={club.slug}
                onClick={() => onSelectClub(club)}
                className={`group relative flex flex-col p-5 sm:p-6 rounded-2xl border transition-all duration-300 cursor-pointer shadow-sm ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/40 hover:shadow-md"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 border ${
                        clubBadgeStyles[club.slug] ?? "bg-primary/10 text-primary border-primary/20"
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                          Club #{club.number}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium text-foreground">
                          {club.forums.length} {club.forums.length === 1 ? "Forum" : "Forums"}
                        </span>
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-foreground mt-0.5 group-hover:text-primary transition-colors">
                        {club.name}
                      </h3>
                    </div>
                  </div>
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border bg-background text-muted-foreground group-hover:border-primary/40 group-hover:text-primary"
                    }`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5 pt-3 border-t border-border/60">
                  {club.forums.slice(0, 5).map((f) => (
                    <span
                      key={f}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-medium"
                    >
                      {f}
                    </span>
                  ))}
                  {club.forums.length > 5 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold">
                      +{club.forums.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Side: 3 Clubs (4. Innovation, 5. R&D, 6. Women Protection) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span>Specialized Cells (4 - 6)</span>
          </div>

          {rightClubs.map((club) => {
            const Icon = clubIcons[club.slug] ?? Lightbulb;
            const isSelected = selectedClub?.slug === club.slug;

            return (
              <div
                key={club.slug}
                onClick={() => onSelectClub(club)}
                className={`group relative flex flex-col p-5 sm:p-6 rounded-2xl border transition-all duration-300 cursor-pointer shadow-sm ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/40 hover:shadow-md"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 border ${
                        clubBadgeStyles[club.slug] ?? "bg-primary/10 text-primary border-primary/20"
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                          Club #{club.number}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium text-foreground">
                          {club.forums.length} {club.forums.length === 1 ? "Forum" : "Forums"}
                        </span>
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-foreground mt-0.5 group-hover:text-primary transition-colors">
                        {club.name}
                      </h3>
                    </div>
                  </div>
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border bg-background text-muted-foreground group-hover:border-primary/40 group-hover:text-primary"
                    }`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5 pt-3 border-t border-border/60">
                  {club.forums.map((f) => (
                    <span
                      key={f}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-medium"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Forums drill-down view when a club is selected */}
      {selectedClub && (
        <div
          id="forum-drilldown"
          className="mt-12 rounded-3xl border border-primary/30 bg-card p-6 sm:p-8 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                <span>Club #{selectedClub.number}</span>
                <span>•</span>
                <span>Select a Forum to view conducted events</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mt-1">
                {selectedClub.name} Forums
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              {selectedClub.forums.length} Available Forums
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-6">
            {selectedClub.forums.map((forumName) => {
              const fSlug = forumSlug(selectedClub.slug, forumName);
              const isForumSelected = selectedForum === fSlug;

              return (
                <button
                  type="button"
                  key={forumName}
                  onClick={() => onSelectForum(selectedClub, forumName, fSlug)}
                  className={`flex items-center justify-between gap-3 p-4 rounded-xl border text-left transition-all duration-200 ${
                    isForumSelected
                      ? "border-primary bg-primary text-primary-foreground font-semibold shadow-md"
                      : "border-border bg-background hover:border-primary/50 hover:bg-muted/60 text-foreground"
                  }`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold truncate">{forumName}</span>
                    <span
                      className={`text-[11px] ${
                        isForumSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                      }`}
                    >
                      Click to view events
                    </span>
                  </div>
                  <ArrowRight
                    className={`h-4 w-4 flex-shrink-0 transition-transform ${
                      isForumSelected ? "translate-x-1" : ""
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
