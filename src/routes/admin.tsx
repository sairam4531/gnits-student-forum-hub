import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  LogOut,
  Settings,
  Sparkles,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  Image as ImageIcon,
  Video as VideoIcon,
  LayoutDashboard,
  Calendar,
} from "lucide-react";
import { AdminEventsView } from "@/components/AdminEventsView";
import { AdminProfileModal } from "@/components/AdminProfileModal";
import { DailyPhotosManage } from "@/components/admin/DailyPhotosManage";
import { CollegeVideosManage } from "@/components/admin/CollegeVideosManage";
import { DeanDetailsManage } from "@/components/admin/DeanDetailsManage";
import { StudentAffairsHeader } from "@/components/StudentAffairsHeader";
import { EventsClubsDrawer } from "@/components/EventsClubsDrawer";
import { LoopVideoShowcase } from "@/components/LoopVideoShowcase";
import { DeanDetailsCard } from "@/components/DeanDetailsCard";
import {
  adminLoginServerFn,
  getAdminSessionServerFn,
  adminLogoutServerFn,
  getAdminProfileServerFn,
  getAllAdminEventsServerFn,
  type AdminProfileRecord,
} from "@/lib/admin.functions";
import {
  getAdminHomepageDataServerFn,
} from "@/lib/homepage.functions";
import type { HomepageDataStore } from "@/lib/local-homepage-store";
import { type ForumClub } from "@/lib/student-forums";
import {
  getClientHomepageData,
  mergeServerWithClient,
} from "@/lib/client-portal-store";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
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

  // Active Admin Tab
  const [activeTab, setActiveTab] = useState<"events" | "photos" | "videos" | "dean">("events");
  const [homepageData, setHomepageData] = useState<HomepageDataStore | null>(null);

  // Forum selection state
  const [selectedClub, setSelectedClub] = useState<ForumClub | null>(null);
  const [selectedForumName, setSelectedForumName] = useState<string | null>(null);
  const [selectedForumSlug, setSelectedForumSlug] = useState<string | null>(null);

  const adminEventsRef = useRef<HTMLDivElement>(null);

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
    setSelectedClub(null);
    setSelectedForumName(null);
    setSelectedForumSlug(null);
  };

  const handleSelectClub = (club: ForumClub) => {
    setSelectedClub(club);
    if (club.forums.length === 1 && club.forums[0]) {
      const singleForum = club.forums[0];
      setSelectedForumName(singleForum);
      setSelectedForumSlug(club.slug);
      setTimeout(() => {
        adminEventsRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      setSelectedForumName(null);
      setSelectedForumSlug(null);
    }
  };

  const handleSelectForum = (club: ForumClub, forumName: string, forumSlug: string) => {
    setSelectedClub(club);
    setSelectedForumName(forumName);
    setSelectedForumSlug(forumSlug);
    setTimeout(() => {
      adminEventsRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Export Complete Global Portal Master Excel
  const handleExportMasterExcel = async () => {
    try {
      const allEvents = await getAllAdminEventsServerFn();
      if (!allEvents || allEvents.length === 0) {
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
                    className="absolute right-3.5 top-3 text-muted-foreground hover:text-foreground"
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
                  className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
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
            // If not logged in, navigate to public event page
            window.location.href = `/events?club=${club.slug}&forum=${encodeURIComponent(forumName)}&slug=${forumSlug}`;
          }}
          onSelectDashboard={() => {
            window.location.href = "/";
          }}
          isAdmin={true}
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

      {/* Admin Action Sub-Bar */}
      <div className="border-b border-border/80 bg-muted/40 py-2.5 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-xs shadow-sm">
              {adminProfile?.avatar_url ? (
                <img
                  src={adminProfile.avatar_url}
                  alt="Admin"
                  className="h-full w-full object-cover rounded-xl"
                />
              ) : (
                "SC"
              )}
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold text-foreground block">
                {adminProfile?.display_name || "GNITS Student Council"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Signed in as @{adminProfile?.username || "studentcouncil"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportMasterExcel}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors shadow-sm"
              title="Download Master Excel Report of all campus events"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Master Excel Export</span>
            </button>

            {adminProfile && (
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-sm"
                title="Edit administrator display name & avatar"
              >
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Profile</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors"
              title="Sign out of admin session"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Admin Section Tabs Navigation Bar */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 overflow-x-auto py-2.5">
            <button
              type="button"
              onClick={() => {
                setSelectedClub(null);
                setSelectedForumName(null);
                setSelectedForumSlug(null);
                setActiveTab("events");
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "events"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("videos")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "videos"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <VideoIcon className="h-4 w-4" />
              <span>College Video Management</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("dean")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "dean"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <User className="h-4 w-4" />
              <span>Dean Details Management</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("photos")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "photos"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <ImageIcon className="h-4 w-4" />
              <span>Daily Photos Management</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area based on Tab */}
      <main className="flex-1 pb-16">
        {activeTab === "events" && (
          <div>
            {/* If a forum or event is selected from the sidebar, display its submitted events & documents */}
            {selectedClub && selectedForumName && selectedForumSlug ? (
              <div ref={adminEventsRef} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
                <AdminEventsView
                  club={selectedClub}
                  forumName={selectedForumName}
                  forumSlug={selectedForumSlug}
                  onClose={() => {
                    setSelectedForumName(null);
                    setSelectedForumSlug(null);
                    setSelectedClub(null);
                  }}
                />
              </div>
            ) : (
              /* Same as Student Portal Dashboard: Clean looping video + Dean's Profile card (NO unnecessary clutter) */
              <div className="w-full bg-white">
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

                <section
                  id="admin-dean-profile-section"
                  aria-label="Dean's Directorate Profile"
                  className="w-full bg-[#f8faff] py-12 sm:py-16 md:py-20 border-t border-slate-200/80"
                >
                  <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                    <DeanDetailsCard
                      dean={currentDean}
                      onOpenEventsDrawer={() => setIsDrawerOpen(true)}
                    />
                  </div>
                </section>
              </div>
            )}
          </div>
        )}

        {activeTab === "photos" && (
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
            <DailyPhotosManage
              photos={homepageData?.photos || getClientHomepageData().photos}
              onRefresh={loadHomepageData}
            />
          </div>
        )}

        {activeTab === "videos" && (
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
            <CollegeVideosManage
              videos={homepageData?.videos || getClientHomepageData().videos}
              onRefresh={loadHomepageData}
            />
          </div>
        )}

        {activeTab === "dean" && (
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
            <DeanDetailsManage
              dean={homepageData?.dean || getClientHomepageData().dean}
              onRefresh={loadHomepageData}
            />
          </div>
        )}
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

      {/* Slide-out Drawer: Events & Clubs Navigation (with Dashboard at top) */}
      <EventsClubsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSelectForum={(club, forumName, forumSlug) => {
          setSelectedClub(club);
          setSelectedForumName(forumName);
          setSelectedForumSlug(forumSlug);
          setActiveTab("events");
          setTimeout(() => {
            adminEventsRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 100);
        }}
        onSelectDashboard={() => {
          setSelectedClub(null);
          setSelectedForumName(null);
          setSelectedForumSlug(null);
          setActiveTab("events");
        }}
        isAdmin={true}
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
