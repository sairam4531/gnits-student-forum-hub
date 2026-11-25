import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Home,
} from "lucide-react";
import { StudentAffairsHeader } from "@/components/StudentAffairsHeader";
import { ConductedEventsView } from "@/components/ConductedEventsView";
import { EventsClubsDrawer } from "@/components/EventsClubsDrawer";
import { forums, type ForumClub } from "@/lib/student-forums";
import {
  getAllPublicEventsServerFn,
  type PublicEventRecord,
} from "@/lib/events.functions";
import {
  getAdminSessionServerFn,
  getAdminProfileServerFn,
  getAllAdminEventsServerFn,
  type AdminProfileRecord,
  type AdminEventRecord,
} from "@/lib/admin.functions";
import { getClientEvents, saveClientEvent, getClientAdminEvents } from "@/lib/client-portal-store";
import * as XLSX from "xlsx";

interface EventSearchState {
  club?: string | undefined;
  forum?: string | undefined;
  slug?: string | undefined;
  mode?: "admin" | undefined;
}

export const Route = createFileRoute("/events")({
  validateSearch: (search: Record<string, unknown>): EventSearchState => {
    return {
      club: (search["club"] as string) || "technical-events",
      forum: (search["forum"] as string) || "ISTE",
      slug: (search["slug"] as string) || "iste",
      mode: search["mode"] === "admin" ? "admin" : undefined,
    };
  },
  component: DedicatedEventPage,
});

function DedicatedEventPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [recentEvents, setRecentEvents] = useState<PublicEventRecord[]>([]);

  // Admin authentication state (only activated when opened explicitly from Admin Portal)
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminProfile, setAdminProfile] = useState<AdminProfileRecord | null>(null);

  const clubSlug = search.club || "technical-events";
  const forumName = search.forum || "ISTE";
  const forumSlug = search.slug || "iste";
  const wantsAdminView = search.mode === "admin";

  // Match the club or fallback to default
  const selectedClub: ForumClub =
    forums.find((c) => c.slug === clubSlug) || forums[0]!;

  // Check admin session only when navigated from Admin Portal (?mode=admin)
  useEffect(() => {
    if (!wantsAdminView) {
      setIsAdmin(false);
      setAdminProfile(null);
      return;
    }

    let cancelled = false;
    async function verifyAdminMode() {
      try {
        const session = await getAdminSessionServerFn();
        if (!cancelled && session.authenticated) {
          setIsAdmin(true);
          const profile = await getAdminProfileServerFn();
          if (!cancelled) {
            setAdminProfile(profile);
          }
        } else if (!cancelled) {
          setIsAdmin(false);
          setAdminProfile(null);
        }
      } catch {
        if (!cancelled) {
          setIsAdmin(false);
          setAdminProfile(null);
        }
      }
    }

    verifyAdminMode();
    return () => {
      cancelled = true;
    };
  }, [wantsAdminView]);

  // Load recent events for drawer navigation
  useEffect(() => {
    async function loadRecentEvents() {
      try {
        const events = await getAllPublicEventsServerFn();
        if (events && events.length > 0) {
          const clientEvs = getClientEvents();
          const combined = [...clientEvs];
          for (const ev of events) {
            if (!combined.some((c) => c.id === ev.id)) {
              combined.push(ev);
              saveClientEvent(ev, { broadcast: false });
            }
          }
          setRecentEvents(combined);
        } else {
          setRecentEvents(getClientEvents());
        }
      } catch (err) {
        console.warn("Could not load events:", err);
        setRecentEvents(getClientEvents());
      }
    }

    loadRecentEvents();
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
        ...(isAdmin ? { mode: "admin" as const } : {}),
      },
    });
  };

  const handleExportMasterExcel = async () => {
    try {
      const allEvents = (await getAllAdminEventsServerFn()) || [];
      if (allEvents.length === 0) {
        alert("No submitted events available for export.");
        return;
      }

      const rows = allEvents.map((ev, i) => ({
        "S.No": i + 1,
        "Event ID": ev.id,
        "Event Name": ev.event_name,
        "Club Slug": ev.club_slug,
        "Forum Slug": ev.forum_slug,
        "From Date": ev.event_start,
        "To Date": ev.event_end,
        "Resource Persons": ev.resource_persons,
        "Submitter Name": ev.submitter_name || "N/A",
        "Submitter Email": ev.submitter_email || "N/A",
        "Report File": ev.report_file_name,
        "Photos Count": ev.photo_file_names?.length || 0,
        "Submitted At": new Date(ev.created_at).toLocaleString(),
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "All Forum Events");
      worksheet["!cols"] = Object.keys(rows[0] || {}).map(() => ({ wch: 25 }));
      XLSX.writeFile(
        workbook,
        `GNITS_Student_Council_Master_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
    } catch (err: unknown) {
      alert("Failed to export Excel: " + (err instanceof Error ? err.message : "Error"));
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased selection:bg-[#2563eb]/20">
      {/* 1. Header with Scrolling Welcome & 3-lines menu */}
      <StudentAffairsHeader
        onOpenDrawer={() => setIsDrawerOpen(true)}
        title={
          isAdmin
            ? "Welcome to Dean Student Affairs Admin Portal"
            : undefined
        }
      />

      {/* 2. Breadcrumb & Navigation Bar */}
      <div className="bg-white border-b border-slate-200 shadow-2xs sticky top-18 sm:top-20 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-semibold text-slate-600 truncate">
            {isAdmin ? (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-800 font-bold border border-orange-200 transition-colors cursor-pointer flex-shrink-0"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-orange-600" />
                <span>Back to Admin Dashboard</span>
              </Link>
            ) : (
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition-colors cursor-pointer flex-shrink-0"
              >
                <Home className="h-3.5 w-3.5" />
                <span>Dashboard</span>
              </Link>
            )}

            <span className="text-slate-300">/</span>

            <span className="text-slate-500 hidden sm:inline truncate">
              {selectedClub.name}
            </span>

            <span className="text-slate-300 hidden sm:inline">/</span>

            <span className="text-[#0f2757] font-extrabold truncate">
              {forumName}
            </span>
          </div>
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
              isAdmin={isAdmin}
            />
          </div>
        </div>
      </main>

      {/* Slide-out Drawer for Navigation */}
      <EventsClubsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSelectForum={handleSelectForum}
        onOpenSubmitModal={handleSelectForum}
        onSelectDashboard={() => {
          navigate({ to: isAdmin ? "/admin" : "/" });
        }}
        isAdmin={isAdmin}
        adminProfile={adminProfile}
        onExportMasterExcel={handleExportMasterExcel}
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
