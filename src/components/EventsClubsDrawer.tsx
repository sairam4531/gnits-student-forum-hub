import { useState } from "react";
import {
  X,
  Search,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Users,
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
import {
  forums,
  institutionalEvents,
  toSlug,
  type ForumClub,
} from "@/lib/student-forums";
import type { PublicEventRecord } from "@/lib/events.functions";

interface EventsClubsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectForum: (club: ForumClub, forumName: string, forumSlug: string) => void;
  onOpenSubmitModal: (club: ForumClub, forumName: string, forumSlug: string) => void;
  recentEvents: PublicEventRecord[];
}

export function EventsClubsDrawer({
  isOpen,
  onClose,
  onSelectForum,
}: EventsClubsDrawerProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Accordion state: None expanded initially so user sees the 10 main names first
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  // Sub-accordion state inside Student Forums: None expanded initially
  const [expandedForumCat, setExpandedForumCat] = useState<string | null>(null);

  if (!isOpen) return null;

  const institutionalClub =
    forums.find((f) => f.slug === "institutional-events") || {
      slug: "institutional-events" as const,
      name: "Institutional Events",
      number: "00",
      accent: "gold" as const,
      forums: institutionalEvents,
    };

  // Student Forums categories (6 categories)
  const studentForumCategories = [
    {
      id: "Technical Clubs",
      title: "Technical Clubs",
      clubSlug: "technical-events",
      icon: Cpu,
      forums: [
        "ISTE",
        "IEEE",
        "CSI",
        "IETE",
        "ACM-W",
        "ACM-W-SIGAI",
        "GDG",
        "ATMOS FORUM",
        "IEI",
      ],
    },
    {
      id: "Cultural Events",
      title: "Cultural Events",
      clubSlug: "cultural-events",
      icon: Palette,
      forums: [
        "Samskruthi",
        "Philanto",
        "Nrityastra",
        "Literaria Clava",
        "Artista",
        "Talantia",
        "Dhriti",
        "Suswara",
      ],
    },
    {
      id: "Outreach Events",
      title: "Outreach Events",
      clubSlug: "outreach-events",
      icon: HeartHandshake,
      forums: [
        "Rotaract Club",
        "NSS",
        "Street Cause",
        "Environmental Club (Unnat Bharat Abhiyan)",
        "Energy Swaraj",
        "Nirmaan",
      ],
    },
    {
      id: "Innovation & Incubation Cell",
      title: "Innovation & Incubation Cell",
      clubSlug: "innovation-incubation-cell",
      icon: Lightbulb,
      forums: ["Innovation & Incubation Cell"],
    },
    {
      id: "Research & Development Cell",
      title: "Research & Development Cell",
      clubSlug: "research-development-cell",
      icon: Microscope,
      forums: ["Research & Development Cell"],
    },
    {
      id: "Women Protection Cell (Abhaya)",
      title: "Women Protection Cell (Abhaya)",
      clubSlug: "women-protection-abhaya",
      icon: Shield,
      forums: ["Women Protection Cell (Abhaya)"],
    },
  ];

  // Primary list of side bar events (10 names only at first)
  const mainEvents = [
    { name: "Student Forums", icon: Users, isSpecial: true },
    { name: "Annual day", icon: PartyPopper, isSpecial: false },
    { name: "Women's Leadership Conclave (WLC)", icon: Sparkles, isSpecial: false },
    { name: "Graduation Day", icon: GraduationCap, isSpecial: false },
    { name: "Student Council", icon: ShieldCheck, isSpecial: false },
    { name: "Orientation Day", icon: Compass, isSpecial: false },
    { name: "Induction Program", icon: BookOpen, isSpecial: false },
    { name: "Ganesh Utsav", icon: Flame, isSpecial: false },
    { name: "Investiture Ceremony", icon: Award, isSpecial: false },
    { name: "Student Welfare Fund (SWF)", icon: HeartHandshake, isSpecial: false },
  ];

  const handleSelect = (club: ForumClub, forumName: string) => {
    const slug = toSlug(forumName);
    onSelectForum(club, forumName, slug);
    onClose();
  };

  const toggleEvent = (eventName: string) => {
    setExpandedEvent((prev) => (prev === eventName ? null : eventName));
  };

  const toggleForumCat = (catTitle: string) => {
    setExpandedForumCat((prev) => (prev === catTitle ? null : catTitle));
  };

  // Search filtering
  const isSearching = searchTerm.trim().length > 0;
  const searchResults = isSearching
    ? [
        ...institutionalEvents
          .filter((n) => n.toLowerCase().includes(searchTerm.toLowerCase()))
          .map((n) => ({ name: n, club: institutionalClub, group: "Institutional Event" })),
        ...studentForumCategories.flatMap((cat) => {
          const club = forums.find((f) => f.slug === cat.clubSlug) || institutionalClub;
          return cat.forums
            .filter((forumName) => forumName.toLowerCase().includes(searchTerm.toLowerCase()))
            .map((forumName) => ({ name: forumName, club, group: cat.title }));
        }),
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-2xs transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Low place (compact) Sidebar - max-w-xs (288px - 320px) matching the uploaded image */}
      <div className="relative w-72 sm:w-80 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-250 border-r border-slate-200">
        {/* Compact Header */}
        <div className="px-3.5 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-[#0f2757] text-white flex items-center justify-center font-black text-[10px] flex-shrink-0">
              GNITS
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-black text-slate-900 tracking-tight leading-none truncate">
                Student Affairs Portal
              </h3>
              <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                Events &amp; Forums Navigation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Compact Search Bar */}
        <div className="p-2.5 border-b border-slate-100 bg-slate-50/70">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search event or club..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg bg-white border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1.5 text-[10px] text-slate-400 hover:text-slate-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Compact Sidebar Menu */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 text-xs">
          {isSearching ? (
            /* Search Results */
            <div className="p-2 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 px-2 uppercase tracking-wider block mb-1">
                Found {searchResults.length} matches
              </span>
              {searchResults.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Calendar className="h-7 w-7 mx-auto mb-1 opacity-40" />
                  <p className="text-[11px] font-semibold">No events match "{searchTerm}"</p>
                </div>
              ) : (
                searchResults.map((item, idx) => (
                  <button
                    key={`${item.name}-${idx}`}
                    type="button"
                    onClick={() => handleSelect(item.club as ForumClub, item.name)}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-white hover:bg-orange-50/80 hover:text-orange-700 transition-colors text-left border border-slate-100 cursor-pointer"
                  >
                    <div>
                      <span className="text-[9px] font-bold text-orange-600 uppercase tracking-wider block">
                        {item.group}
                      </span>
                      <span className="font-semibold text-slate-900">{item.name}</span>
                    </div>
                    <span className="text-orange-500 font-bold">➤</span>
                  </button>
                ))
              )}
            </div>
          ) : (
            /* Main Events List (Displays ONLY the top-level names first) */
            mainEvents.map((item) => {
              const IconComp = item.icon;

              /* 1. Student Forums: Expandable Accordion into the 6 categories */
              if (item.isSpecial) {
                const isExpanded = expandedEvent === item.name;

                return (
                  <div key={item.name} className="bg-white">
                    <button
                      type="button"
                      onClick={() => toggleEvent(item.name)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 transition-all text-left cursor-pointer ${
                        isExpanded
                          ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold shadow-xs"
                          : "bg-white text-slate-800 hover:bg-slate-50 font-medium"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-1">
                        <IconComp
                          className={`h-4 w-4 flex-shrink-0 ${
                            isExpanded ? "text-white" : "text-slate-600"
                          }`}
                        />
                        <span className="truncate tracking-tight font-semibold">
                          {item.name}
                        </span>
                      </div>

                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-white flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      )}
                    </button>

                    {/* Sub-categories of Student Forums */}
                    {isExpanded && (
                      <div className="bg-slate-50/90 border-b border-slate-200/60 divide-y divide-slate-100/80 animate-in slide-in-from-top-1 duration-150">
                        {studentForumCategories.map((cat) => {
                          const isCatExpanded = expandedForumCat === cat.title;
                          const clubEntry =
                            forums.find((f) => f.slug === cat.clubSlug) || institutionalClub;

                          return (
                            <div key={cat.id} className="bg-slate-50">
                              {/* Sub-Category Header (e.g., Technical Clubs, Cultural Events) */}
                              <button
                                type="button"
                                onClick={() => toggleForumCat(cat.title)}
                                className={`w-full flex items-center justify-between pl-6 pr-3 py-2 text-left transition-colors cursor-pointer ${
                                  isCatExpanded
                                    ? "bg-orange-100/70 text-orange-950 font-bold"
                                    : "hover:bg-slate-100 text-slate-700 font-semibold"
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <cat.icon className="h-3.5 w-3.5 text-orange-600 flex-shrink-0" />
                                  <span className="truncate">{cat.title}</span>
                                </div>
                                {isCatExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-orange-600 flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                )}
                              </button>

                              {/* Available Clubs in this Category (Indented with ➤ arrows) */}
                              {isCatExpanded && (
                                <div className="bg-white pl-8 pr-3 py-1 space-y-0.5 border-l-2 border-orange-400 ml-5 my-1">
                                  {cat.forums.map((forumName) => (
                                    <button
                                      key={forumName}
                                      type="button"
                                      onClick={() => handleSelect(clubEntry, forumName)}
                                      className="w-full flex items-center gap-2 py-1.5 text-left text-slate-700 hover:text-orange-600 transition-colors group cursor-pointer"
                                    >
                                      <span className="text-[11px] text-orange-500 font-bold flex-shrink-0 group-hover:translate-x-0.5 transition-transform">
                                        ➤
                                      </span>
                                      <span className="truncate font-medium">{forumName}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              /* 2. Institutional Events: Sub-events removed as requested; direct click opens dedicated page */
              return (
                <div key={item.name} className="bg-white">
                  <button
                    type="button"
                    onClick={() => handleSelect(institutionalClub, item.name)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-white text-slate-800 hover:bg-orange-50/70 hover:text-orange-700 font-medium transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-1">
                      <IconComp className="h-4 w-4 flex-shrink-0 text-slate-600 group-hover:text-orange-600 transition-colors" />
                      <span className="truncate tracking-tight">{item.name}</span>
                    </div>

                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-orange-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Compact Footer: Admin Portal Link */}
        <div className="p-2.5 border-t border-slate-200 bg-slate-50">
          <Link
            to="/admin"
            onClick={onClose}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 py-1.5 text-xs font-bold shadow-2xs transition-colors"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-orange-600" />
            <span>Admin Portal Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
