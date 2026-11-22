import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  Sparkles,
  Loader2,
  AlertCircle,
  Video as VideoIcon,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { AdminProfileModal } from "@/components/AdminProfileModal";
import { DailyPhotosManage } from "@/components/admin/DailyPhotosManage";
import { CollegeVideosManage } from "@/components/admin/CollegeVideosManage";
import { DeanDetailsManage } from "@/components/admin/DeanDetailsManage";
import { StudentAffairsHeader } from "@/components/StudentAffairsHeader";
import { EventsClubsDrawer } from "@/components/EventsClubsDrawer";
import { LoopVideoShowcase } from "@/components/LoopVideoShowcase";
import {
  adminLoginServerFn,
  getAdminSessionServerFn,
  adminLogoutServerFn,
  getAdminProfileServerFn,
  getAllAdminEventsServerFn,
  type AdminProfileRecord,
  type AdminEventRecord,
} from "@/lib/admin.functions";
import {
  getAdminHomepageDataServerFn,
} from "@/lib/homepage.functions";
import type { HomepageDataStore } from "@/lib/local-homepage-store";
import {
  getClientHomepageData,
  mergeServerWithClient,
  getClientAdminEvents,
  getClientEvents,
} from "@/lib/client-portal-store";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Login form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Admin Profile state
  const [adminProfile, setAdminProfile] = useState<AdminProfileRecord | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Modals for Videos and Daily Photos Management
  const [isVideosModalOpen, setIsVideosModalOpen] = useState(false);
  const [isPhotosModalOpen, setIsPhotosModalOpen] = useState(false);

  const [homepageData, setHomepageData] = useState<HomepageDataStore | null>(null);

  const loadHomepageData = async () => {
    try {
      const data = await getAdminHomepageDataServerFn();
      if (data) {
        const merged = mergeServerWithClient(data);
        setHomepageData(merged);
      } else {
        setHomepageData(getClientHomepageData());
      }
    } catch (err) {
      console.warn("Could not load homepage data, using persistent client store:", err);
      setHomepageData(getClientHomepageData());
    }
  };

  // Check initial session
  useEffect(() => {
    setHomepageData(getClientHomepageData());
    async function checkAuth() {
      try {
        const session = await getAdminSessionServerFn();
        if (session.authenticated) {
          setIsAuthenticated(true);
          const profile = await getAdminProfileServerFn();
          setAdminProfile(profile);
          await loadHomepageData();
        }
      } catch (err) {
        console.warn("Session check note:", err);
      } finally {
        setCheckingSession(false);
      }
    }
    checkAuth();
  }, []);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await adminLoginServerFn({
        data: {
          username: username.trim(),
          password,
        },
      });

      if (res.success) {
        setIsAuthenticated(true);
        const profile = await getAdminProfileServerFn();
        setAdminProfile(profile);
        await loadHomepageData();
      }
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Invalid credentials.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await adminLogoutServerFn();
    } catch (err) {
      console.warn("Logout note:", err);
    }
    setIsAuthenticated(false);
    setAdminProfile(null);
  };

  // Export Complete Global Portal Master Excel
  const handleExportMasterExcel = async () => {
    try {
      let serverEvents: AdminEventRecord[] = [];
      try {
        serverEvents = (await getAllAdminEventsServerFn()) || [];
      } catch (err) {
        console.warn("Could not load server events for excel:", err);
      }

      const clientAdminEvents = getClientAdminEvents();
      const clientPublicEvents = getClientEvents();

      const map = new Map<string, AdminEventRecord>();
      serverEvents.forEach((ev) => map.set(ev.id, ev));
      clientAdminEvents.forEach((ev) => map.set(ev.id, ev));
      clientPublicEvents.forEach((pub) => {
        if (!map.has(pub.id)) {
          map.set(pub.id, {
            id: pub.id,
            club_slug: pub.club_slug,
            forum_slug: pub.forum_slug,
            event_name: pub.event_name,
            event_start: pub.event_start,
            event_end: pub.event_end,
            resource_persons: pub.resource_persons || "Not specified",
            submitter_name: (pub as any).submitter_name || "Student Submitter",
            submitter_email: (pub as any).submitter_email || "student@gnits.ac.in",
            report_object_path: (pub as any).report_object_path || "",
            report_file_name: (pub as any).report_file_name || "Event_Report.pdf",
            report_content_type: (pub as any).report_content_type || "application/pdf",
            photo_object_paths: (pub as any).photo_object_paths || [],
            photo_file_names: (pub as any).photo_file_names || [],
            created_at: pub.created_at || new Date().toISOString(),
          });
        }
      });

      const allEvents = Array.from(map.values());
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

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm font-semibold">Verifying secure administrator session...</span>
        </div>
      </div>
    );
  }

  // If Not Authenticated -> Show Admin Login Form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        {/* Same header as Student Portal with Left Logo, Marquee, Right 28 Years Logo & 3-lines menu */}
        <StudentAffairsHeader
          onOpenDrawer={() => setIsDrawerOpen(true)}
          title="Welcome to Dean Student Affairs Admin Portal"
        />

        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl animate-in fade-in duration-300">
            {/* Header Badge & Title */}
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 shadow-sm">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                Council Administration
              </span>
              <h2 className="text-2xl font-black text-foreground mt-1">Admin Portal Login</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
                Sign in with council credentials to review submitted event reports and manage homepage content.
              </p>
            </div>

            {loginError && (
              <div className="mt-5 rounded-xl bg-destructive/10 p-3.5 text-xs sm:text-sm text-destructive border border-destructive/20 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="studentcouncil"
                    className="w-full rounded-xl border border-input bg-background pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl border border-input bg-background pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {loginLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Verifying credentials...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      <span>Sign In as Admin</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick Fill Demo Credentials */}
              <div className="pt-3 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setUsername("studentcouncil");
                    setPassword("studentcouncil@1234");
                  }}
                  className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Auto-fill Demo Credentials</span>
                </button>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Default credentials: <code>studentcouncil</code> / <code>studentcouncil@1234</code>
                </p>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar Drawer on Login Screen */}
        <EventsClubsDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onSelectForum={(club, forumName, forumSlug) => {
            navigate({
              to: "/events",
              search: {
                club: club.slug,
                forum: forumName,
                slug: forumSlug,
              },
            });
          }}
          onSelectDashboard={() => {
            navigate({ to: "/" });
          }}
          isAdmin={false}
        />
      </div>
    );
  }

  // Authenticated Admin Dashboard
  const currentClientData = getClientHomepageData();
  const currentDean = homepageData?.dean || currentClientData.dean;
  const allVideosList =
    homepageData?.videos?.length
      ? homepageData.videos
      : currentClientData.videos;
  const activeFeaturedVideo =
    allVideosList.find((v) => v.is_featured && v.is_active) ||
    allVideosList[0] ||
    null;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Top Header matching Student Portal with College Logo, Marquee, 28 Years Logo & 3-lines menu */}
      <StudentAffairsHeader
        onOpenDrawer={() => setIsDrawerOpen(true)}
        title="Welcome to Dean Student Affairs Admin Portal"
      />

      {/* Main Admin Dashboard: Clean Campus Video Showcase + Dean Profile Editor directly below it */}
      <main className="flex-1 pb-16">
        <div className="w-full bg-white">
          {/* 1. College Dashboard Video Showcase */}
          <section aria-label="Campus Loop Video Showcase" className="w-full">
            <LoopVideoShowcase
              video={activeFeaturedVideo}
              allVideos={allVideosList}
              onScrollToDean={() => {
                document
                  .getElementById("admin-dean-profile-section")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            />
          </section>

          {/* 2. Admin Quick Control Bar right below video */}
          <div className="border-y border-slate-200/80 bg-slate-50/90 py-3 px-4 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-700 font-bold">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Dean Student Affairs Admin Control Dashboard</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsVideosModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 font-bold shadow-2xs transition-colors cursor-pointer"
                  title="Upload or configure campus highlight videos"
                >
                  <VideoIcon className="h-3.5 w-3.5 text-orange-600" />
                  <span>College Video Management</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPhotosModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 font-bold shadow-2xs transition-colors cursor-pointer"
                  title="Manage daily carousel photos"
                >
                  <ImageIcon className="h-3.5 w-3.5 text-orange-600" />
                  <span>Daily Photos Management</span>
                </button>
              </div>
            </div>
          </div>

          {/* 3. Dean Profile Editor directly below the video */}
          <section
            id="admin-dean-profile-section"
            aria-label="Dean's Profile Editor"
            className="w-full bg-[#f8faff] py-10 sm:py-14 border-b border-slate-200/80"
          >
            <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
              <DeanDetailsManage
                dean={currentDean}
                onRefresh={loadHomepageData}
              />
            </div>
          </section>
        </div>
      </main>

      {/* Admin Profile Modal */}
      {adminProfile && (
        <AdminProfileModal
          profile={adminProfile}
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          onProfileUpdated={(updated) => setAdminProfile(updated)}
        />
      )}

      {/* College Videos Management Modal */}
      {isVideosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setIsVideosModalOpen(false)}
              className="absolute right-5 top-5 p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <CollegeVideosManage
              videos={homepageData?.videos || getClientHomepageData().videos}
              onRefresh={loadHomepageData}
            />
          </div>
        </div>
      )}

      {/* Daily Photos Management Modal */}
      {isPhotosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setIsPhotosModalOpen(false)}
              className="absolute right-5 top-5 p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <DailyPhotosManage
              photos={homepageData?.photos || getClientHomepageData().photos}
              onRefresh={loadHomepageData}
            />
          </div>
        </div>
      )}

      {/* Slide-out Drawer: Events & Clubs Navigation (with Dashboard at top) */}
      <EventsClubsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSelectForum={(club, forumName, forumSlug) => {
          // Open on dedicated new page, NEVER in dashboard
          navigate({
            to: "/events",
            search: {
              club: club.slug,
              forum: forumName,
              slug: forumSlug,
            },
          });
        }}
        onSelectDashboard={() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        isAdmin={true}
        adminProfile={adminProfile}
        onExportMasterExcel={handleExportMasterExcel}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onSignOut={handleLogout}
      />

      {/* Footer */}
      <footer className="border-t border-border/80 bg-card/60 py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">
            GNITS Student Council • Administrative Control Panel
          </p>
          <p className="text-[11px] mt-1">
            Protected with HTTP-only encrypted session cookies and server-verified data boundaries.
          </p>
        </div>
      </footer>
    </div>
  );
}
