import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Users,
  Clock,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { getPublicForumEvents, type PublicEventRecord } from "@/lib/events.functions";
import { isInstitutionalClub, type ForumClub } from "@/lib/student-forums";
import {
  getClientEvents,
  syncClientForumEvents,
  EVENTS_KEY,
  DELETED_IDS_KEY,
} from "@/lib/client-portal-store";

interface ConductedEventsViewProps {
  club: ForumClub;
  forumName: string;
  forumSlug: string;
  academicYear?: string | undefined;
  onClose?: () => void;
  isAdmin?: boolean;
}

export interface PublicEvent {
  id: string;
  club_slug: string;
  forum_slug: string;
  event_name: string;
  event_start: string;
  event_end: string;
  created_at: string;
  resource_persons?: string;
}

export function ConductedEventsView({
  club,
  forumName,
  forumSlug,
  academicYear,
  onClose,
}: ConductedEventsViewProps) {
  const isInstitutionalEvent = isInstitutionalClub(club.slug);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error("Timed out loading forum events.")),
            15000,
          );
        });

        const data = await Promise.race([
          getPublicForumEvents({
            data: {
              clubSlug: club.slug,
              forumSlug: forumSlug,
            },
          }),
          timeoutPromise,
        ]);

        if (Array.isArray(data)) {
          const reconciled = syncClientForumEvents(
            club.slug,
            forumSlug,
            data as PublicEventRecord[],
          );
          setEvents(reconciled as PublicEvent[]);
        } else {
          const reconciled = syncClientForumEvents(club.slug, forumSlug, []);
          setEvents(reconciled as PublicEvent[]);
        }
      } catch (err: unknown) {
        console.warn("Could not load public events:", err);
        const clientEvs = getClientEvents().filter(
          (e) => e.club_slug === club.slug && e.forum_slug === forumSlug,
        );
        if (clientEvs.length > 0) {
          setEvents(clientEvs as PublicEvent[]);
        } else {
          setEvents([]);
          setError(
            err instanceof Error
              ? err.message
              : "Could not load events from shared server storage.",
          );
        }
      } finally {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
        setLoading(false);
      }
    },
    [club.slug, forumSlug],
  );

  useEffect(() => {
    fetchEvents(false);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        bc = new BroadcastChannel("gnits_portal_sync_channel");
        bc.onmessage = (event: MessageEvent<{ type?: string }>) => {
          if (!event.data?.type || event.data.type === "EVENTS") {
            fetchEvents(true);
          }
        };
      }
    } catch {
      // ignore
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === EVENTS_KEY || e.key === DELETED_IDS_KEY) {
        fetchEvents(true);
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      bc?.close();
      window.removeEventListener("storage", handleStorage);
    };
  }, [fetchEvents]);

  return (
    <div
      id="forum-events-section"
      className="w-full rounded-2xl border border-primary/30 bg-card p-4 sm:p-6 shadow-sm animate-in fade-in zoom-in-95 duration-300"
    >
      {/* Header Bar (Read-Only Student Portal View — no add/edit/delete options) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
            <span>{club.name}</span>
            <span>•</span>
            <span className="text-foreground">{forumName}</span>
            {academicYear && (
              <>
                <span>•</span>
                <span className="text-orange-600">{academicYear}</span>
              </>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-foreground mt-1">
            Conducted Events on {forumName}
            {academicYear ? ` (${academicYear})` : ""}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {isInstitutionalEvent
              ? `Published institutional events organized by ${forumName}${academicYear ? ` for ${academicYear}` : ""}.`
              : `Published technical, cultural, and student activities organized by ${forumName}.`}
          </p>
        </div>

        {onClose && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-muted p-2.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Events Grid */}
      <div className="pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm font-medium">Loading events...</span>
          </div>
        ) : error ? (
          <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-border bg-muted/20">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Calendar className="h-6 w-6" />
            </div>
            <h4 className="mt-3 text-base font-bold text-foreground">
              No conducted events posted yet for {forumName}
            </h4>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              Events published by Admin and IT-Admin will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                      <Clock className="h-3 w-3" />
                      <span>Conducted</span>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(ev.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="mt-2.5 text-base font-bold text-foreground line-clamp-2">
                    {ev.event_name}
                  </h4>
                  {!isInstitutionalEvent && ev.resource_persons && (
                    <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5 line-clamp-2">
                      <Users className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span>{ev.resource_persons}</span>
                    </p>
                  )}
                </div>

                {/* Dates */}
                <div className="mt-4 pt-3 border-t border-border/60 text-xs text-muted-foreground flex items-center gap-1.5 font-medium min-w-0 truncate">
                  <Calendar className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  <span className="truncate">
                    {ev.event_start} to {ev.event_end}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
