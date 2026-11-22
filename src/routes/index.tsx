import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { StudentAffairsHeader } from "@/components/StudentAffairsHeader";
import { LoopVideoShowcase } from "@/components/LoopVideoShowcase";
import { DeanDetailsCard } from "@/components/DeanDetailsCard";
import { PhotoGalleryModal } from "@/components/PhotoGalleryModal";
import { EventsClubsDrawer } from "@/components/EventsClubsDrawer";
import { ConductedEventsView } from "@/components/ConductedEventsView";
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

export const Route = createFileRoute("/")({
  component: StudentAffairsPortalPage,
});

function StudentAffairsPortalPage() {
  // Homepage content states
  const [photos, setPhotos] = useState<HomepagePhoto[]>([]);
  const [featuredPhotos, setFeaturedPhotos] = useState<HomepagePhoto[]>([]);
  const [featuredVideo, setFeaturedVideo] = useState<HomepageVideo | null>(null);
  const [allVideos, setAllVideos] = useState<HomepageVideo[]>([]);
  const [dean, setDean] = useState<DeanDetails>({
    id: "dean-1",
    name: "Dr. K. Rama Linga Reddy",
    designation: "Dean, Student Affairs & Professor",
    profile_photo: "",
    email: "dean.studentaffairs@gnits.ac.in",
    contact_number: "+91 040-23565648 / +91 9849000000",
    updated_at: new Date().toISOString(),
  });

  const [allGalleryPhotos, setAllGalleryPhotos] = useState<HomepagePhoto[]>([]);
  const [recentEvents, setRecentEvents] = useState<PublicEventRecord[]>([]);

  // Modals & Drawers state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  // Selected forum for conducted events view
  const [selectedClub, setSelectedClub] = useState<ForumClub | null>(null);
  const [selectedForumName, setSelectedForumName] = useState<string | null>(null);
  const [selectedForumSlug, setSelectedForumSlug] = useState<string | null>(null);

  const conductedEventsSectionRef = useRef<HTMLDivElement>(null);

  // Load public data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const homeData = await getPublicHomepageDataServerFn();
        if (homeData) {
          setPhotos(homeData.photos || []);
          setFeaturedPhotos(homeData.featuredPhotos || []);
          setFeaturedVideo(homeData.featuredVideo || null);
          setAllVideos(
            homeData.allVideos || (homeData.featuredVideo ? [homeData.featuredVideo] : []),
          );
          if (homeData.dean) setDean(homeData.dean);
        }

        const events = await getAllPublicEventsServerFn();
        if (events) setRecentEvents(events);

        const allPhotos = await getAllPublicPhotosServerFn();
        if (allPhotos) setAllGalleryPhotos(allPhotos);
      } catch (err) {
        console.warn("Could not load homepage data from server:", err);
      }
    }
    loadData();
  }, []);

  const handleSelectForum = (club: ForumClub, forumName: string, forumSlug: string) => {
    setSelectedClub(club);
    setSelectedForumName(forumName);
    setSelectedForumSlug(forumSlug);
    setTimeout(() => {
      conductedEventsSectionRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 150);
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

        {/* B. Lower Section: Display Dean's Profile - FULL LAYOUT, NO BOXES */}
        <section
          id="dean-profile-section"
          aria-label="Dean's Directorate Profile"
          className="w-full bg-slate-50/70 py-12 sm:py-16 md:py-20 border-t border-slate-200/80"
        >
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <DeanDetailsCard
              dean={dean}
              onOpenEventsDrawer={() => setIsDrawerOpen(true)}
            />
          </div>
        </section>

        {/* Conducted Events & Add Event Section when selected from the 3-lines menu */}
        {selectedClub && selectedForumName && selectedForumSlug && (
          <div
            ref={conductedEventsSectionRef}
            className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10"
          >
            <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200 shadow-xl animate-in fade-in duration-300">
              <ConductedEventsView
                club={selectedClub}
                forumName={selectedForumName}
                forumSlug={selectedForumSlug}
                onClose={() => {
                  setSelectedClub(null);
                  setSelectedForumName(null);
                  setSelectedForumSlug(null);
                }}
              />
            </div>
          </div>
        )}
      </main>

      {/* Slide-out Drawer: Available Events & Clubs (Triggered by Hamburger 3-lines click) */}
      <EventsClubsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSelectForum={handleSelectForum}
        onOpenSubmitModal={handleSelectForum}
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
