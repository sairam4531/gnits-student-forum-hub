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
} from "lucide-react";
import { getPublicForumEvents, submitStudentEvent, type PublicEventRecord } from "@/lib/events.functions";
import { supabase } from "@/integrations/supabase/client";
import { type ForumClub } from "@/lib/student-forums";
import { getClientEvents, saveClientEvent } from "@/lib/client-portal-store";

interface ConductedEventsViewProps {
  club: ForumClub;
  forumName: string;
  forumSlug: string;
  onClose?: () => void;
}

interface PublicEvent {
  id: string;
  club_slug: string;
  forum_slug: string;
  event_name: string;
  event_start: string;
  event_end: string;
  created_at: string;
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
  onClose,
}: ConductedEventsViewProps) {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form input states
  const [eventName, setEventName] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [resourcePersons, setResourcePersons] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  // Fetch conducted events for this forum
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPublicForumEvents({
        data: {
          clubSlug: club.slug,
          forumSlug: forumSlug,
        },
      });

      // Combine with local client events so submitted events are never lost
      const clientEvs = getClientEvents().filter(
        (e) => e.club_slug === club.slug && e.forum_slug === forumSlug
      );
      const map = new Map<string, PublicEvent>();
      (data as PublicEvent[]).forEach((e) => map.set(e.id, e));
      clientEvs.forEach((e) => map.set(e.id, e as PublicEvent));
      setEvents(Array.from(map.values()));
    } catch (err: unknown) {
      console.warn("Could not load public events:", err);
      const clientEvs = getClientEvents().filter(
        (e) => e.club_slug === club.slug && e.forum_slug === forumSlug
      );
      setEvents(clientEvs as PublicEvent[]);
    } finally {
      setLoading(false);
    }
  }, [club.slug, forumSlug]);

  useEffect(() => {
    fetchEvents();
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

  // Submit Handler
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
    if (!resourcePersons.trim()) {
      setSubmitError("Resource person name(s) are required.");
      return;
    }
    if (!submitterName.trim()) {
      setSubmitError("Student submitter name is required.");
      return;
    }
    if (!submitterEmail.trim() || !submitterEmail.includes("@")) {
      setSubmitError("A valid student email address is required.");
      return;
    }
    if (!reportFile) {
      setSubmitError("Please upload the Event Report (PDF or Word format).");
      return;
    }

    setSubmitting(true);

    try {
      const submissionId = crypto.randomUUID();
      const sanitizeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

      // 1. Prepare file paths
      const reportSafeName = sanitizeName(reportFile.name);
      const reportPath = `submissions/${submissionId}/${reportSafeName}`;

      // Convert files to base64 for reliable persistent storage
      const reportBase64 = await fileToBase64(reportFile);

      const photoPaths: string[] = [];
      const photoNames: string[] = [];
      const photoBase64s: string[] = [];

      for (let i = 0; i < photoFiles.length; i++) {
        const photo = photoFiles[i]!;
        const photoSafeName = `${i}_${sanitizeName(photo.name)}`;
        const photoPath = `submissions/${submissionId}/${photoSafeName}`;
        photoPaths.push(photoPath);
        photoNames.push(photo.name);
        const b64 = await fileToBase64(photo);
        photoBase64s.push(b64);
      }

      // Optional remote Supabase storage upload if alive
      try {
        await supabase.storage.from("student-forum-files").upload(reportPath, reportFile);
        for (let i = 0; i < photoFiles.length; i++) {
          await supabase.storage.from("student-forum-files").upload(photoPaths[i]!, photoFiles[i]!);
        }
      } catch (uploadErr) {
        console.warn("Remote storage note (using persistent local storage):", uploadErr);
      }

      // 2. Call server function to record event and persist files locally
      const res = await submitStudentEvent({
        data: {
          clubSlug: club.slug,
          forumSlug: forumSlug,
          eventName: eventName.trim(),
          eventStart,
          eventEnd,
          resourcePersons: resourcePersons.trim(),
          submitterName: submitterName.trim(),
          submitterEmail: submitterEmail.trim().toLowerCase(),
          reportObjectPath: reportPath,
          reportFileName: reportFile.name,
          reportContentType: reportFile.type || "application/pdf",
          photoObjectPaths: photoPaths,
          photoFileNames: photoNames,
          reportBase64,
          photoBase64s,
        },
      });

      // Save to client persistent store so it persists permanently until deleted
      const clientEventRecord: PublicEventRecord = {
        id: res.id || `event-${Date.now()}`,
        club_slug: club.slug,
        forum_slug: forumSlug,
        event_name: eventName.trim(),
        event_start: eventStart,
        event_end: eventEnd,
        created_at: new Date().toISOString(),
        resource_persons: resourcePersons.trim(),
      };
      saveClientEvent(clientEventRecord);

      setSubmitSuccess(true);
      // Reset form
      setEventName("");
      setEventStart("");
      setEventEnd("");
      setResourcePersons("");
      setSubmitterName("");
      setSubmitterEmail("");
      setReportFile(null);
      setPhotoFiles([]);

      // Refresh public events list
      fetchEvents();
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
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-foreground mt-1">
            Conducted Events on {forumName}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Verified initiatives, technical workshops, and activities organized by {forumName}.
          </p>
        </div>

        {/* Primary Action Button: "Add New Event on [Forum]" as requested */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setSubmitSuccess(false);
              setSubmitError(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl hover:scale-102"
          >
            <PlusCircle className="h-5 w-5" />
            <span>Add New Event on {forumName}</span>
          </button>
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

      {/* Events List */}
      <div className="pt-6">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm font-medium">Loading conducted events on {forumName}...</span>
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
              No conducted events recorded for {forumName} yet
            </h4>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              Be the first to record an event! Click the button above to upload event details,
              report, and stage photographs for administrative review.
            </p>
            <button
              type="button"
              onClick={() => {
                setSubmitSuccess(false);
                setSubmitError(null);
                setIsModalOpen(true);
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary/10 text-primary px-4 py-2 text-xs sm:text-sm font-semibold border border-primary/20 hover:bg-primary/20 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Submit Event Record</span>
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

                <div className="mt-4 pt-3 border-t border-border/60 text-xs text-muted-foreground flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span>
                      {ev.event_start} to {ev.event_end}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New Event Modal */}
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
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-foreground">
                  Add New Event on {forumName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
                  Event Submitted to Admin Successfully!
                </h4>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Your event submission for <strong>{forumName}</strong> has been forwarded to the
                  Student Council Administrator for verification and Excel recording.
                </p>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
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

                {/* Dates From and To as requested */}
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

                {/* Resource Person names as requested */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                    Resource Person Names & Designations *
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

                {/* Event Report format like PDF, Word as requested */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                    Event Report Format (PDF / Word) *
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                      <Upload className="h-5 w-5 text-primary" />
                      <span className="text-xs sm:text-sm font-semibold text-foreground">
                        {reportFile ? reportFile.name : "Choose Report (.pdf, .doc, .docx)"}
                      </span>
                      <input
                        type="file"
                        required
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(e) => setReportFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                    {reportFile && (
                      <button
                        type="button"
                        onClick={() => setReportFile(null)}
                        className="text-xs text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Supported formats: PDF (.pdf), Microsoft Word (.doc, .docx) up to 20MB.
                  </p>
                </div>

                {/* Event Photos upload in any format like .jpg (their choice how many photos) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Event Photos (.jpg, .jpeg, .png, etc.)
                    </label>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {photoFiles.length} / 20 selected
                    </span>
                  </div>

                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors text-center">
                    <ImageIcon className="h-6 w-6 text-primary mb-1" />
                    <span className="text-xs sm:text-sm font-semibold text-foreground">
                      Click to choose event photos (multiple allowed)
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
                            className="text-muted-foreground hover:text-destructive"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit to Admin Button as requested */}
                <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Submitting to Admin...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Submit to Admin</span>
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
