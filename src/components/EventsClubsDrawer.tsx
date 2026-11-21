import { useState } from "react";
import {
  X,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  PlusCircle,
  Search,
  ExternalLink,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { forums, type ForumClub } from "@/lib/student-forums";
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
  onOpenSubmitModal,
  recentEvents,
}: EventsClubsDrawerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"clubs" | "events">("clubs");

  if (!isOpen) return null;

  const filteredClubs = forums.filter((club) => {
    const term = searchTerm.toLowerCase();
    return (
      club.name.toLowerCase().includes(term) ||
      club.forums.some((f) => f.toLowerCase().includes(term))
    );
  });

  const filteredEvents = recentEvents.filter((ev) => {
    const term = searchTerm.toLowerCase();
    return (
      ev.event_name.toLowerCase().includes(term) ||
      ev.forum_slug.toLowerCase().includes(term) ||
      ev.club_slug.toLowerCase().includes(term)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-300">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#1e3a8a] text-white flex items-center justify-center font-black text-xs shadow-xs">
              GNITS
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 leading-tight">
                Available Events & Clubs
              </h3>
              <p className="text-[11px] text-slate-500">Student Affairs & Council Forums</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search clubs, forums, or events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a]"
            />
          </div>

          {/* Tab buttons */}
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => setActiveTab("clubs")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === "clubs"
                  ? "bg-[#1e3a8a] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Clubs & Forums ({forums.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("events")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === "events"
                  ? "bg-[#1e3a8a] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Recent Events ({recentEvents.length})
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === "clubs" ? (
            <div className="space-y-3">
              {filteredClubs.map((club) => (
                <div
                  key={club.slug}
                  className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-[#1e3a8a]/40 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Club {club.number}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">{club.name}</h4>
                    </div>
                    <span className="text-[11px] font-semibold text-[#1e3a8a] bg-blue-50 px-2 py-0.5 rounded-full">
                      {club.forums.length} {club.forums.length === 1 ? "Forum" : "Forums"}
                    </span>
                  </div>

                  {/* Forums List */}
                  <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                    {club.forums.map((forumName) => {
                      const forumSlug = forumName.toLowerCase().replace(/[^a-z0-9]/g, "-");
                      return (
                        <button
                          key={forumName}
                          type="button"
                          onClick={() => {
                            onSelectForum(club, forumName, forumSlug);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-[#1e3a8a] hover:text-white text-slate-700 transition-colors cursor-pointer"
                        >
                          <span>{forumName}</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-semibold">No conducted events found.</p>
                </div>
              ) : (
                filteredEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {ev.forum_slug.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {ev.event_start}
                      </span>
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 mt-1.5">
                      {ev.event_name}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Resource: {ev.resource_persons || "College Faculty & Speakers"}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer / Shortcuts */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
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
