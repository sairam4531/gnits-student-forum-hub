import { useState, useEffect, useCallback } from "react";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  User,
  Mail,
  Users,
  FileText,
  Image as ImageIcon,
  Clock,
  AlertCircle,
  Loader2,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  getAdminForumEventsServerFn,
  deleteAdminEventServerFn,
  type AdminEventRecord,
} from "@/lib/admin.functions";
import { type ForumClub } from "@/lib/student-forums";
import { getEventFileUrl } from "@/lib/event-file-storage";
import {
  getClientAdminEvents,
  getClientEvents,
  deleteClientAdminEvent,
  deleteClientEvent,
} from "@/lib/client-portal-store";

interface AdminEventsViewProps {
  club: ForumClub;
  forumName: string;
  forumSlug: string;
  onClose?: () => void;
}

interface LoadedPhoto {
  url: string;
  name: string;
}

export function AdminEventsView({ club, forumName, forumSlug, onClose }: AdminEventsViewProps) {
  const [events, setEvents] = useState<AdminEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Map of eventId -> loaded photo preview URLs
  const [eventPhotosMap, setEventPhotosMap] = useState<Record<string, LoadedPhoto[]>>({});
  const [loadingEventPhotos, setLoadingEventPhotos] = useState<Record<string, boolean>>({});

  // Active Photo Gallery Lightbox State
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryEvent, setGalleryEvent] = useState<AdminEventRecord | null>(null);
  const [galleryPhotos, setGalleryPhotos] = useState<LoadedPhoto[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // Deleting state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAdminEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let serverEvents: AdminEventRecord[] = [];
      try {
        const data = await getAdminForumEventsServerFn({
          data: {
            clubSlug: club.slug,
            forumSlug: forumSlug,
          },
        });
        if (Array.isArray(data)) {
          serverEvents = data as AdminEventRecord[];
        }
      } catch (serverErr) {
        console.warn("Could not load from server, using local admin store:", serverErr);
      }

      // Merge server events with persistent client admin events and public events
      const clientAdminEvents = getClientAdminEvents().filter(
        (e) => e.club_slug === club.slug && e.forum_slug === forumSlug
      );
      const clientPublicEvents = getClientEvents().filter(
        (e) => e.club_slug === club.slug && e.forum_slug === forumSlug
      );

      const map = new Map<string, AdminEventRecord>();

      // 1. First add server events
      serverEvents.forEach((ev) => map.set(ev.id, ev));

      // 2. Add client admin events (overwrites with latest full details)
      clientAdminEvents.forEach((ev) => map.set(ev.id, ev));

      // 3. Fallback: if an event is in clientPublicEvents, synthesize record so it always shows in Admin!
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

      const loadedEvents = Array.from(map.values());
      setEvents(loadedEvents);

      // Preload photos for each event
      for (const ev of loadedEvents) {
        loadPhotosForEvent(ev);
      }
    } catch (err: unknown) {
      console.warn("Could not load admin events:", err);
      setError(err instanceof Error ? err.message : "Failed to load events for this forum.");
    } finally {
      setLoading(false);
    }
  }, [club.slug, forumSlug]);

  useEffect(() => {
    fetchAdminEvents();
  }, [fetchAdminEvents]);

  // Load photos for an individual event from download URLs or IndexedDB
  const loadPhotosForEvent = async (ev: AdminEventRecord) => {
    if (loadingEventPhotos[ev.id]) return;
    setLoadingEventPhotos((prev) => ({ ...prev, [ev.id]: true }));

    const photos: LoadedPhoto[] = [];

    // 1. Direct download URLs (e.g. data URLs, CDN or Supabase URLs)
    if (ev.photo_download_urls && ev.photo_download_urls.length > 0) {
      ev.photo_download_urls.forEach((url, i) => {
        if (url) {
          photos.push({
            url,
            name: ev.photo_file_names?.[i] || `Photo ${i + 1}`,
          });
        }
      });
    }

    // 2. Load from IndexedDB using photo_object_paths
    if (ev.photo_object_paths && ev.photo_object_paths.length > 0) {
      for (let i = 0; i < ev.photo_object_paths.length; i++) {
        const p = ev.photo_object_paths[i];
        if (!p) continue;
        try {
          const url = await getEventFileUrl(p);
          if (url && !photos.some((ph) => ph.url === url)) {
            photos.push({
              url,
              name: ev.photo_file_names?.[i] || `Photo ${i + 1}`,
            });
          }
        } catch (err) {
          console.warn("Could not read photo from IndexedDB:", p, err);
        }
      }
    }

    setEventPhotosMap((prev) => ({ ...prev, [ev.id]: photos }));
    setLoadingEventPhotos((prev) => ({ ...prev, [ev.id]: false }));
  };

  // Open Photo Gallery Modal
  const handleOpenGallery = async (ev: AdminEventRecord, startingIndex = 0) => {
    setGalleryEvent(ev);
    setGalleryIndex(startingIndex);
    setGalleryOpen(true);

    let photos = eventPhotosMap[ev.id] || [];
    if (photos.length === 0) {
      // Attempt load on demand
      await loadPhotosForEvent(ev);
      photos = eventPhotosMap[ev.id] || [];
    }
    setGalleryPhotos(photos);
  };

  // Delete event handler
  const handleDeleteEvent = async (ev: AdminEventRecord) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete the event:\n"${ev.event_name}"?\n\nThis will remove the event, its submitted report, and all event photos from both the Admin and Student Portals.`
    );
    if (!confirmed) return;

    setDeletingId(ev.id);
    try {
      // 1. Delete from client admin and public persistent storage
      deleteClientAdminEvent(ev.id);
      deleteClientEvent(ev.id);

      // 2. Delete on server
      try {
        await deleteAdminEventServerFn({ data: { id: ev.id } });
      } catch (serverErr) {
        console.warn("Server delete note (deleted in local store):", serverErr);
      }

      // 3. Remove from UI state
      setEvents((prev) => prev.filter((item) => item.id !== ev.id));
    } catch (err: unknown) {
      alert("Failed to delete event: " + (err instanceof Error ? err.message : "Error"));
    } finally {
      setDeletingId(null);
    }
  };

  // Excel Export for a single event
  const exportSingleEventToExcel = (event: AdminEventRecord) => {
    const data = [
      {
        "Event ID": event.id,
        "Event Name": event.event_name,
        "Club Name": club.name,
        "Forum Name": forumName,
        "Club Slug": event.club_slug,
        "Forum Slug": event.forum_slug,
        "Start Date (From)": event.event_start,
        "End Date (To)": event.event_end,
        "Resource Persons": event.resource_persons,
        "Submitter Name": event.submitter_name || "N/A",
        "Submitter Email": event.submitter_email || "N/A",
        "Report File Name": event.report_file_name,
        "Photos Count": event.photo_file_names?.length || 0,
        "Submitted On": new Date(event.created_at).toLocaleString(),
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Event Summary");
    worksheet["!cols"] = Object.keys(data[0] || {}).map(() => ({ wch: 30 }));

    const safeName = event.event_name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    XLSX.writeFile(workbook, `GNITS_${forumName}_${safeName}_Event.xlsx`);
  };

  // Excel Export for all submitted events in this forum
  const exportAllEventsToExcel = () => {
    if (events.length === 0) return;

    const data = events.map((event, index) => ({
      "S.No": index + 1,
      "Event Name": event.event_name,
      Forum: forumName,
      Club: club.name,
      "Start Date": event.event_start,
      "End Date": event.event_end,
      "Resource Persons": event.resource_persons,
      "Student Submitter": event.submitter_name || "N/A",
      "Submitter Email": event.submitter_email || "N/A",
      "Report File": event.report_file_name,
      "Photos Uploaded": event.photo_file_names?.length || 0,
      "Submission Date": new Date(event.created_at).toLocaleString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${forumName} Events`);
    worksheet["!cols"] = Object.keys(data[0] || {}).map(() => ({ wch: 25 }));
    XLSX.writeFile(workbook, `GNITS_${forumName}_All_Submitted_Events.xlsx`);
  };

  // Handle download of report
  const handleDownloadReport = async (ev: AdminEventRecord) => {
    if (ev.report_object_path) {
      const localUrl = await getEventFileUrl(ev.report_object_path);
      if (localUrl) {
        const a = document.createElement("a");
        a.href = localUrl;
        a.download = ev.report_file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
    }
    if (ev.report_download_url) {
      window.open(ev.report_download_url, "_blank");
    }
  };

  // Keyboard navigation for photo gallery
  useEffect(() => {
    if (!galleryOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setGalleryIndex((prev) => (prev > 0 ? prev - 1 : galleryPhotos.length - 1));
      } else if (e.key === "ArrowRight") {
        setGalleryIndex((prev) => (prev < galleryPhotos.length - 1 ? prev + 1 : 0));
      } else if (e.key === "Escape") {
        setGalleryOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [galleryOpen, galleryPhotos.length]);

  return (
    <div
      id="admin-forum-events-section"
      className="mt-8 rounded-3xl border border-primary/50 bg-card p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-300"
    >
      {/* Header with Forum Information and Global Export */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
            <span>ADMIN REVIEW CONSOLE</span>
            <span>•</span>
            <span>{club.name}</span>
            <span>•</span>
            <span className="text-foreground">{forumName}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-foreground mt-1">
            Submitted Events on {forumName}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Review event files, contact submitters, download reports &amp; photos, or delete events.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {events.length > 0 && (
            <button
              type="button"
              onClick={exportAllEventsToExcel}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition-all hover:scale-102 cursor-pointer"
              title="Export all events in this forum to an Excel spreadsheet"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Export All ({events.length}) to Excel</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-muted p-2.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Close panel"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Events Body */}
      <div className="pt-6">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm font-medium">Loading submitted events from user side...</span>
          </div>
        ) : error ? (
          <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-border bg-muted/20">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Calendar className="h-7 w-7" />
            </div>
            <h4 className="mt-4 text-base font-bold text-foreground">
              No events submitted for {forumName} yet
            </h4>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              When students submit conducted event reports from the student view, they will appear
              here for administrative downloads, photo viewing, and Excel compilation.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {events.map((ev, idx) => {
              const photos = eventPhotosMap[ev.id] || [];
              const photoCount = ev.photo_file_names?.length || photos.length;

              return (
                <div
                  key={ev.id}
                  className="rounded-2xl border border-border bg-card p-6 shadow-md transition-all hover:border-primary/50"
                >
                  {/* Event Card Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/80">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                          Event #{idx + 1}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                          <Clock className="h-3 w-3" />
                          Submitted: {new Date(ev.created_at).toLocaleDateString()}
                        </span>
                        {ev.updated_at && (
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            Updated: {new Date(ev.updated_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1.5 text-lg sm:text-xl font-bold text-foreground">
                        {ev.event_name}
                      </h3>
                    </div>

                    {/* Top Action Buttons: Excel Export & Delete Event */}
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => exportSingleEventToExcel(ev)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors shadow-2xs cursor-pointer"
                        title="Export this single event to an Excel file"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        <span>Excel</span>
                      </button>

                      {/* Delete Event Button for Administrator */}
                      <button
                        type="button"
                        onClick={() => handleDeleteEvent(ev)}
                        disabled={deletingId === ev.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 hover:border-rose-400 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                        title="Delete this event from all clubs and events"
                      >
                        {deletingId === ev.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-600" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                        )}
                        <span>Delete Event</span>
                      </button>
                    </div>
                  </div>

                  {/* Event Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 py-4 text-xs sm:text-sm">
                    {/* Date Range */}
                    <div className="flex items-start gap-2.5 rounded-xl bg-muted/40 p-3 border border-border/60">
                      <Calendar className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="block text-[11px] font-semibold text-muted-foreground uppercase">
                          Conducted Dates
                        </span>
                        <span className="font-bold text-foreground">
                          {ev.event_start} to {ev.event_end}
                        </span>
                      </div>
                    </div>

                    {/* Submitter Name */}
                    <div className="flex items-start gap-2.5 rounded-xl bg-muted/40 p-3 border border-border/60">
                      <User className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="block text-[11px] font-semibold text-muted-foreground uppercase">
                          Student Submitter
                        </span>
                        <span className="font-bold text-foreground truncate block">
                          {ev.submitter_name || "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* Submitter Email */}
                    <div className="flex items-start gap-2.5 rounded-xl bg-muted/40 p-3 border border-border/60">
                      <Mail className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="block text-[11px] font-semibold text-muted-foreground uppercase">
                          Submitter Email
                        </span>
                        <a
                          href={`mailto:${ev.submitter_email}`}
                          className="font-bold text-primary truncate block hover:underline"
                        >
                          {ev.submitter_email || "N/A"}
                        </a>
                      </div>
                    </div>

                    {/* Resource Persons */}
                    <div className="flex items-start gap-2.5 rounded-xl bg-muted/40 p-3 border border-border/60">
                      <Users className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="block text-[11px] font-semibold text-muted-foreground uppercase">
                          Resource Person(s)
                        </span>
                        <span className="font-semibold text-foreground line-clamp-2">
                          {ev.resource_persons}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Downloads Section: Report & Event Photos */}
                  <div className="mt-2 pt-4 border-t border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Report Download */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary flex-shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-foreground truncate max-w-[200px] sm:max-w-[280px]">
                          Report: {ev.report_file_name}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {ev.report_content_type || "Document"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownloadReport(ev)}
                        className="ml-auto md:ml-2 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 text-primary px-3 py-1.5 text-xs font-bold hover:bg-primary/20 transition-colors cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download</span>
                      </button>
                    </div>

                    {/* Photos Count & View Gallery Button */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 border border-orange-200 flex-shrink-0">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-foreground">
                          {photoCount} Event Photos Uploaded
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Stage &amp; Audience Pictures
                        </span>
                      </div>

                      {/* Photo Thumbnail Previews (Clickable) */}
                      {photos.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          {photos.slice(0, 3).map((ph, pIdx) => (
                            <img
                              key={pIdx}
                              src={ph.url}
                              alt={ph.name}
                              onClick={() => handleOpenGallery(ev, pIdx)}
                              className="h-9 w-9 rounded-lg object-cover border border-slate-300 cursor-pointer hover:scale-110 hover:border-orange-500 transition-all shadow-xs"
                              title={`View ${ph.name}`}
                            />
                          ))}
                        </div>
                      )}

                      {/* View Photos Button */}
                      {photoCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleOpenGallery(ev, 0)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition-all cursor-pointer hover:scale-102"
                          title="Open photo gallery to view all uploaded event photos"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View Photos ({photoCount})</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Photo Gallery Lightbox Modal */}
      {galleryOpen && galleryEvent && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setGalleryOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl rounded-3xl bg-slate-900 border border-white/10 p-5 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="min-w-0 pr-4">
                <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider block">
                  Event Photo Gallery
                </span>
                <h4 className="text-base sm:text-lg font-bold text-white truncate">
                  {galleryEvent.event_name}
                </h4>
                {galleryPhotos.length > 0 && (
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    Photo {galleryIndex + 1} of {galleryPhotos.length}
                    {galleryPhotos[galleryIndex]?.name ? ` • ${galleryPhotos[galleryIndex]?.name}` : ""}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {galleryPhotos[galleryIndex] && (
                  <a
                    href={galleryPhotos[galleryIndex].url}
                    download={galleryPhotos[galleryIndex].name || "event_photo.jpg"}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setGalleryOpen(false)}
                  className="rounded-xl bg-white/10 hover:bg-white/20 p-2 text-white transition-colors cursor-pointer"
                  title="Close gallery (Esc)"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Photo Display with Prev/Next Navigation */}
            <div className="relative flex-1 flex items-center justify-center p-4 min-h-[350px] overflow-hidden">
              {galleryPhotos.length === 0 ? (
                <div className="text-center text-slate-400 py-12">
                  <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-50 text-orange-400" />
                  <p className="text-sm font-semibold">Photos are being loaded from event storage...</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {galleryEvent.photo_file_names?.join(", ") || "No preview files found."}
                  </p>
                </div>
              ) : (
                <>
                  <img
                    src={galleryPhotos[galleryIndex]?.url}
                    alt={galleryPhotos[galleryIndex]?.name || `Event photo ${galleryIndex + 1}`}
                    className="max-h-[62vh] max-w-full object-contain rounded-xl shadow-2xl transition-all"
                  />

                  {/* Previous Button */}
                  {galleryPhotos.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setGalleryIndex((prev) =>
                          prev > 0 ? prev - 1 : galleryPhotos.length - 1
                        )
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 hover:bg-black/90 p-2.5 text-white transition-all cursor-pointer hover:scale-110 shadow-lg"
                      title="Previous photo (Left arrow)"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                  )}

                  {/* Next Button */}
                  {galleryPhotos.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setGalleryIndex((prev) =>
                          prev < galleryPhotos.length - 1 ? prev + 1 : 0
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 hover:bg-black/90 p-2.5 text-white transition-all cursor-pointer hover:scale-110 shadow-lg"
                      title="Next photo (Right arrow)"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Thumbnail Strip at Bottom */}
            {galleryPhotos.length > 1 && (
              <div className="pt-3 border-t border-white/10 flex items-center justify-center gap-2 overflow-x-auto pb-1">
                {galleryPhotos.map((ph, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setGalleryIndex(idx)}
                    className={`h-14 w-14 rounded-xl overflow-hidden border-2 transition-all cursor-pointer flex-shrink-0 ${
                      galleryIndex === idx
                        ? "border-orange-500 scale-105 shadow-md"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={ph.url}
                      alt={ph.name}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
