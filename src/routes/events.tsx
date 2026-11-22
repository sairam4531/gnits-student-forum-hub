import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, Home, Calendar, Sparkles } from "lucide-react";
import { StudentAffairsHeader } from "@/components/StudentAffairsHeader";
import { ConductedEventsView } from "@/components/ConductedEventsView";
import { EventsClubsDrawer } from "@/components/EventsClubsDrawer";
import { forums, type ForumClub } from "@/lib/student-forums";
import {
  getAllPublicEventsServerFn,
  type PublicEventRecord,
} from "@/lib/events.functions";

interface EventSearchState {
  club?: string;
  forum?: string;
  slug?: string;
}

export const Route = createFileRoute("/events")({
  validateSearch: (search: Record<string, unknown>): EventSearchState => {
    return {
      club: (search.club as string) || "technical-events",
      forum: (search.forum as string) || "ISTE",
      slug: (search.slug as string) || "iste",
    };
  },
  component: DedicatedEventPage,
});

function DedicatedEventPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [recentEvents, setRecentEvents] = useState<PublicEventRecord[]>([]);

  const clubSlug = search.club || "technical-events";
  const forumName = search.forum || "ISTE";
  const forumSlug = search.slug || "iste";

  // Match the club or fallback to default
  const selectedClub: ForumClub =
    forums.find((c) => c.slug === clubSlug) || forums[0]!;

  useEffect(() => {
    async function loadEvents() {
      try {
        const events = await getAllPublicEventsServerFn();
        if (events) setRecentEvents(events);
      } catch (err) {
        console.warn("Could not load events:", err);
      }
    }
    loadEvents();
  }, []);

  const handleSelectForum = (
    club: ForumClub,
    newForumName: string,
    newForumSlug: string
  ) => {
    navigate({
      to: "/events",
      search: {
        club: club.slug,
        forum: newForumName,
        slug: newForumSlug,
      },
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased selection:bg-[#2563eb]/20">
      {/* 1. Header with Scrolling Welcome & 3-lines menu */}
      <StudentAffairsHeader onOpenDrawer={() => setIsDrawerOpen(true)} />

      {/* 2. Breadcrumb & Navigation Bar */}
      <div className="bg-white border-b border-slate-200 shadow-2xs sticky top-18 sm:top-20 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-semibold text-slate-600 truncate">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition-colors cursor-pointer flex-shrink-0"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Dashboard</span>
            </Link>

            <span className="text-slate-300">/</span>

            <span className="text-slate-500 hidden sm:inline truncate">
              {selectedClub.name}
            </span>

            <span className="text-slate-300 hidden sm:inline">/</span>

            <span className="text-[#0f2757] font-extrabold truncate">
              {forumName}
            </span>
          </div>

          {/* Quick Switch Button */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200 transition-colors cursor-pointer flex-shrink-0"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Switch Event / Club</span>
          </button>
        </div>
      </div>

      {/* 3. Main Dedicated Event Content */}
      <main className="flex-1 py-8 sm:py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-white p-6 sm:p-8 md:p-10 border border-slate-200 shadow-xl animate-in fade-in duration-200">
            <ConductedEventsView
              club={selectedClub}
              forumName={forumName}
              forumSlug={forumSlug}
            />
          </div>
        </div>
      </main>

      {/* Slide-out Drawer for Quick Switching */}
      <EventsClubsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSelectForum={handleSelectForum}
        onOpenSubmitModal={handleSelectForum}
        recentEvents={recentEvents}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <p className="font-bold text-slate-800">
          G. Narayanamma Institute of Technology &amp; Science (Autonomous, For Women)
        </p>
        <p className="mt-1 text-slate-500">
          Dean Student Affairs &amp; Student Council Portal
        </p>
      </footer>
    </div>
  );
}
