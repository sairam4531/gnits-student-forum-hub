import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
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
  FileSpreadsheet,
  Download,
  Trash2,
  Search,
  Calendar,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  FileText,
  Filter,
  Users,
  CheckCircle2,
  ExternalLink,
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
  deleteAdminEventServerFn,
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
  deleteClientAdminEvent,
} from "@/lib/client-portal-store";
import { getEventFileUrl } from "@/lib/event-file-storage";
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

  // Submitted Student Events state
  const [allSubmittedEvents, setAllSubmittedEvents] = useState<AdminEventRecord[]>([]);
  const [eventFilterSearch, setEventFilterSearch] = useState("");
  const [eventFilterClub, setEventFilterClub] = useState("all");
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  // Photo Gallery Modal state for reviewing event photos
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<{ url: string; name: string }[]>([]);
  const [galleryEventTitle, setGalleryEventTitle] = useState("");
  const [galleryIndex, setGalleryIndex] = useState(0);

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

  const loadAllEvents = useCallback(async () => {
    let serverEvents: AdminEventRecord[] = [];
    try {
      serverEvents = (await getAllAdminEventsServerFn()) || [];
    } catch (err) {
      console.warn("Could not load server events, using client store:", err);
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
          photo_download_urls: (pub as any).photo_download_urls || [],
          created_at: pub.created_at || new Date().toISOString(),
        });
      }
    });

    // Deduplicate: Primary by ID, secondary by signature (same club + forum + name + dates + submitter)
    const deduplicatedEvents: AdminEventRecord[] = [];
    const seenSignatures = new Map<string, number>();

    Array.from(map.values()).forEach((ev) => {
      const sig = `${ev.club_slug}::${ev.forum_slug}::${ev.event_name.trim().toLowerCase()}::${ev.event_start}::${ev.event_end}::${(ev.submitter_email || "").trim().toLowerCase()}`;
      if (seenSignatures.has(sig)) {
        const existingIdx = seenSignatures.get(sig)!;
        const existing = deduplicatedEvents[existingIdx];
        if (existing && ev.created_at > existing.created_at) {
          deduplicatedEvents[existingIdx] = ev;
        }
      } else {
        seenSignatures.set(sig, deduplicatedEvents.length);
        deduplicatedEvents.push(ev);
      }
    });

    const list = deduplicatedEvents.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setAllSubmittedEvents(list);
  }, []);

  // Check initial session & hydrate records
  useEffect(() => {
    setHomepageData(getClientHomepageData());
    loadAllEvents();

    async function checkAuth() {
      try {
        const session = await getAdminSessionServerFn();
        if (session.authenticated) {
          setIsAuthenticated(true);
          const profile = await getAdminProfileServerFn();
          setAdminProfile(profile);
          await loadHomepageData();
          await loadAllEvents();
        }
      } catch (err) {
        console.warn("Session check note:", err);
      } finally {
        setCheckingSession(false);
      }
    }
    checkAuth();

    // Listen for live student submissions or edits from other tabs
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        bc = new BroadcastChannel("gnits_portal_sync_channel");
        bc.onmessage = () => {
          loadHomepageData();
          loadAllEvents();
        };
      }
    } catch {
      // ignore
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("GNITS_")) {
        loadHomepageData();
        loadAllEvents();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      bc?.close();
      window.removeEventListener("storage", handleStorage);
    };
  }, [loadAllEvents]);

  // Handle Event deletion
  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this event submission record?")) return;
    setDeletingEventId(id);
    try {
      deleteClientAdminEvent(id);
      try {
        await deleteAdminEventServerFn({ data: { id } });
      } catch (err) {
        console.warn("Server event delete note (client deleted):", err);
      }
      await loadAllEvents();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete record.");
    } finally {
      setDeletingEventId(null);
    }
  };

  // Download Report
  const handleDownloadReport = async (ev: AdminEventRecord) => {
    if (ev.report_download_url && !ev.report_download_url.startsWith("blob:")) {
      window.open(ev.report_download_url, "_blank");
      return;
    }
    if (ev.report_object_path) {
      const u = await getEventFileUrl(ev.report_object_path);
      if (u) {
        window.open(u, "_blank");
        return;
      }
    }
    alert("No downloadable report file attached to this submission.");
  };

  // Open photo gallery for an event
  const handleOpenPhotoGallery = async (ev: AdminEventRecord) => {
    const photos: { url: string; name: string }[] = [];
    if (ev.photo_download_urls && ev.photo_download_urls.length > 0) {
      ev.photo_download_urls.forEach((url, i) => {
        photos.push({ url, name: ev.photo_file_names?.[i] || `Photo ${i + 1}` });
      });
    } else if (ev.photo_object_paths && ev.photo_object_paths.length > 0) {
      for (let i = 0; i < ev.photo_object_paths.length; i++) {
        const p = ev.photo_object_paths[i]!;
        const u = await getEventFileUrl(p);
        if (u) {
          photos.push({ url: u, name: ev.photo_file_names?.[i] || `Photo ${i + 1}` });
        }
      }
    }
    if (photos.length > 0) {
      setGalleryPhotos(photos);
      setGalleryEventTitle(ev.event_name);
      setGalleryIndex(0);
      setGalleryOpen(true);
    } else {
      alert("No photos attached to this event submission.");
    }
  };

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
        await loadAllEvents();
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

      // Deduplicate: Primary by ID, secondary by signature (same club + forum + name + dates + submitter)
      const allEvents: AdminEventRecord[] = [];
      const seenSignatures = new Map<string, number>();

      Array.from(map.values()).forEach((ev) => {
        const sig = `${ev.club_slug}::${ev.forum_slug}::${ev.event_name.trim().toLowerCase()}::${ev.event_start}::${ev.event_end}::${(ev.submitter_email || "").trim().toLowerCase()}`;
        if (seenSignatures.has(sig)) {
          const existingIdx = seenSignatures.get(sig)!;
          const existing = allEvents[existingIdx];
          if (existing && ev.created_at > existing.created_at) {
            allEvents[existingIdx] = ev;
          }
        } else {
          seenSignatures.set(sig, allEvents.length);
          allEvents.push(ev);
        }
      });

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
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-700 font-bold">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Dean Student Affairs Admin Control Dashboard</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById("admin-dean-profile-section")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  <User className="h-3.5 w-3.5 text-[#2563eb]" />
                  <span>Dean's Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    document.getElementById("admin-submitted-events-section")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />
                  <span>Submitted Records ({allSubmittedEvents.length})</span>
                </button>

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

                <button
                  type="button"
                  onClick={handleExportMasterExcel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors cursor-pointer"
                  title="Export all submitted records into Excel"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Export Master Excel</span>
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

          {/* 4. Submitted Student Event Reports & Records Section */}
          <section
            id="admin-submitted-events-section"
            aria-label="Submitted Student Event Reports & Records"
            className="w-full bg-slate-50 py-12 sm:py-16 border-b border-slate-200/80"
          >
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
              {/* Header Box */}
              <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>Verified Submissions Repository</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 tracking-tight">
                      Submitted Student Event Reports &amp; Records
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                      Review, inspect, search, and download all verified event reports submitted by student coordinators across GNITS forums.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-extrabold border border-blue-200">
                      {allSubmittedEvents.length} Total Records
                    </span>
                    <button
                      type="button"
                      onClick={handleExportMasterExcel}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-sm transition-all hover:scale-102 cursor-pointer"
                    >
                      <Download className="h-4 w-4" />
                      <span>Export Master Excel</span>
                    </button>
                  </div>
                </div>

                {/* Search & Club Filters */}
                <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 relative">
                    <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={eventFilterSearch}
                      onChange={(e) => setEventFilterSearch(e.target.value)}
                      placeholder="Search by event title, submitter, forum, or resource person..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                  </div>

                  <div>
                    <select
                      value={eventFilterClub}
                      onChange={(e) => setEventFilterClub(e.target.value)}
                      aria-label="Filter events by club or category"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 font-medium focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    >
                      <option value="all">All Clubs &amp; Categories</option>
                      <option value="technical-events">Technical Clubs</option>
                      <option value="cultural-events">Cultural Events</option>
                      <option value="outreach-events">Outreach Events</option>
                      <option value="institutional-events">Institutional Events</option>
                      <option value="innovation-incubation-cell">Innovation &amp; Incubation Cell</option>
                      <option value="research-development-cell">Research &amp; Development Cell</option>
                    </select>
                  </div>
                </div>

                {/* Records Table */}
                <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                  {(() => {
                    const filtered = allSubmittedEvents.filter((ev) => {
                      const matchesSearch =
                        !eventFilterSearch.trim() ||
                        ev.event_name.toLowerCase().includes(eventFilterSearch.toLowerCase()) ||
                        ev.submitter_name?.toLowerCase().includes(eventFilterSearch.toLowerCase()) ||
                        ev.submitter_email?.toLowerCase().includes(eventFilterSearch.toLowerCase()) ||
                        ev.forum_slug.toLowerCase().includes(eventFilterSearch.toLowerCase()) ||
                        ev.resource_persons?.toLowerCase().includes(eventFilterSearch.toLowerCase());

                      const matchesClub =
                        eventFilterClub === "all" || ev.club_slug === eventFilterClub;

                      return matchesSearch && matchesClub;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="py-14 text-center px-4 bg-slate-50/50">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-200/70 text-slate-400">
                            <Calendar className="h-6 w-6" />
                          </div>
                          <h4 className="mt-3 text-sm font-bold text-slate-700">
                            No submitted records found
                          </h4>
                          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                            {eventFilterSearch || eventFilterClub !== "all"
                              ? "Try adjusting your search query or club filter."
                              : "Student coordinators will submit event reports via their forum pages, and they will appear here automatically."}
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs sm:text-sm">
                          <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                            <tr>
                              <th className="py-3 px-4">S.No</th>
                              <th className="py-3 px-4">Event &amp; Forum</th>
                              <th className="py-3 px-4">Dates</th>
                              <th className="py-3 px-4">Resource Persons</th>
                              <th className="py-3 px-4">Submitter</th>
                              <th className="py-3 px-4 text-center">Report</th>
                              <th className="py-3 px-4 text-center">Photos</th>
                              <th className="py-3 px-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {filtered.map((ev, idx) => (
                              <tr key={ev.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                                  {idx + 1}
                                </td>

                                <td className="py-3.5 px-4 min-w-[220px]">
                                  <div className="font-bold text-slate-900 line-clamp-2">
                                    {ev.event_name}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <Link
                                      to="/events"
                                      search={{
                                        club: ev.club_slug,
                                        forum: ev.forum_slug.toUpperCase(),
                                        slug: ev.forum_slug,
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold border border-blue-200 transition-colors"
                                      title="Open forum page"
                                    >
                                      <span>{ev.forum_slug.toUpperCase()}</span>
                                      <ExternalLink className="h-2.5 w-2.5" />
                                    </Link>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600">
                                  <div className="font-semibold text-slate-900">{ev.event_start}</div>
                                  <div className="text-[11px] text-slate-400">to {ev.event_end}</div>
                                </td>

                                <td className="py-3.5 px-4 text-xs text-slate-600 max-w-[200px]">
                                  <div className="line-clamp-2" title={ev.resource_persons}>
                                    {ev.resource_persons || "Not specified"}
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                                  <div className="font-semibold text-slate-900">
                                    {ev.submitter_name || "N/A"}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {ev.submitter_email || "N/A"}
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadReport(ev)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-800 text-xs font-bold border border-orange-200 transition-colors cursor-pointer"
                                    title={`Download ${ev.report_file_name || "Report"}`}
                                  >
                                    <FileText className="h-3.5 w-3.5 text-orange-600" />
                                    <span>Download</span>
                                  </button>
                                </td>

                                <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                  {ev.photo_object_paths && ev.photo_object_paths.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenPhotoGallery(ev)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200 transition-colors cursor-pointer"
                                      title="View uploaded photos"
                                    >
                                      <ImageIcon className="h-3.5 w-3.5 text-blue-600" />
                                      <span>{ev.photo_object_paths.length} Photos</span>
                                    </button>
                                  ) : (
                                    <span className="text-xs text-slate-400 italic">None</span>
                                  )}
                                </td>

                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEvent(ev.id)}
                                    disabled={deletingEventId === ev.id}
                                    className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                                    title="Delete event record"
                                  >
                                    {deletingEventId === ev.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              </div>
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

      {/* Photo Gallery Lightbox for Event Submissions */}
      {galleryOpen && galleryPhotos.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
            {/* Top Bar */}
            <div className="w-full flex items-center justify-between py-3 px-4 text-white">
              <div className="font-bold text-sm sm:text-base truncate max-w-lg">
                {galleryEventTitle} • Photo {galleryIndex + 1} of {galleryPhotos.length}
              </div>
              <button
                type="button"
                onClick={() => setGalleryOpen(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Photo Image Display */}
            <div className="relative w-full flex items-center justify-center min-h-[300px] max-h-[70vh] p-2">
              <img
                src={galleryPhotos[galleryIndex]?.url}
                alt={galleryPhotos[galleryIndex]?.name || "Event photo"}
                className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-2xl"
              />

              {galleryPhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setGalleryIndex((prev) => (prev > 0 ? prev - 1 : galleryPhotos.length - 1))
                    }
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setGalleryIndex((prev) => (prev < galleryPhotos.length - 1 ? prev + 1 : 0))
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition-colors cursor-pointer"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}
            </div>

            {/* Bottom Caption */}
            <div className="text-white/80 text-xs text-center py-2 truncate max-w-md">
              {galleryPhotos[galleryIndex]?.name}
            </div>
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
