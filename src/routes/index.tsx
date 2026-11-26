import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { StudentAffairsHeader } from "@/components/StudentAffairsHeader";
import { LoopVideoShowcase } from "@/components/LoopVideoShowcase";
import { DeanDetailsCard } from "@/components/DeanDetailsCard";
import { PhotoGalleryModal } from "@/components/PhotoGalleryModal";
import { EventsClubsDrawer } from "@/components/EventsClubsDrawer";
import {
  getPublicHomepageDataServerFn,
  getAllPublicPhotosServerFn,
} from "@/lib/homepage.functions";
import {
  getAllPublicEventsServerFn,
  type PublicEventRecord,
} from "@/lib/events.functions";
import type { HomepagePhoto, HomepageVideo, DeanDetails } from "@/lib/local-homepage-store";
import type { ForumClub } from "@/lib/student-forums";
import {
  getClientHomepageData,
  mergeServerWithClient,
  getClientEvents,
  syncClientEvents,
} from "@/lib/client-portal-store";

export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      return await getPublicHomepageDataServerFn();
    } catch {
      return null;
    }
  },
  staleTime: 0,
  component: StudentAffairsPortalPage,
});

function StudentAffairsPortalPage() {
  const navigate = useNavigate();
  const initialHomeData = Route.useLoaderData();

  const initialPhotos = (initialHomeData?.photos || []).filter((p) => p.is_active);
  const initialFeaturedPhotos =
    initialPhotos.filter((p) => p.is_featured).slice(0, 4).length > 0
      ? initialPhotos.filter((p) => p.is_featured).slice(0, 4)
      : initialPhotos.slice(0, 4);
  const initialVideos = (
    initialHomeData?.allVideos ||
    (initialHomeData?.featuredVideo ? [initialHomeData.featuredVideo] : [])
  ).filter((v) => v.is_active);
  const initialFeaturedVideo =
    initialHomeData?.featuredVideo && initialHomeData.featuredVideo.is_active
      ? initialHomeData.featuredVideo
      : initialVideos.find((v) => v.is_featured) || initialVideos[0] || null;

  // Initial state seeded from SSR loader so campus video & Dean details render immediately without delay
  const [photos, setPhotos] = useState<HomepagePhoto[]>(initialPhotos);
  const [featuredPhotos, setFeaturedPhotos] = useState<HomepagePhoto[]>(initialFeaturedPhotos);
  const [featuredVideo, setFeaturedVideo] = useState<HomepageVideo | null>(initialFeaturedVideo);
  const [allVideos, setAllVideos] = useState<HomepageVideo[]>(initialVideos);
  const [dean, setDean] = useState<DeanDetails>(
    initialHomeData?.dean || {
      id: "dean-1",
      name: "Dr. Aparna Patle",
      designation: "Dean, Student Affairs & Professor",
      profile_photo: "",
      email: "aparna.patle@gnits.ac.in",
      contact_number: "",
      updated_at: new Date().toISOString(),
    },
  );

  const [allGalleryPhotos, setAllGalleryPhotos] = useState<HomepagePhoto[]>(initialPhotos);
  const [recentEvents, setRecentEvents] = useState<PublicEventRecord[]>([]);

  // Modals & Drawers state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  // Sync state from client store
  const refreshFromClientStore = useCallback(() => {
    const current = getClientHomepageData();
    const activePhotos = current.photos.filter((p) => p.is_active);
    const activeVideos = current.videos.filter((v) => v.is_active);
    const fVideo = activeVideos.find((v) => v.is_featured) || activeVideos[0] || null;

    setPhotos(activePhotos);
    setFeaturedPhotos(
      activePhotos.filter((p) => p.is_featured).slice(0, 4).length > 0
        ? activePhotos.filter((p) => p.is_featured).slice(0, 4)
        : activePhotos.slice(0, 4)
    );
    setFeaturedVideo(fVideo);
    setAllVideos(activeVideos);
    setDean(current.dean);
    setAllGalleryPhotos(activePhotos);
    setRecentEvents(getClientEvents());
  }, []);

  // Load public data on mount & merge safely
  useEffect(() => {
    if (initialHomeData) {
      const merged = mergeServerWithClient({
        photos: initialHomeData.photos || [],
        videos:
          initialHomeData.allVideos ||
          (initialHomeData.featuredVideo ? [initialHomeData.featuredVideo] : []),
        dean: initialHomeData.dean || dean,
      });
      const activePhotos = merged.photos.filter((p) => p.is_active);
      const activeVideos = merged.videos.filter((v) => v.is_active);
      const fVideo = activeVideos.find((v) => v.is_featured) || activeVideos[0] || null;
      setPhotos(activePhotos);
      setFeaturedPhotos(
        activePhotos.filter((p) => p.is_featured).slice(0, 4).length > 0
          ? activePhotos.filter((p) => p.is_featured).slice(0, 4)
          : activePhotos.slice(0, 4),
      );
      setFeaturedVideo(fVideo);
      setAllVideos(activeVideos);
      setDean(merged.dean);
      setAllGalleryPhotos(activePhotos);
    } else {
      refreshFromClientStore();
    }

    async function loadData() {
      try {
        const homeData = await getPublicHomepageDataServerFn();
        if (homeData) {
          const merged = mergeServerWithClient({
            photos: homeData.photos || [],
            videos: homeData.allVideos || (homeData.featuredVideo ? [homeData.featuredVideo] : []),
            dean: homeData.dean || dean,
          });

          const activePhotos = merged.photos.filter((p) => p.is_active);
          const activeVideos = merged.videos.filter((v) => v.is_active);
          const fVideo = activeVideos.find((v) => v.is_featured) || activeVideos[0] || null;

          setPhotos(activePhotos);
          setFeaturedPhotos(
            activePhotos.filter((p) => p.is_featured).slice(0, 4).length > 0
              ? activePhotos.filter((p) => p.is_featured).slice(0, 4)
              : activePhotos.slice(0, 4)
          );
          setFeaturedVideo(fVideo);
          setAllVideos(activeVideos);
          setDean(merged.dean);
          setAllGalleryPhotos(activePhotos);
        }

        const events = await getAllPublicEventsServerFn();
        if (Array.isArray(events)) {
          const reconciled = syncClientEvents(events);
          setRecentEvents(reconciled);
        }

        if (!homeData?.photos?.length) {
          const allPhotos = await getAllPublicPhotosServerFn();
          if (allPhotos && allPhotos.length > 0) {
            setAllGalleryPhotos((prev) => (prev.length > 0 ? prev : allPhotos));
          }
        }
      } catch (err) {
        console.warn("Could not load homepage data from server, using persistent store:", err);
        if (!initialHomeData) {
          refreshFromClientStore();
        }
      }
    }

    loadData();

    // Listen for live updates across tabs or admin edits
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        bc = new BroadcastChannel("gnits_portal_sync_channel");
        bc.onmessage = () => {
          refreshFromClientStore();
        };
      }
    } catch {
      // ignore
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("GNITS_")) {
        refreshFromClientStore();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      bc?.close();
      window.removeEventListener("storage", handleStorage);
    };
  }, [refreshFromClientStore]);

  // When clicking any event (like ISTE or Annual day AY:2024-25), navigate to dedicated new page
  const handleSelectForum = (
    club: ForumClub,
    forumName: string,
    forumSlug: string,
    academicYear?: string,
  ) => {
    navigate({
      to: "/events",
      search: {
        club: club.slug,
        forum: forumName,
        slug: forumSlug,
        ...(academicYear ? { ay: academicYear } : {}),
      },
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 font-sans antialiased selection:bg-[#2563eb]/20">
      {/* 1. Top Header with scrolling welcome heading from right to left till logos */}
      <StudentAffairsHeader onOpenDrawer={() => setIsDrawerOpen(true)} />

      {/* 2. Main Dashboard Section with full layout video and boxless dean profile */}
      <main className="flex-1 bg-white">
        {/* A. Middle Section: Videos will play in loop - FULL LAYOUT & FULL SCREEN, NO BOXES */}
        <section aria-label="Campus Loop Video Showcase" className="w-full">
          <LoopVideoShowcase
            video={featuredVideo}
            allVideos={allVideos.length > 0 ? allVideos : featuredVideo ? [featuredVideo] : []}
            onOpenGallery={() => setIsGalleryOpen(true)}
            featuredPhotos={featuredPhotos.length > 0 ? featuredPhotos : photos}
            onScrollToDean={() => {
              document
                .getElementById("dean-profile-section")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        </section>

        {/* B. Lower Section: Display Dean's Profile - FULL LAYOUT */}
        <section
          id="dean-profile-section"
          aria-label="Dean's Directorate Profile"
          className="w-full bg-[#f8faff] py-6 sm:py-8 border-t border-slate-200/80"
        >
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <DeanDetailsCard
              dean={dean}
              onOpenEventsDrawer={() => setIsDrawerOpen(true)}
            />
          </div>
        </section>
      </main>

      {/* Slide-out Drawer: Available Events & Clubs (Triggered by Hamburger 3-lines click) */}
      <EventsClubsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSelectForum={handleSelectForum}
        onOpenSubmitModal={handleSelectForum}
        onSelectDashboard={() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        recentEvents={recentEvents}
      />

      {/* Photo Gallery Lightbox Modal (Triggered by "View Gallery" click) */}
      <PhotoGalleryModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        photos={allGalleryPhotos.length > 0 ? allGalleryPhotos : photos}
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
