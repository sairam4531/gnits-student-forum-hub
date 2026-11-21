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
  ExternalLink,
} from "lucide-react";
import * as XLSX from "xlsx";
import { getAdminForumEventsServerFn, type AdminEventRecord } from "@/lib/admin.functions";
import { type ForumClub } from "@/lib/student-forums";

interface AdminEventsViewProps {
  club: ForumClub;
  forumName: string;
  forumSlug: string;
  onClose?: () => void;
}

export function AdminEventsView({ club, forumName, forumSlug, onClose }: AdminEventsViewProps) {
  const [events, setEvents] = useState<AdminEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active photo gallery preview modal
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const fetchAdminEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminForumEventsServerFn({
        data: {
          clubSlug: club.slug,
          forumSlug: forumSlug,
        },
      });
      setEvents(data as AdminEventRecord[]);
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

  // Excel Export for a single event as requested ("and excel export also for rech event")
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

    // Auto-fit column widths
    const maxLen = 30;
    worksheet["!cols"] = Object.keys(data[0] || {}).map(() => ({ wch: maxLen }));

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
            Review event files, contact submitters, download reports/photos, and export to Excel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {events.length > 0 && (
            <button
              type="button"
              onClick={exportAllEventsToExcel}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition-all hover:scale-102"
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
              className="rounded-xl border border-border bg-muted p-2.5 text-muted-foreground hover:text-foreground transition-colors"
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
              here for administrative downloads and Excel compilation.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {events.map((ev, idx) => (
              <div
                key={ev.id}
                className="rounded-2xl border border-border bg-card p-6 shadow-md transition-all hover:border-primary/50"
              >
                {/* Event Card Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/80">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                        Event #{idx + 1}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                        <Clock className="h-3 w-3" />
                        Submitted: {new Date(ev.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-lg sm:text-xl font-bold text-foreground">
                      {ev.event_name}
                    </h3>
                  </div>

                  {/* Individual Event Excel Export Button */}
                  <button
                    type="button"
                    onClick={() => exportSingleEventToExcel(ev)}
                    className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-emerald-600/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors shadow-sm"
                    title="Export this single event to an Excel file"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Excel Export</span>
                  </button>
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

                {/* Downloads Section: Report & Images as requested */}
                <div className="mt-2 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Report Download */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-foreground">
                        Report: {ev.report_file_name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {ev.report_content_type || "Document"}
                      </span>
                    </div>
                    {ev.report_download_url ? (
                      <a
                        href={ev.report_download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={ev.report_file_name}
                        className="ml-auto sm:ml-2 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 text-primary px-3 py-1.5 text-xs font-bold hover:bg-primary/20 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download Report</span>
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        Stored in Supabase
                      </span>
                    )}
                  </div>

                  {/* Photos count & previews */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 text-accent-foreground">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-foreground">
                        {ev.photo_file_names?.length || 0} Event Photos
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Audience & Stage Pictures
                      </span>
                    </div>

                    {/* Photo previews if signed URLs exist */}
                    {ev.photo_download_urls && ev.photo_download_urls.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        {ev.photo_download_urls.slice(0, 3).map((url, pIdx) => (
                          <img
                            key={pIdx}
                            src={url}
                            alt="Photo thumbnail"
                            onClick={() => setPreviewPhoto(url)}
                            className="h-9 w-9 rounded-lg object-cover border border-border cursor-pointer hover:scale-110 transition-transform shadow-sm"
                          />
                        ))}
                        {ev.photo_download_urls.length > 3 && (
                          <span className="text-xs text-muted-foreground font-semibold px-1">
                            +{ev.photo_download_urls.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image Preview Lightbox */}
      {previewPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div className="relative max-w-3xl w-full rounded-2xl overflow-hidden bg-black border border-white/10">
            <img
              src={previewPhoto}
              alt="Full preview"
              className="w-full max-h-[80vh] object-contain"
            />
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-3 right-3 rounded-full bg-black/70 p-2 text-white hover:bg-black transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
