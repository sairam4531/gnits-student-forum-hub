import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Home,
  Lock,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { StudentAffairsHeader } from "@/components/StudentAffairsHeader";
import { ConductedEventsView } from "@/components/ConductedEventsView";
import { AdminEventsView } from "@/components/AdminEventsView";
import { EventsClubsDrawer } from "@/components/EventsClubsDrawer";
import {
  forums,
  ACADEMIC_YEARS,
  isInstitutionalClub,
  normalizeAcademicYear,
  institutionalForumSlugWithAy,
  parseInstitutionalForumSlug,
  type AcademicYear,
  type ForumClub,
} from "@/lib/student-forums";
import {
  getAllPublicEventsServerFn,
  type PublicEventRecord,
} from "@/lib/events.functions";
import {
  getAdminSessionServerFn,
  adminLogoutServerFn,
  getAdminProfileServerFn,
  getAllAdminEventsServerFn,
  type AdminProfileRecord,
  type AdminEventRecord,
} from "@/lib/admin.functions";
import { getClientEvents, syncClientEvents } from "@/lib/client-portal-store";
import * as XLSX from "xlsx";

interface EventSearchState {
  club?: string | undefined;
  forum?: string | undefined;
  slug?: string | undefined;
  ay?: string | undefined;
  mode?: "admin" | "it-admin" | undefined;
}

export const Route = createFileRoute("/events")({
  staleTime: 0,
  validateSearch: (search: Record<string, unknown>): EventSearchState => {
    const club = (search["club"] as string) || "technical-events";
    const ay = isInstitutionalClub(club)
      ? normalizeAcademicYear(search["ay"] as string | undefined)
      : undefined;
    return {
      club,
      forum: (search["forum"] as string) || "ISTE",
      slug: (search["slug"] as string) || "iste",
      ay,
      mode:
        search["mode"] === "it-admin"
          ? "it-admin"
          : search["mode"] === "admin"
            ? "admin"
            : undefined,
    };
  },
  component: DedicatedEventPage,
});

function DedicatedEventPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [recentEvents, setRecentEvents] = useState<PublicEventRecord[]>([]);

  // Privileged portal authentication state (?mode=admin or ?mode=it-admin)
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [sessionRole, setSessionRole] = useState<"admin" | "it-admin" | null>(null);
  const [allowedClubSlug, setAllowedClubSlug] = useState<string | null>(null);
  const [roleLabel, setRoleLabel] = useState<string | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfileRecord | null>(null);

  const clubSlug = search.club || "technical-events";
  const forumName = search.forum || "ISTE";
  const rawSlug = search.slug || "iste";
  const isInstitutional = isInstitutionalClub(clubSlug);
  const parsedSlug = isInstitutional ? parseInstitutionalForumSlug(rawSlug) : { baseSlug: rawSlug };
  const selectedAy: AcademicYear | undefined = isInstitutional
    ? normalizeAcademicYear(search.ay) || parsedSlug.academicYear
    : undefined;
  const forumSlug = isInstitutional
    ? selectedAy
      ? institutionalForumSlugWithAy(parsedSlug.baseSlug, selectedAy)
      : parsedSlug.baseSlug
    : rawSlug;
  const wantsItAdminView = search.mode === "it-admin";
  const wantsAdminView = search.mode === "admin";
  const wantsPrivilegedView = wantsItAdminView || wantsAdminView;
  const isItAdmin = wantsItAdminView && sessionRole === "it-admin";
  const isClubAdmin = wantsAdminView && sessionRole === "admin";
  const isPrivileged = isItAdmin || isClubAdmin;
  const portalMode: "student" | "admin" | "it-admin" = isItAdmin
    ? "it-admin"
    : isClubAdmin
      ? "admin"
      : "student";

  // Match the club or fallback to default
  const selectedClub: ForumClub =
    forums.find((c) => c.slug === clubSlug) || forums[0]!;

  // Verify privileged session when navigated in ?mode=admin or ?mode=it-admin
  useEffect(() => {
    if (!wantsPrivilegedView) {
      setCheckingAuth(false);
      setSessionRole(null);
      setAllowedClubSlug(null);
      setRoleLabel(null);
      setAdminProfile(null);
      return;
    }

    let cancelled = false;
    setCheckingAuth(true);

    async function verifyPortalMode() {
      try {
        const session = await getAdminSessionServerFn();
        if (cancelled) return;

        if (wantsItAdminView && session.authenticated && session.role === "it-admin") {
          setSessionRole("it-admin");
          setAllowedClubSlug(null);
          setRoleLabel(session.label || "IT-Admin");
          const profile = await getAdminProfileServerFn();
          if (!cancelled) {
            setAdminProfile(profile);
          }
        } else if (wantsAdminView && session.authenticated && session.role === "admin") {
          setSessionRole("admin");
          setAllowedClubSlug(session.allowedClubSlug);
          setRoleLabel(session.label || "Club Admin");
          setAdminProfile(null);
        } else {
          setSessionRole(null);
          setAllowedClubSlug(null);
          setRoleLabel(null);
          setAdminProfile(null);
        }
      } catch {
        if (!cancelled) {
          setSessionRole(null);
          setAllowedClubSlug(null);
          setRoleLabel(null);
          setAdminProfile(null);
        }
      } finally {
        if (!cancelled) {
          setCheckingAuth(false);
        }
      }
    }

    verifyPortalMode();
    return () => {
      cancelled = true;
    };
  }, [wantsPrivilegedView, wantsItAdminView, wantsAdminView]);

  // Load recent events for drawer navigation
  useEffect(() => {
    async function loadRecentEvents() {
      try {
        const events = await getAllPublicEventsServerFn();
        if (Array.isArray(events)) {
          const reconciled = syncClientEvents(events);
          setRecentEvents(reconciled);
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
    newForumSlug: string,
    academicYear?: AcademicYear,
  ) => {
    navigate({
      to: "/events",
      search: {
        club: club.slug,
        forum: newForumName,
        slug: newForumSlug,
        ...(academicYear ? { ay: academicYear } : {}),
        ...(isItAdmin
          ? { mode: "it-admin" as const }
          : isClubAdmin
            ? { mode: "admin" as const }
            : {}),
      },
    });
  };

  const handleSelectAy = (ay: AcademicYear) => {
    navigate({
      to: "/events",
      search: {
        club: selectedClub.slug,
        forum: forumName,
        slug: institutionalForumSlugWithAy(parsedSlug.baseSlug, ay),
        ay,
        ...(isItAdmin
          ? { mode: "it-admin" as const }
          : isClubAdmin
            ? { mode: "admin" as const }
            : {}),
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
        "Academic Year": parseInstitutionalForumSlug(ev.forum_slug).academicYear || "N/A",
        "From Date": ev.event_start,
        "To Date": ev.event_end,
        "Resource Persons": ev.resource_persons || "N/A",
        "Submitter Name": ev.submitter_name || "N/A",
        "Submitter Email": ev.submitter_email || "N/A",
        "Report File": ev.report_file_name,
        "Documents": ev.document_file_names?.join(", ") || "None",
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

  const handleSignOut = async () => {
    const targetRoute = isItAdmin ? "/it-admin" : "/admin";
    try {
      await adminLogoutServerFn();
    } catch (err) {
      console.warn("Logout note:", err);
    }
    setSessionRole(null);
    setAllowedClubSlug(null);
    setRoleLabel(null);
    setAdminProfile(null);
    navigate({ to: targetRoute });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased selection:bg-[#2563eb]/20">
      {/* 1. Header with Scrolling Welcome & 3-lines menu */}
      <StudentAffairsHeader
        onOpenDrawer={() => setIsDrawerOpen(true)}
        title={
          isItAdmin
            ? "Welcome to Dean Student Affairs IT-Admin Portal"
            : isClubAdmin
              ? "Welcome to Dean Student Affairs Admin Portal"
              : undefined
        }
      />

      {/* 2. Breadcrumb & Navigation Bar */}
      <div className="bg-white border-b border-slate-200 shadow-2xs sticky top-18 sm:top-20 z-30">
        <div className="w-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-semibold text-slate-600 truncate">
            {isItAdmin ? (
              <Link
                to="/it-admin"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-800 font-bold border border-orange-200 transition-colors cursor-pointer flex-shrink-0"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-orange-600" />
                <span>Back to IT-Admin Dashboard</span>
              </Link>
            ) : isClubAdmin ? (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold border border-blue-200 transition-colors cursor-pointer flex-shrink-0"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-blue-600" />
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

            {isInstitutional && selectedAy && (
              <>
                <span className="text-slate-300">/</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200 flex-shrink-0">
                  {selectedAy}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 3. Main Dedicated Event Content - Full Width Layout */}
      <main className="flex-1 w-full bg-white">
        <div className="w-full px-4 sm:px-6 py-4">
          <div className="w-full animate-in fade-in duration-200">
            {isInstitutional && (!wantsPrivilegedView || isPrivileged) && (
              <div className="mb-4 pb-3 border-b border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600 block">
                      Academic Year
                    </span>
                    <h2 className="text-lg font-black text-slate-900">
                      {forumName} — Select Academic Year
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ACADEMIC_YEARS.map((ay) => {
                      const active = selectedAy === ay;
                      return (
                        <button
                          key={ay}
                          type="button"
                          onClick={() => handleSelectAy(ay)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            active
                              ? "bg-orange-500 text-white border-orange-600 shadow-sm"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300"
                          }`}
                        >
                          {ay}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {checkingAuth ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm font-medium">Verifying portal session...</p>
              </div>
            ) : wantsPrivilegedView && !isPrivileged ? (
              <div className="py-12 px-4 text-center max-w-md mx-auto space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Lock className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-black text-slate-900">
                  {wantsItAdminView ? "IT-Admin Sign In Required" : "Admin Sign In Required"}
                </h2>
                <p className="text-sm text-slate-600">
                  {wantsItAdminView
                    ? "Please sign in via the IT-Admin portal to manage institutional events and review student forum submissions."
                    : "Please sign in with your category Admin credentials to manage events and view submitted files."}
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Link
                    to={wantsItAdminView ? "/it-admin" : "/admin"}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>{wantsItAdminView ? "Go to IT-Admin Login" : "Go to Admin Login"}</span>
                  </Link>
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <span>Student Portal</span>
                  </Link>
                </div>
              </div>
            ) : isInstitutional && !selectedAy ? (
              <div className="py-6 text-center space-y-4">
                <p className="text-sm font-semibold text-slate-600">
                  Please choose an Academic Year above to view or manage {forumName} events.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 w-full">
                  {ACADEMIC_YEARS.map((ay) => (
                    <button
                      key={ay}
                      type="button"
                      onClick={() => handleSelectAy(ay)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:border-orange-400 p-4 text-center font-black text-slate-800 hover:text-orange-700 transition-all shadow-xs cursor-pointer"
                    >
                      {ay}
                    </button>
                  ))}
                </div>
              </div>
            ) : isItAdmin ? (
              <AdminEventsView
                club={selectedClub}
                forumName={forumName}
                forumSlug={forumSlug}
                academicYear={selectedAy}
                portalRole="it-admin"
                canAdd={isInstitutional}
                canEdit={isInstitutional}
                canDelete={true}
              />
            ) : isClubAdmin ? (
              <AdminEventsView
                club={selectedClub}
                forumName={forumName}
                forumSlug={forumSlug}
                academicYear={selectedAy}
                portalRole="admin"
                canAdd={Boolean(allowedClubSlug && selectedClub.slug === allowedClubSlug && !isInstitutional)}
                canEdit={Boolean(allowedClubSlug && selectedClub.slug === allowedClubSlug && !isInstitutional)}
                canDelete={false}
              />
            ) : (
              <ConductedEventsView
                club={selectedClub}
                forumName={forumName}
                forumSlug={forumSlug}
                academicYear={selectedAy}
              />
            )}
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
          navigate({ to: isItAdmin ? "/it-admin" : isClubAdmin ? "/admin" : "/" });
        }}
        portalMode={portalMode}
        allowedClubSlug={allowedClubSlug}
        {...(roleLabel ? { portalLabel: roleLabel } : {})}
        isAdmin={isItAdmin}
        {...(isItAdmin ? { adminProfile, onExportMasterExcel: handleExportMasterExcel } : {})}
        {...(isPrivileged ? { onSignOut: handleSignOut } : {})}
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
