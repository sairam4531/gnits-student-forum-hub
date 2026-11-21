import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { StudentAffairsHeader } from "@/components/StudentAffairsHeader";
import { DailyPhotosCard } from "@/components/DailyPhotosCard";
import { CollegeVideoCard } from "@/components/CollegeVideoCard";
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
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 font-sans antialiased selection:bg-[#1e3a8a]/20">
      {/* A. Header Section matching reference image */}
      <StudentAffairsHeader onOpenDrawer={() => setIsDrawerOpen(true)} />

      {/* B. Main Dashboard Section with Blue-toned Campus Background */}
      <main className="flex-1 relative">
        {/* Campus Background Image & Gradient Overlay */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img
            src="/assets/student-affairs-reference.jpg"
            alt="GNITS Campus"
            className="w-full h-full object-cover object-top opacity-85 filter brightness-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/30 via-transparent to-blue-950/40" />
        </div>

        {/* Dashboard Content Container */}
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 md:py-12">
          {/* Top Section: Daily Photos (Left) and College Video (Right) Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-stretch">
            {/* Left Section – Daily Photos (5 cols on md/lg) */}
            <div className="md:col-span-5 flex flex-col">
              <DailyPhotosCard
                photos={featuredPhotos.length > 0 ? featuredPhotos : photos}
                onOpenGallery={() => setIsGalleryOpen(true)}
              />
            </div>

            {/* Right Section – College Video (7 cols on md/lg) */}
            <div className="md:col-span-7 flex flex-col">
              <CollegeVideoCard video={featuredVideo} />
            </div>
          </div>

          {/* C. Dean Details Section (Full-Width Card Below) */}
          <DeanDetailsCard dean={dean} />

          {/* Conducted Events & Add Event Section when selected from the 3-lines menu */}
          {selectedClub && selectedForumName && selectedForumSlug && (
            <div
              ref={conductedEventsSectionRef}
              className="mt-10 rounded-3xl bg-white/95 backdrop-blur-md p-6 sm:p-8 border border-white/80 shadow-2xl animate-in fade-in duration-300"
            >
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
          )}
        </div>
      </main>

      {/* Slide-out Drawer: "Available Events & Clubs" (Triggered by Hamburger 3-lines click) */}
      <EventsClubsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSelectForum={handleSelectForum}
        onOpenSubmitModal={handleSelectForum}
        recentEvents={recentEvents}
      />

      {/* Photo Gallery Lightbox Modal (Triggered by "View Gallery →" click) */}
      <PhotoGalleryModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        photos={allGalleryPhotos.length > 0 ? allGalleryPhotos : photos}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/90 backdrop-blur-md py-6 text-center text-xs text-slate-500">
        <p className="font-bold text-slate-800">
          G. Narayanamma Institute of Technology & Science (Autonomous, For Women)
        </p>
        <p className="mt-1 text-slate-500">
          Dean Student Affairs & Student Council Portal
        </p>
      </footer>
    </div>
  );
}
