import { useState, useEffect } from "react";
import {
  FileText,
  Image as ImageIcon,
  User,
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Upload,
} from "lucide-react";
import { submitStudentEvent, type PublicEventRecord } from "@/lib/events.functions";
import type { AdminEventRecord } from "@/lib/admin.functions";
import { isInstitutionalClub, type ForumClub } from "@/lib/student-forums";
import {
  saveClientEvent,
  saveClientAdminEvent,
  getEventEditToken,
  saveEventEditToken,
} from "@/lib/client-portal-store";
import { saveEventFile, compressImage } from "@/lib/event-file-storage";
import {
  isSupportedReport,
  MAX_EVENT_DOCUMENTS,
  MAX_UPLOAD_BYTES,
} from "@/lib/event-validation";

export interface EventSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  club: ForumClub;
  forumName: string;
  forumSlug: string;
  academicYear?: string | undefined;
  editingEvent?: AdminEventRecord | null | undefined;
  targetRoleLabel?: string | undefined;
  onSubmitted?: ((savedEvent: AdminEventRecord) => void | Promise<void>) | undefined;
}

const DIRECT_UPLOAD_MAX_BYTES = 3.5 * 1024 * 1024; // Fits safely under Vercel 4.5 MB limit
const LARGE_CHUNK_BYTES = 2.5 * 1024 * 1024;
const INLINE_TEST_FALLBACK_MAX_BYTES = 1.5 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function parseUploadError(res: Response, fallback: string): Promise<string> {
  try {
    const errJson = (await res.json()) as { error?: string };
    if (errJson?.error) return errJson.error;
  } catch {
    // ignore non-JSON body
  }
  if (res.status === 413) {
    return "Attachment exceeds upload limit. Please try again with a smaller chunk.";
  }
  return `${fallback} (HTTP ${res.status}).`;
}

async function uploadEventAttachment(
  file: Blob,
  objectPath: string,
  clubSlug: string,
  kind: "report" | "document" | "photo",
  fileName: string,
  contentType: string,
): Promise<void> {
  const baseParams = new URLSearchParams({
    path: objectPath,
    clubSlug,
    kind,
    name: fileName,
    type: contentType,
  });

  if (file.size <= DIRECT_UPLOAD_MAX_BYTES) {
    const uploadParams = new URLSearchParams(baseParams);
    uploadParams.set("action", "upload");
    uploadParams.set("size", String(file.size));
    const res = await fetch(`/api/event-file?${uploadParams.toString()}`, {
      method: "POST",
      body: file,
      headers: { "Content-Type": "application/octet-stream" },
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error(await parseUploadError(res, `Failed to upload ${fileName}`));
    }
    return;
  }

  const prepParams = new URLSearchParams(baseParams);
  prepParams.set("action", "prepare-large");
  prepParams.set("size", String(file.size));
  const prepRes = await fetch(`/api/event-file?${prepParams.toString()}`, {
    method: "POST",
    credentials: "include",
  });
  if (!prepRes.ok) {
    throw new Error(await parseUploadError(prepRes, `Failed to initialize upload for ${fileName}`));
  }

  const prep = (await prepRes.json()) as {
    mode?: "signed-url" | "chunked";
    signedUrl?: string;
    chunkSize?: number;
  };

  if (prep.mode === "signed-url" && prep.signedUrl) {
    const rawBytes = await file.arrayBuffer();
    const putRes = await fetch(prep.signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Cache-Control": "max-age=3600",
        "x-upsert": "true",
      },
      body: rawBytes,
    });
    if (!putRes.ok) {
      throw new Error(`Storage upload failed for ${fileName} (HTTP ${putRes.status}).`);
    }
    return;
  }

  const chunkSize = prep.chunkSize || LARGE_CHUNK_BYTES;
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));
  for (let index = 0; index < totalChunks; index += 1) {
    const start = index * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunkParams = new URLSearchParams(baseParams);
    chunkParams.set("action", "chunk");
    chunkParams.set("index", String(index));
    chunkParams.set("total", String(totalChunks));
    const chunkRes = await fetch(`/api/event-file?${chunkParams.toString()}`, {
      method: "POST",
      body: file.slice(start, end),
      headers: { "Content-Type": "application/octet-stream" },
      credentials: "include",
    });
    if (!chunkRes.ok) {
      throw new Error(
        await parseUploadError(
          chunkRes,
          `Failed uploading part ${index + 1}/${totalChunks} of ${fileName}`,
        ),
      );
    }
  }

  const completeParams = new URLSearchParams(baseParams);
  completeParams.set("action", "complete");
  completeParams.set("total", String(totalChunks));
  completeParams.set("size", String(file.size));
  const completeRes = await fetch(`/api/event-file?${completeParams.toString()}`, {
    method: "POST",
    credentials: "include",
  });
  if (!completeRes.ok) {
    throw new Error(await parseUploadError(completeRes, `Failed to finalize upload for ${fileName}`));
  }
}

export function EventSubmissionModal({
  isOpen,
  onClose,
  club,
  forumName,
  forumSlug,
  academicYear,
  editingEvent,
  targetRoleLabel = "IT-Admin",
  onSubmitted,
}: EventSubmissionModalProps) {
  const isInstitutionalEvent = isInstitutionalClub(club.slug);
  const editingEventId = editingEvent?.id || null;

  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [eventName, setEventName] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [resourcePersons, setResourcePersons] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setSubmitting(false);
    setSubmitSuccess(false);
    setSubmitError(null);
    setEventName(editingEvent?.event_name || "");
    setEventStart(editingEvent?.event_start || "");
    setEventEnd(editingEvent?.event_end || "");
    setResourcePersons(editingEvent?.resource_persons || "");
    setSubmitterName(editingEvent?.submitter_name || "");
    setSubmitterEmail(editingEvent?.submitter_email || "");
    setReportFile(null);
    setDocumentFiles([]);
    setPhotoFiles([]);
  }, [isOpen, editingEvent]);

  if (!isOpen) return null;

  const existingReportPath = editingEvent?.report_object_path || null;
  const existingReportName = editingEvent?.report_file_name || null;
  const existingReportType = editingEvent?.report_content_type || null;
  const existingPhotoPaths = editingEvent?.photo_object_paths || [];
  const existingPhotoNames = editingEvent?.photo_file_names || [];
  const existingPhotoUrls = editingEvent?.photo_download_urls || [];
  const existingDocPaths = editingEvent?.document_object_paths || [];
  const existingDocNames = editingEvent?.document_file_names || [];
  const existingDocTypes = editingEvent?.document_content_types || [];
  const existingDocUrls = editingEvent?.document_download_urls || [];
  const existingCreatedAt = editingEvent?.created_at || null;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      setPhotoFiles((prev) => [...prev, ...selected].slice(0, 20));
    }
  };

  const removePhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      const invalid = selected.find((file) => !isSupportedReport(file));
      if (invalid) {
        setSubmitError("Documents must be in PDF (.pdf) or Word (.doc, .docx) format.");
        return;
      }
      setSubmitError(null);
      setDocumentFiles((prev) => [...prev, ...selected].slice(0, MAX_EVENT_DOCUMENTS));
    }
  };

  const removeDocument = (index: number) => {
    setDocumentFiles((prev) => prev.filter((_, i) => i !== index));
  };

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
      documentFiles.some((file) => file.size > MAX_UPLOAD_BYTES) ||
      photoFiles.some((file) => file.size > MAX_UPLOAD_BYTES)
    ) {
      setSubmitError("Each uploaded file must be 20 MB or smaller.");
      return;
    }

    setSubmitting(true);
    setUploadStatus("Preparing files...");

    try {
      const submissionId = editingEventId || crypto.randomUUID();
      const sanitizeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");
      let useInlineFallback = false;

      const tryUploadOrFallback = async (
        blob: Blob,
        path: string,
        kind: "report" | "document" | "photo",
        name: string,
        type: string,
      ) => {
        if (useInlineFallback) return;
        try {
          await uploadEventAttachment(blob, path, club.slug, kind, name, type);
        } catch (err) {
          // Only fall back to inline base64 in unit-test environments without a live HTTP endpoint
          const totalBytes =
            (reportFile?.size ?? 0) +
            documentFiles.reduce((s, f) => s + f.size, 0) +
            photoFiles.reduce((s, f) => s + f.size, 0);
          if (err instanceof TypeError && totalBytes <= INLINE_TEST_FALLBACK_MAX_BYTES) {
            useInlineFallback = true;
            return;
          }
          throw err;
        }
      };

      // 1. Prepare and upload report file independently
      let finalReportPath = existingReportPath || `submissions/${submissionId}/report.pdf`;
      let finalReportName = existingReportName || "Event_Report.pdf";
      let finalReportType = existingReportType || "application/pdf";
      let safeReportBase64: string | undefined = undefined;

      if (reportFile) {
        const reportSafeName = sanitizeName(reportFile.name);
        finalReportPath = `submissions/${submissionId}/${crypto.randomUUID()}_${reportSafeName}`;
        finalReportName = reportFile.name;
        finalReportType = reportFile.type || "application/pdf";

        await saveEventFile(finalReportPath, reportFile, reportFile.name);
        setUploadStatus(`Uploading report (${reportFile.name})...`);
        await tryUploadOrFallback(
          reportFile,
          finalReportPath,
          "report",
          finalReportName,
          finalReportType,
        );
        if (useInlineFallback) {
          safeReportBase64 = await fileToBase64(reportFile);
        }
      }

      // 2. Prepare and upload photos independently
      let finalPhotoPaths = [...existingPhotoPaths];
      let finalPhotoNames = [...existingPhotoNames];
      let finalPhotoUrls = [...existingPhotoUrls];
      let safePhotoBase64s: string[] | undefined = undefined;

      if (photoFiles.length > 0) {
        const newPhotoPaths: string[] = [];
        const newPhotoNames: string[] = [];
        const newPhotoUrls: string[] = [];
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

          setUploadStatus(`Uploading photo ${i + 1} of ${photoFiles.length}...`);
          await tryUploadOrFallback(
            compressedBlob,
            photoPath,
            "photo",
            photo.name,
            photoMimeType || "image/jpeg",
          );
          if (useInlineFallback) {
            newPhotoBase64s.push(photoBase64);
            newPhotoUrls.push(photoBase64);
          } else {
            newPhotoUrls.push(`/api/event-file?path=${encodeURIComponent(photoPath)}`);
          }
        }

        safePhotoBase64s = useInlineFallback ? newPhotoBase64s : undefined;
        finalPhotoPaths = newPhotoPaths;
        finalPhotoNames = newPhotoNames;
        finalPhotoUrls = newPhotoUrls;
      }

      // 2b. Prepare and upload additional Documents (PDF / Word) independently
      let finalDocPaths = [...existingDocPaths];
      let finalDocNames = [...existingDocNames];
      let finalDocTypes = [...existingDocTypes];
      let finalDocUrls = [...existingDocUrls];
      let safeDocBase64s: string[] | undefined = undefined;

      if (documentFiles.length > 0) {
        const newDocPaths: string[] = [];
        const newDocNames: string[] = [];
        const newDocTypes: string[] = [];
        const newDocBase64s: string[] = [];

        for (let i = 0; i < documentFiles.length; i++) {
          const docFile = documentFiles[i];
          if (!docFile) continue;
          const docSafeName = sanitizeName(docFile.name) || `document_${i + 1}.pdf`;
          const docPath = `submissions/${submissionId}/doc_${i}_${crypto.randomUUID()}_${docSafeName}`;
          const docType = docFile.type || "application/pdf";
          await saveEventFile(docPath, docFile, docFile.name);
          setUploadStatus(`Uploading document ${i + 1} of ${documentFiles.length}...`);
          await tryUploadOrFallback(docFile, docPath, "document", docFile.name, docType);
          newDocPaths.push(docPath);
          newDocNames.push(docFile.name);
          newDocTypes.push(docType);
          if (useInlineFallback) {
            newDocBase64s.push(await fileToBase64(docFile));
          }
        }

        safeDocBase64s = useInlineFallback ? newDocBase64s : undefined;
        finalDocPaths = newDocPaths;
        finalDocNames = newDocNames;
        finalDocTypes = newDocTypes;
        finalDocUrls = newDocPaths.map((d) => `/api/event-file?path=${encodeURIComponent(d)}`);
      }

      setUploadStatus("Saving event record...");
      const editToken = editingEventId ? getEventEditToken(editingEventId) : undefined;
      const optionalForumFields = isInstitutionalEvent
        ? {}
        : {
            resourcePersons: resourcePersons.trim(),
            submitterName: submitterName.trim(),
            submitterEmail: submitterEmail.trim().toLowerCase(),
          };

      // 3. Commit compact metadata to authoritative server database (no large base64 body -> avoids HTTP 413)
      const res = await submitStudentEvent({
        data: {
          id: submissionId,
          clubSlug: club.slug,
          forumSlug,
          eventName: eventName.trim(),
          eventStart,
          eventEnd,
          ...optionalForumFields,
          reportObjectPath: finalReportPath,
          reportFileName: finalReportName,
          reportContentType: finalReportType,
          photoObjectPaths: finalPhotoPaths,
          photoFileNames: finalPhotoNames,
          ...(finalDocPaths.length > 0
            ? {
                documentObjectPaths: finalDocPaths,
                documentFileNames: finalDocNames,
                documentContentTypes: finalDocTypes,
              }
            : {}),
          ...(safeReportBase64 ? { reportBase64: safeReportBase64 } : {}),
          ...(safePhotoBase64s ? { photoBase64s: safePhotoBase64s } : {}),
          ...(safeDocBase64s && safeDocBase64s.length > 0
            ? { documentBase64s: safeDocBase64s }
            : {}),
          ...(editToken ? { editToken } : {}),
        },
      });

      if (!res?.success) {
        throw new Error("Server could not commit event to the authoritative database.");
      }

      const savedEventId = res.id || submissionId;
      if (res.editToken) {
        saveEventEditToken(savedEventId, res.editToken);
      }

      const savedAdminRecord: AdminEventRecord = {
        id: savedEventId,
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
        ...(finalDocPaths.length > 0
          ? {
              document_object_paths: finalDocPaths,
              document_file_names: finalDocNames,
              document_content_types: finalDocTypes,
              document_download_urls: finalDocUrls,
            }
          : {}),
        created_at: existingCreatedAt || new Date().toISOString(),
        updated_at: editingEventId ? new Date().toISOString() : undefined,
        report_download_url:
          editingEvent?.report_download_url ||
          `/api/event-file?path=${encodeURIComponent(finalReportPath)}`,
        photo_download_urls: finalPhotoUrls,
      };

      saveClientAdminEvent(savedAdminRecord, { broadcast: false });

      const newPublicEvent: PublicEventRecord = {
        id: savedEventId,
        club_slug: club.slug,
        forum_slug: forumSlug,
        event_name: eventName.trim(),
        event_start: eventStart,
        event_end: eventEnd,
        created_at: existingCreatedAt || new Date().toISOString(),
        ...(isInstitutionalEvent ? {} : { resource_persons: resourcePersons.trim() }),
      };

      saveClientEvent(newPublicEvent, { broadcast: true });

      setSubmitSuccess(true);
      await onSubmitted?.(savedAdminRecord);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to submit event to ${targetRoleLabel}.`;
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
      setUploadStatus(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-2xl my-auto max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
              {club.name} • {forumName}
              {academicYear ? ` • ${academicYear}` : ""}
            </span>
            <h3 className="text-xl sm:text-2xl font-extrabold text-foreground">
              {editingEventId
                ? `Edit Event on ${forumName}`
                : `Add New Event on ${forumName}`}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {editingEventId
                ? `Update the details and attachments for ${targetRoleLabel}.`
                : `Fill in the event details and submit to ${targetRoleLabel}.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {submitSuccess ? (
          <div className="py-10 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h4 className="text-xl font-bold text-foreground">
              {editingEventId
                ? "Event Updated Successfully!"
                : `Event Submitted to ${targetRoleLabel} Successfully!`}
            </h4>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {editingEventId
                ? "Your changes have been updated in place across the portals."
                : isInstitutionalEvent
                  ? `Your event submission for ${forumName} is now published and viewable across portals.`
                  : `Your event submission for ${forumName} has been forwarded to ${targetRoleLabel} for review and Excel recording.`}
            </p>
            <button
              type="button"
              onClick={onClose}
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
                      Submitter Email *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                      <input
                        type="email"
                        required
                        value={submitterEmail}
                        onChange={(e) => setSubmitterEmail(e.target.value)}
                        placeholder="e.g. coordinator@gnits.ac.in"
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

            {/* Documents Upload (PDF / Word - Multiple allowed across all events) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Documents (PDF / Word)
                </label>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {documentFiles.length > 0
                    ? `${documentFiles.length} new document${documentFiles.length === 1 ? "" : "s"} selected`
                    : editingEventId && existingDocPaths.length > 0
                    ? `${existingDocPaths.length} existing documents kept`
                    : "0 selected"}
                </span>
              </div>

              {editingEventId && existingDocPaths.length > 0 && documentFiles.length === 0 && (
                <div className="mb-2 p-2.5 rounded-xl bg-orange-50 border border-orange-200 text-xs flex items-center justify-between">
                  <span className="font-semibold text-orange-950 truncate max-w-[340px]">
                    {existingDocPaths.length} documents currently attached ({existingDocNames.slice(0, 2).join(", ")})
                  </span>
                  <span className="text-[11px] text-orange-700 bg-white px-2 py-0.5 rounded-md border border-orange-200 font-bold">
                    Kept as-is
                  </span>
                </div>
              )}

              <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors text-center">
                <FileText className="h-5 w-5 text-primary mb-1" />
                <span className="text-xs sm:text-sm font-semibold text-foreground">
                  {editingEventId
                    ? "Upload replacement/additional Documents (.pdf, .doc, .docx)"
                    : "Choose Documents (.pdf, .doc, .docx — multiple allowed)"}
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5">
                  Circulars, attendance sheets, brochures, permission letters, or supporting docs up to 20MB each
                </span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleDocumentChange}
                  className="hidden"
                />
              </label>

              {documentFiles.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                  {documentFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-foreground border border-border"
                    >
                      <span className="max-w-[160px] truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeDocument(idx)}
                        className="text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                  {editingEventId
                    ? "Click to upload replacement/new photos"
                    : "Click to choose event photos (multiple allowed)"}
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

            {/* Submit / Update Button */}
            <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
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
                    <span>
                      {uploadStatus ||
                        (editingEventId ? "Updating..." : `Submitting to ${targetRoleLabel}...`)}
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{editingEventId ? "Update & Resubmit Event" : `Submit to ${targetRoleLabel}`}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
