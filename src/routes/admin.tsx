import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Menu,
  LogOut,
  FolderKanban,
} from "lucide-react";
import { StudentAffairsHeader } from "@/components/StudentAffairsHeader";
import { EventsClubsDrawer } from "@/components/EventsClubsDrawer";
import { LoopVideoShowcase } from "@/components/LoopVideoShowcase";
import { DeanDetailsCard } from "@/components/DeanDetailsCard";
import { forums, toSlug } from "@/lib/student-forums";
import {
  adminLoginServerFn,
  getAdminSessionServerFn,
  adminLogoutServerFn,
  type AdminProfileRecord,
} from "@/lib/admin.functions";
import { getAdminHomepageDataServerFn } from "@/lib/homepage.functions";
import type { HomepageDataStore } from "@/lib/local-homepage-store";
import {
  getClientHomepageData,
  mergeServerWithClient,
  HOMEPAGE_KEY,
  DELETED_IDS_KEY,
} from "@/lib/client-portal-store";

export const Route = createFileRoute("/admin")({
  staleTime: 0,
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [allowedClubSlug, setAllowedClubSlug] = useState<string | null>(null);
  const [roleLabel, setRoleLabel] = useState<string>("Club Admin");
  const [sessionUsername, setSessionUsername] = useState<string | null>(null);

  // Login form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
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

  useEffect(() => {
    async function checkAuth() {
      try {
        const session = await getAdminSessionServerFn();
        if (session.authenticated && session.role === "admin") {
          setIsAuthenticated(true);
          setAllowedClubSlug(session.allowedClubSlug);
          setRoleLabel(session.label || "Club Admin");
          setSessionUsername(session.username);
          await loadHomepageData();
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.warn("Session check note:", err);
      } finally {
        setCheckingSession(false);
      }
    }
    checkAuth();

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        bc = new BroadcastChannel("gnits_portal_sync_channel");
        bc.onmessage = (event: MessageEvent<{ type?: string }>) => {
          if (event.data?.type === "HOMEPAGE") {
            loadHomepageData();
          }
        };
      }
    } catch {
      // ignore
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === HOMEPAGE_KEY || e.key === DELETED_IDS_KEY) {
        loadHomepageData();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      bc?.close();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await adminLoginServerFn({
        data: {
          username: username.trim(),
          password,
          portal: "admin",
        },
      });

      if (res.success && res.role === "admin") {
        setIsAuthenticated(true);
        setAllowedClubSlug(res.allowedClubSlug);
        setRoleLabel(res.label || "Club Admin");
        setSessionUsername(res.username);
        await loadHomepageData();
      }
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Invalid credentials.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await adminLogoutServerFn();
    } catch (err) {
      console.warn("Logout note:", err);
    }
    setIsAuthenticated(false);
    setAllowedClubSlug(null);
    setSessionUsername(null);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm font-semibold">Verifying Admin session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <StudentAffairsHeader
          onOpenDrawer={() => setIsDrawerOpen(true)}
          title="Welcome to Dean Student Affairs Admin Portal"
        />

        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl animate-in fade-in duration-300">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 shadow-sm">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                Forum &amp; Club Administration
              </span>
              <h2 className="text-2xl font-black text-foreground mt-1">Admin Portal Login</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
                Sign in with your category Admin credentials to upload &amp; edit events in your club category and view all portal reports, documents &amp; photos.
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
                    placeholder="Enter your club admin username"
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
            </form>

            <div className="mt-5 pt-4 border-t border-border text-center text-xs text-muted-foreground">
              <span>Managing Dashboard or Institutional Events? </span>
              <Link to="/it-admin" className="font-bold text-primary hover:underline">
                Go to IT-Admin Login
              </Link>
            </div>
          </div>
        </div>

        <EventsClubsDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onSelectForum={(club, forumName, forumSlug, academicYear) => {
            navigate({
              to: "/events",
              search: {
                club: club.slug,
                forum: forumName,
                slug: forumSlug,
                ...(academicYear ? { ay: academicYear } : {}),
              },
            });
          }}
          onSelectDashboard={() => {
            navigate({ to: "/" });
          }}
          portalMode="student"
        />
      </div>
    );
  }

  const assignedClub = forums.find((f) => f.slug === allowedClubSlug) || forums[0]!;
  const resolvedData = homepageData ?? getClientHomepageData();
  const currentDean = resolvedData.dean;
  const allVideosList = resolvedData.videos;
  const activeFeaturedVideo =
    allVideosList.find((v) => v.is_featured && v.is_active) ||
    allVideosList[0] ||
    null;

  const adminProfileSummary: AdminProfileRecord = {
    username: sessionUsername || "admin",
    display_name: roleLabel,
    avatar_url: null,
    updated_at: new Date().toISOString(),
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-foreground antialiased selection:bg-primary/20">
      <StudentAffairsHeader
        onOpenDrawer={() => setIsDrawerOpen(true)}
        title="Welcome to Dean Student Affairs Admin Portal"
      />

      <main className="flex-1 bg-white pb-6">
        {/* Category Admin Action Bar */}
        <section className="w-full bg-slate-50 border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-4">
          <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <FolderKanban className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-primary">
                    {roleLabel}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {assignedClub.name}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Upload and edit events for <strong>{assignedClub.name}</strong> to submit to IT-Admin, or browse reports, documents, and photos across all portal events.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const defaultForum = assignedClub.forums[0]!;
                  navigate({
                    to: "/events",
                    search: {
                      club: assignedClub.slug,
                      forum: defaultForum,
                      slug: toSlug(defaultForum),
                      mode: "admin",
                    },
                  });
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors cursor-pointer"
              >
                <FolderKanban className="h-4 w-4" />
                <span>Manage {assignedClub.name}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-bold text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Menu className="h-4 w-4" />
                <span>All Events &amp; Clubs</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs sm:text-sm font-bold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </section>

        {/* Read-only Homepage Dashboard Preview */}
        <section
          aria-label="Campus Loop Video Showcase"
          className="w-full border-b border-slate-200"
        >
          <LoopVideoShowcase
            video={activeFeaturedVideo}
            allVideos={allVideosList}
          />
        </section>

        <section
          id="admin-dean-profile-section"
          aria-label="Dean Details"
          className="w-full bg-[#f8faff] py-6 sm:py-8"
        >
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <DeanDetailsCard dean={currentDean} />
          </div>
        </section>
      </main>

      <EventsClubsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSelectForum={(club, forumName, forumSlug, academicYear) => {
          navigate({
            to: "/events",
            search: {
              club: club.slug,
              forum: forumName,
              slug: forumSlug,
              ...(academicYear ? { ay: academicYear } : {}),
              mode: "admin",
            },
          });
        }}
        onSelectDashboard={() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        portalMode="admin"
        allowedClubSlug={allowedClubSlug}
        portalLabel={roleLabel}
        adminProfile={adminProfileSummary}
        onSignOut={handleLogout}
      />

      <footer className="border-t border-border/80 bg-card/60 py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">
            GNITS Student Council • Admin Portal ({roleLabel})
          </p>
          <p className="text-[11px] mt-1">
            Protected with HTTP-only encrypted session cookies and scoped event category permissions.
          </p>
        </div>
      </footer>
    </div>
  );
}
