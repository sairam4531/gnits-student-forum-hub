import { useState } from "react";
import {
  X,
  Calendar,
  Layers,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Search,
  Users,
  ChevronRight,
  GraduationCap,
  Sparkles,
  Compass,
  BookOpen,
  Award,
  HeartHandshake,
  Flame,
  PartyPopper,
  Cpu,
  Palette,
  Lightbulb,
  Microscope,
  Shield,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { forums, institutionalEvents, toSlug, type ForumClub } from "@/lib/student-forums";
import type { PublicEventRecord } from "@/lib/events.functions";

interface EventsClubsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectForum: (club: ForumClub, forumName: string, forumSlug: string) => void;
  onOpenSubmitModal: (club: ForumClub, forumName: string, forumSlug: string) => void;
  recentEvents: PublicEventRecord[];
}

type NavigationLevel =
  | { type: "root" }
  | { type: "student-forums" }
  | { type: "category-clubs"; club: ForumClub; title: string };

export function EventsClubsDrawer({
  isOpen,
  onClose,
  onSelectForum,
}: EventsClubsDrawerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [navLevel, setNavLevel] = useState<NavigationLevel>({ type: "root" });

  if (!isOpen) return null;

  // Institutional Events Club entry from forums
  const institutionalClub =
    forums.find((f) => f.slug === "institutional-events") || {
      slug: "institutional-events" as const,
      name: "Institutional Events",
      number: "00",
      accent: "blue" as const,
      forums: institutionalEvents,
    };

  // Student Forums categories mapped cleanly
  const studentForumCategories = [
    {
      id: "technical-clubs",
      title: "Technical Clubs",
      clubSlug: "technical-events",
      icon: Cpu,
      color: "text-blue-600 bg-blue-50 border-blue-200",
      count: "9 Clubs",
    },
    {
      id: "cultural-events",
      title: "Cultural Events",
      clubSlug: "cultural-events",
      icon: Palette,
      color: "text-rose-600 bg-rose-50 border-rose-200",
      count: "8 Clubs",
    },
    {
      id: "outreach-events",
      title: "Outreach Events",
      clubSlug: "outreach-events",
      icon: HeartHandshake,
      color: "text-amber-600 bg-amber-50 border-amber-200",
      count: "6 Clubs",
    },
    {
      id: "innovation-incubation",
      title: "Innovation & Incubation Cell",
      clubSlug: "innovation-incubation-cell",
      icon: Lightbulb,
      color: "text-indigo-600 bg-indigo-50 border-indigo-200",
      count: "Active Cell",
    },
    {
      id: "research-development",
      title: "Research & Development Cell",
      clubSlug: "research-development-cell",
      icon: Microscope,
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
      count: "Active Cell",
    },
    {
      id: "women-protection-abhaya",
      title: "Women Protection Cell (Abhaya)",
      clubSlug: "women-protection-abhaya",
      icon: Shield,
      color: "text-purple-600 bg-purple-50 border-purple-200",
      count: "Active Cell",
    },
  ];

  // Specific icons for institutional events in Level 1
  const getEventIcon = (name: string) => {
    switch (name) {
      case "Annual day":
        return PartyPopper;
      case "Women's Leadership Conclave (WLC)":
        return Sparkles;
      case "Graduation Day":
        return GraduationCap;
      case "Student Council":
        return ShieldCheck;
      case "Orientation Day":
        return Compass;
      case "Induction Program":
        return BookOpen;
      case "Ganesh Utsav":
        return Flame;
      case "Investiture Ceremony":
        return Award;
      case "Student Welfare Fund (SWF)":
        return HeartHandshake;
      default:
        return Calendar;
    }
  };

  // Search filter across all clubs and events
  const isSearching = searchTerm.trim().length > 0;
  const searchResults = isSearching
    ? [
        ...institutionalEvents
          .filter((name) => name.toLowerCase().includes(searchTerm.toLowerCase()))
          .map((name) => ({
            name,
            club: institutionalClub,
            category: "Institutional Event",
          })),
        ...forums.flatMap((club) =>
          club.forums
            .filter((forumName) => forumName.toLowerCase().includes(searchTerm.toLowerCase()))
            .map((forumName) => ({
              name: forumName,
              club,
              category: club.name,
            }))
        ),
      ]
    : [];

  const handleSelect = (club: ForumClub, forumName: string) => {
    const slug = toSlug(forumName);
    onSelectForum(club, forumName, slug);
    onClose();
  };

  const handleBack = () => {
    if (navLevel.type === "category-clubs") {
      setNavLevel({ type: "student-forums" });
    } else if (navLevel.type === "student-forums") {
      setNavLevel({ type: "root" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-300 select-none">
        {/* Dynamic Header with Back button or Title */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {navLevel.type !== "root" && !isSearching ? (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-200/80 text-slate-800 text-xs font-bold border border-slate-200 transition-colors cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
            ) : (
              <div className="h-10 w-10 rounded-xl bg-[#1e3a8a] text-white flex items-center justify-center font-black text-xs shadow-xs flex-shrink-0">
                GNITS
              </div>
            )}

            <div className="min-w-0">
              <h3 className="text-base font-black text-slate-900 leading-tight truncate">
                {isSearching
                  ? "Search Results"
                  : navLevel.type === "root"
                    ? "Student Affairs Menu"
                    : navLevel.type === "student-forums"
                      ? "Student Forums"
                      : navLevel.title}
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                {isSearching
                  ? `Found ${searchResults.length} matches`
                  : navLevel.type === "root"
                    ? "Student Council & Event Directories"
                    : navLevel.type === "student-forums"
                      ? "Select a forum category to view clubs"
                      : "Available student clubs & forums"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer flex-shrink-0"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3.5 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search any club, forum, or event..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Drawer Body - Step-by-Step Drill Down */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {/* SEARCH ACTIVE VIEW */}
          {isSearching ? (
            <div className="space-y-2">
              {searchResults.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-semibold">No clubs or events match "{searchTerm}"</p>
                </div>
              ) : (
                searchResults.map((item, idx) => (
                  <button
                    key={`${item.name}-${idx}`}
                    type="button"
                    onClick={() => handleSelect(item.club as ForumClub, item.name)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-blue-50/60 hover:border-blue-300 transition-all text-left group cursor-pointer"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                        {item.category}
                      </span>
                      <span className="text-sm font-bold text-slate-900 group-hover:text-blue-700">
                        {item.name}
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </button>
                ))
              )}
            </div>
          ) : navLevel.type === "root" ? (
            /* ============================================================ */
            /* LEVEL 1: First display below names only                      */
            /* ============================================================ */
            <div className="space-y-2">
              {/* 1. Student Forums (Triggers Submenu) */}
              <button
                type="button"
                onClick={() => setNavLevel({ type: "student-forums" })}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl border-2 border-blue-500/30 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-white hover:border-blue-600 transition-all text-left shadow-2xs group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#1e40af] text-white flex items-center justify-center shadow-xs flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-sm sm:text-base font-black text-slate-900 group-hover:text-blue-700 transition-colors">
                      Student Forums
                    </span>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Technical Clubs, Cultural, Outreach &amp; Cells
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full">
                    6 Categories
                  </span>
                  <ChevronRight className="h-5 w-5 text-blue-600 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              {/* 2 to 10: Institutional Events List */}
              {institutionalEvents.map((eventName) => {
                const IconComponent = getEventIcon(eventName);
                return (
                  <button
                    key={eventName}
                    type="button"
                    onClick={() => handleSelect(institutionalClub, eventName)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-left group cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors truncate">
                        {eventName}
                      </span>
                    </div>

                    <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          ) : navLevel.type === "student-forums" ? (
            /* ============================================================ */
            /* LEVEL 2: Display Technical Clubs, Cultural, Outreach, Cells  */
            /* ============================================================ */
            <div className="space-y-2.5">
              <div className="px-1 pb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Select a Forum Category
                </span>
              </div>

              {studentForumCategories.map((cat) => {
                const CatIcon = cat.icon;
                const clubEntry = forums.find((f) => f.slug === cat.clubSlug);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      if (clubEntry) {
                        setNavLevel({
                          type: "category-clubs",
                          club: clubEntry,
                          title: cat.title,
                        });
                      }
                    }}
                    className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-blue-50/50 hover:border-blue-300 transition-all text-left group cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${cat.color} group-hover:scale-105 transition-transform`}
                      >
                        <CatIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors block truncate">
                          {cat.title}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          {cat.count}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          ) : (
            /* ============================================================ */
            /* LEVEL 3: Display available clubs for selected category        */
            /* ============================================================ */
            <div className="space-y-2">
              <div className="px-1 pb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Available Clubs &amp; Forums in {navLevel.title}
                </span>
              </div>

              {navLevel.club.forums.map((forumName) => (
                <button
                  key={forumName}
                  type="button"
                  onClick={() => handleSelect(navLevel.club, forumName)}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-blue-50/70 hover:border-blue-400 transition-all text-left group cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0 group-hover:scale-125 transition-transform" />
                    <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                      {forumName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600">
                    <span className="hidden sm:inline text-[11px]">View Events</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Drawer Footer / Admin Shortcut */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <Link
            to="/admin"
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 py-2.5 text-xs font-bold shadow-2xs transition-colors"
          >
            <ShieldCheck className="h-4 w-4 text-[#1e3a8a]" />
            <span>Admin Portal Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
