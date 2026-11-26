import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  PlusCircle,
  FileText,
  Image as ImageIcon,
  User,
  Mail,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  X,
  Upload,
  Edit3,
} from "lucide-react";
import { getPublicForumEvents, submitStudentEvent, type PublicEventRecord } from "@/lib/events.functions";
import { type AdminEventRecord } from "@/lib/admin.functions";
import { isInstitutionalClub, type ForumClub } from "@/lib/student-forums";
import {
  getClientEvents,
  saveClientEvent,
  syncClientForumEvents,
  saveClientAdminEvent,
  getClientAdminEvents,
  getEventEditToken,
  saveEventEditToken,
  EVENTS_KEY,
  DELETED_IDS_KEY,
} from "@/lib/client-portal-store";
import { saveEventFile, compressImage } from "@/lib/event-file-storage";
import { MAX_UPLOAD_BYTES } from "@/lib/event-validation";

interface ConductedEventsViewProps {
  club: ForumClub;
  forumName: string;
  forumSlug: string;
  academicYear?: string | undefined;
  onClose?: () => void;
  isAdmin?: boolean;
}

interface PublicEvent {
  id: string;
  club_slug: string;
  forum_slug: string;
  event_name: string;
  event_start: string;
  event_end: string;
  created_at: string;
  resource_persons?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ConductedEventsView({
  club,
  forumName,
  forumSlug,
  academicYear,
  onClose,
  isAdmin = false,
}: ConductedEventsViewProps) {
  const isInstitutionalEvent = isInstitutionalClub(club.slug);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Edit Mode state
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [existingReportPath, setExistingReportPath] = useState<string | null>(null);
  const [existingReportName, setExistingReportName] = useState<string | null>(null);
  const [existingReportType, setExistingReportType] = useState<string | null>(null);
  const [existingPhotoPaths, setExistingPhotoPaths] = useState<string[]>([]);
  const [existingPhotoNames, setExistingPhotoNames] = useState<string[]>([]);
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>([]);
  const [existingCreatedAt, setExistingCreatedAt] = useState<string | null>(null);

  // Form input states
  const [eventName, setEventName] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [resourcePersons, setResourcePersons] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  // Fetch conducted events for this forum from authoritative server
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
            8000,
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
          setEvents(data as PublicEvent[]);
          syncClientForumEvents(club.slug, forumSlug, data as PublicEventRecord[]);
        } else {
          setEvents([]);
        }
      } catch (err: unknown) {
        console.warn("Could not load public events:", err);
        const clientEvs = getClientEvents().filter(
          (e) => e.club_slug === club.slug && e.forum_slug === forumSlug,
        );
        setEvents(clientEvs as PublicEvent[]);
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

  // Handle Photo selection
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      setPhotoFiles((prev) => [...prev, ...selected].slice(0, 20));
    }
  };

  const removePhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Open modal for NEW event submission
  const handleOpenNewModal = () => {
    setEditingEventId(null);
    setEventName("");
    setEventStart("");
    setEventEnd("");
    setResourcePersons("");
    setSubmitterName("");
    setSubmitterEmail("");
    setReportFile(null);
    setPhotoFiles([]);
    setExistingReportPath(null);
    setExistingReportName(null);
    setExistingReportType(null);
    setExistingPhotoPaths([]);
    setExistingPhotoNames([]);
    setExistingPhotoUrls([]);
    setExistingCreatedAt(null);
    setSubmitError(null);
    setSubmitSuccess(false);
    setIsModalOpen(true);
  };

  // Open modal for EDITING an existing event submission
  const handleOpenEditModal = (ev: PublicEvent) => {
    const adminEvents = getClientAdminEvents();
    const adminRecord = adminEvents.find((a) => a.id === ev.id);

    setEditingEventId(ev.id);
    setEventName(ev.event_name);
    setEventStart(ev.event_start);
    setEventEnd(ev.event_end);
    setResourcePersons(adminRecord?.resource_persons || ev.resource_persons || "");
    setSubmitterName(adminRecord?.submitter_name || "");
    setSubmitterEmail(adminRecord?.submitter_email || "");
    setExistingReportPath(adminRecord?.report_object_path || null);
    setExistingReportName(adminRecord?.report_file_name || null);
    setExistingReportType(adminRecord?.report_content_type || "application/pdf");
    setExistingPhotoPaths(adminRecord?.photo_object_paths || []);
    setExistingPhotoNames(adminRecord?.photo_file_names || []);
    setExistingPhotoUrls(adminRecord?.photo_download_urls || []);
    setExistingCreatedAt(ev.created_at || null);
    setReportFile(null);
    setPhotoFiles([]);
    setSubmitError(null);
    setSubmitSuccess(false);
    setIsModalOpen(true);
  };

  // Submit / Update Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!eventName.trim()) {
      setSubmitError("Event name is required.");
      return;
    }
    if (!eventStart || !eventEnd) {
      setSubmitError("Both start and end dates are required.");
      return;
    }
    if (eventStart > eventEnd) {
      setSubmitError("The end date must be on or after the start date.");
      return;
    }
    if (!isInstitutionalEvent) {
      if (!resourcePersons.trim()) {
        setSubmitError("Please provide Resource Person names & designations.");
        return;
      }
      if (!submitterName.trim() || !submitterEmail.trim()) {
        setSubmitError("Submitter contact details are required.");
        return;
      }
    }
    if (!reportFile && !editingEventId && !existingReportName) {
      setSubmitError("Please upload the Event Report (PDF or Word format).");
      return;
    }
    if (
      (reportFile?.size ?? 0) > MAX_UPLOAD_BYTES ||
      photoFiles.some((file) => file.size > MAX_UPLOAD_BYTES)
    ) {
      setSubmitError("Each uploaded file must be 20 MB or smaller.");
      return;
    }

    setSubmitting(true);

    try {
      const submissionId = editingEventId || crypto.randomUUID();
      const sanitizeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

      // 1. Prepare report file
      let finalReportPath = existingReportPath || `submissions/${submissionId}/report.pdf`;
      let finalReportName = existingReportName || "Event_Report.pdf";
      let finalReportType = existingReportType || "application/pdf";
      let safeReportBase64: string | undefined = undefined;

      if (reportFile) {
        const reportSafeName = sanitizeName(reportFile.name);
        finalReportPath = `submissions/${submissionId}/${crypto.randomUUID()}_${reportSafeName}`;
        finalReportName = reportFile.name;
        finalReportType = reportFile.type || "application/pdf";

        // Keep a local recovery copy while the server stores the private cloud file.
        await saveEventFile(finalReportPath, reportFile, reportFile.name);
        safeReportBase64 = await fileToBase64(reportFile);
      }

      // 2. Prepare photos
      let finalPhotoPaths = [...existingPhotoPaths];
      let finalPhotoNames = [...existingPhotoNames];
      let finalPhotoUrls = [...existingPhotoUrls];
      let safePhotoBase64s: string[] | undefined = undefined;

      if (photoFiles.length > 0) {
        const newPhotoPaths: string[] = [];
        const newPhotoNames: string[] = [];
        const newPhotoBase64s: string[] = [];
        const compressedPhotos = await Promise.all(
          photoFiles.map((photo) => compressImage(photo, 1200, 1200, 0.75)),
        );

        for (let i = 0; i < photoFiles.length; i++) {
          const photo = photoFiles[i];
          const photoBase64 = compressedPhotos[i];
          if (!photo || !photoBase64) {
            throw new Error("A selected photo could not be prepared. Please choose it again.");
          }
          const originalStem = photo.name.replace(/\.[^.]+$/, "");
          const safeStem = sanitizeName(originalStem) || `photo_${i + 1}`;
          const photoMimeType = /^data:([^;,]+)/.exec(photoBase64)?.[1] || photo.type;
          const photoExtension =
            photoMimeType === "image/jpeg"
              ? "jpg"
              : photoMimeType === "image/png"
                ? "png"
                : photoMimeType === "image/webp"
                  ? "webp"
                  : photoMimeType === "image/gif"
                    ? "gif"
                    : photoMimeType === "image/avif"
                      ? "avif"
                      : "img";
          const photoSafeName = `${i}_${crypto.randomUUID()}_${safeStem}.${photoExtension}`;
          const photoPath = `submissions/${submissionId}/${photoSafeName}`;
          newPhotoPaths.push(photoPath);
          newPhotoNames.push(photo.name);
          const compressedBlob = await fetch(photoBase64).then((response) => response.blob());
          await saveEventFile(photoPath, compressedBlob, photo.name);
          newPhotoBase64s.push(photoBase64);
        }

        safePhotoBase64s = newPhotoBase64s;
        finalPhotoPaths = newPhotoPaths;
        finalPhotoNames = newPhotoNames;
        finalPhotoUrls = newPhotoBase64s;
      }

      const editToken = editingEventId ? getEventEditToken(editingEventId) : undefined;
      const optionalForumFields = isInstitutionalEvent
        ? {}
        : {
            resourcePersons: resourcePersons.trim(),
            submitterName: submitterName.trim(),
            submitterEmail: submitterEmail.trim().toLowerCase(),
          };

      // 3. Commit to authoritative server database
      const res = await submitStudentEvent({
        data: {
          id: submissionId,
          clubSlug: club.slug,
          forumSlug: forumSlug,
          eventName: eventName.trim(),
          eventStart,
          eventEnd,
          ...optionalForumFields,
          reportObjectPath: finalReportPath,
          reportFileName: finalReportName,
          reportContentType: finalReportType,
          photoObjectPaths: finalPhotoPaths,
          photoFileNames: finalPhotoNames,
          reportBase64: safeReportBase64,
          photoBase64s: safePhotoBase64s,
          ...(editToken ? { editToken } : {}),
        },
      });

      if (!res?.success) {
        throw new Error("Server could not commit event to the authoritative database.");
      }

      if (res.editToken) {
        saveEventEditToken(res.id || submissionId, res.editToken);
      }

      saveClientAdminEvent(
        {
          id: res.id || submissionId,
          club_slug: club.slug,
          forum_slug: forumSlug,
          event_name: eventName.trim(),
          event_start: eventStart,
          event_end: eventEnd,
          resource_persons: isInstitutionalEvent ? "" : resourcePersons.trim(),
          submitter_name: isInstitutionalEvent ? null : submitterName.trim(),
          submitter_email: isInstitutionalEvent ? null : submitterEmail.trim().toLowerCase(),
          report_object_path: finalReportPath,
          report_file_name: finalReportName,
          report_content_type: finalReportType,
          photo_object_paths: finalPhotoPaths,
          photo_file_names: finalPhotoNames,
          created_at: existingCreatedAt || new Date().toISOString(),
          updated_at: editingEventId ? new Date().toISOString() : undefined,
          photo_download_urls: finalPhotoUrls,
        },
        { broadcast: false },
      );

      saveClientEvent(
        {
          id: res.id || submissionId,
          club_slug: club.slug,
          forum_slug: forumSlug,
          event_name: eventName.trim(),
          event_start: eventStart,
          event_end: eventEnd,
          created_at: existingCreatedAt || new Date().toISOString(),
          ...(isInstitutionalEvent ? {} : { resource_persons: resourcePersons.trim() }),
        },
        { broadcast: true },
      );

      setSubmitSuccess(true);
      // Refresh authoritative events list silently from server
      await fetchEvents(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit event to Admin.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="forum-events-section"
      className="mt-8 rounded-3xl border border-primary/40 bg-card p-6 sm:p-8 shadow-xl animate-in fade-in zoom-in-95 duration-300"
    >
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
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
            Verified initiatives, technical workshops, and activities organized by {forumName}
            {academicYear ? ` for ${academicYear}` : ""}.
          </p>
        </div>

        {/* Primary Action Button: "Add New Event on [Forum]" */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenNewModal}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs sm:text-sm font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all hover:scale-102 cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Add New Event on {forumName}</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-muted p-2.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Events Grid */}
      <div className="pt-6">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm font-medium">Loading events...</span>
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
              No conducted events posted yet for {forumName}
            </h4>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              Click the "Add New Event" button above to submit your completed event report and photos
              to the student affairs administrator.
            </p>
            <button
              type="button"
              onClick={handleOpenNewModal}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Submit First Event Report</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                </div>

                {/* Bottom Bar: Dates + Edit & Resubmit Button */}
                <div className="mt-4 pt-3 border-t border-border/60 text-xs text-muted-foreground flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-medium min-w-0 truncate">
                    <Calendar className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span className="truncate">
                      {ev.event_start} to {ev.event_end}
                    </span>
                  </div>

                  {/* Edit and Resubmit Button - Available in Student Portal & Admin Portal */}
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(ev)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200 transition-all hover:scale-102 cursor-pointer flex-shrink-0"
                    title="Edit and resubmit updated event details"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Event Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="relative my-8 w-full max-w-2xl rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  {club.name} • {forumName}
                  {academicYear ? ` • ${academicYear}` : ""}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-foreground">
                  {editingEventId ? `Edit & Resubmit Event on ${forumName}` : `Add New Event on ${forumName}`}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editingEventId
                    ? "Modify details below and resubmit. Your update will replace the previous submission in Admin."
                    : "Fill in the event details and submit to the Student Council Admin."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Success state */}
            {submitSuccess ? (
              <div className="py-8 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h4 className="text-xl font-bold text-foreground">
                  {editingEventId
                    ? "Event Updated & Resubmitted Successfully!"
                    : "Event Submitted to Admin Successfully!"}
                </h4>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {editingEventId
                    ? "Your changes have been updated in both the Student Portal and Admin Review Console in place."
                    : `Your event submission for ${forumName} has been forwarded to the Student Council Administrator for verification and Excel recording.`}
                </p>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                {submitError && (
                  <div className="rounded-xl bg-destructive/10 p-3.5 text-xs sm:text-sm text-destructive border border-destructive/20 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Event Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                    Event Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="e.g. National Level Hackathon 2025 / Classical Solo Contest"
                    className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Dates From and To */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                      From Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={eventStart}
                      onChange={(e) => setEventStart(e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                      To Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={eventEnd}
                      onChange={(e) => setEventEnd(e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {!isInstitutionalEvent && (
                  <>
                    {/* Resource Person names */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                        Resource Person Names &amp; Designations *
                      </label>
                      <textarea
                        required
                        rows={2}
                        maxLength={2000}
                        value={resourcePersons}
                        onChange={(e) => setResourcePersons(e.target.value)}
                        placeholder="e.g. Dr. K. Radhika (Principal Scientist), Mr. Amit Sharma (Director of Engineering, Google)"
                        className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* Submitter Name & Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                          Submitter Name *
                        </label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                          <input
                            type="text"
                            required
                            value={submitterName}
                            onChange={(e) => setSubmitterName(e.target.value)}
                            placeholder="e.g. Ananya Reddy"
                            className="w-full rounded-xl border border-input bg-background pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                          Submitter Student Email *
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                          <input
                            type="email"
                            required
                            value={submitterEmail}
                            onChange={(e) => setSubmitterEmail(e.target.value)}
                            placeholder="e.g. 21251a05xx@gnits.ac.in"
                            className="w-full rounded-xl border border-input bg-background pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Event Report format (PDF / Word) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                    Event Report Format (PDF / Word) *
                  </label>

                  {/* Show existing report indicator if editing */}
                  {editingEventId && existingReportName && !reportFile && (
                    <div className="mb-2 p-2.5 rounded-xl bg-orange-50 border border-orange-200 text-xs flex items-center justify-between">
                      <span className="font-semibold text-orange-950 truncate max-w-[340px]">
                        Current Report: <strong>{existingReportName}</strong>
                      </span>
                      <span className="text-[11px] text-orange-700 bg-white px-2 py-0.5 rounded-md border border-orange-200 font-bold">
                        Kept as-is
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <label className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                      <Upload className="h-5 w-5 text-primary" />
                      <span className="text-xs sm:text-sm font-semibold text-foreground">
                        {reportFile
                          ? reportFile.name
                          : editingEventId
                          ? "Upload new report to replace existing"
                          : "Choose Report (.pdf, .doc, .docx)"}
                      </span>
                      <input
                        type="file"
                        required={!editingEventId && !existingReportName}
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(e) => setReportFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                    {reportFile && (
                      <button
                        type="button"
                        onClick={() => setReportFile(null)}
                        className="text-xs text-destructive hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Supported formats: PDF (.pdf), Microsoft Word (.doc, .docx) up to 20MB.
                  </p>
                </div>

                {/* Event Photos Upload */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Event Photos (.jpg, .jpeg, .png, etc.)
                    </label>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {photoFiles.length > 0
                        ? `${photoFiles.length} new photos selected`
                        : editingEventId && existingPhotoPaths.length > 0
                        ? `${existingPhotoPaths.length} existing photos kept`
                        : "0 selected"}
                    </span>
                  </div>

                  {/* Show existing photos indicator if editing */}
                  {editingEventId && existingPhotoPaths.length > 0 && photoFiles.length === 0 && (
                    <div className="mb-2 p-2.5 rounded-xl bg-orange-50 border border-orange-200 text-xs flex items-center justify-between">
                      <span className="font-semibold text-orange-950">
                        {existingPhotoPaths.length} photos currently attached ({existingPhotoNames.slice(0, 2).join(", ")}...)
                      </span>
                      <span className="text-[11px] text-orange-700 bg-white px-2 py-0.5 rounded-md border border-orange-200 font-bold">
                        Kept as-is
                      </span>
                    </div>
                  )}

                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors text-center">
                    <ImageIcon className="h-6 w-6 text-primary mb-1" />
                    <span className="text-xs sm:text-sm font-semibold text-foreground">
                      {editingEventId ? "Click to upload replacement/new photos" : "Click to choose event photos (multiple allowed)"}
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">
                      Upload stage, audience, or ceremonial pictures in any image format
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,.jpg,.jpeg,.png,.webp"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>

                  {/* Selected Photos Preview Chips */}
                  {photoFiles.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                      {photoFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-foreground border border-border"
                        >
                          <span className="max-w-[140px] truncate">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removePhoto(idx)}
                            className="text-muted-foreground hover:text-destructive cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit / Resubmit to Admin Button */}
                <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{editingEventId ? "Updating in Admin..." : "Submitting to Admin..."}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{editingEventId ? "Update & Resubmit Event" : "Submit to Admin"}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
