import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Header } from "@/components/Header";
import { ForumCarousel } from "@/components/ForumCarousel";
import { ClubNavigation } from "@/components/ClubNavigation";
import { ConductedEventsView } from "@/components/ConductedEventsView";
import { forums, type ForumClub } from "@/lib/student-forums";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [selectedClub, setSelectedClub] = useState<ForumClub | null>(null);
  const [selectedForumName, setSelectedForumName] = useState<string | null>(null);
  const [selectedForumSlug, setSelectedForumSlug] = useState<string | null>(null);

  const eventsSectionRef = useRef<HTMLDivElement>(null);

  const handleSelectClub = (club: ForumClub) => {
    setSelectedClub(club);
    // If club has only 1 forum (like Innovation, R&D, Abhaya), auto-select it
    if (club.forums.length === 1 && club.forums[0]) {
      const singleForum = club.forums[0];
      setSelectedForumName(singleForum);
      setSelectedForumSlug(club.slug);
      setTimeout(() => {
        eventsSectionRef.current?.scrollIntoView({ behavior: "smooth" });
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
      eventsSectionRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Top Navigation */}
      <Header />

      {/* 5-Image Continuous Video Reel Marquee Carousel */}
      <ForumCarousel />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {/* Six Clubs Layout: 3 on one side, 3 on the other side */}
        <ClubNavigation
          selectedClub={selectedClub}
          selectedForum={selectedForumSlug}
          onSelectClub={handleSelectClub}
          onSelectForum={handleSelectForum}
        />

        {/* Conducted Events & Add Event Section when a forum is chosen */}
        {selectedClub && selectedForumName && selectedForumSlug && (
          <div ref={eventsSectionRef} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ConductedEventsView
              club={selectedClub}
              forumName={selectedForumName}
              forumSlug={selectedForumSlug}
              onClose={() => {
                setSelectedForumName(null);
                setSelectedForumSlug(null);
              }}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/80 bg-card/60 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center text-xs text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground">
            G. Narayanamma Institute of Technology & Science (Autonomous, For Women)
          </p>
          <p>Approved by AICTE, Affiliated to JNTUH, Accredited by NBA & NAAC with A+ Grade</p>
          <p className="text-[11px] text-muted-foreground/80 pt-2 border-t border-border/50 max-w-md mx-auto">
            © {new Date().getFullYear()} GNITS Student Council Hub. All rights reserved. Submissions
            are securely cataloged for student council administrative review.
          </p>
        </div>
      </footer>
    </div>
  );
}
