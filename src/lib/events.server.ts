// Server-only event submission processor with Supabase primary & durable Cloudflare KV persistence.
import type { AdminEventRecord } from "@/lib/admin.functions";
import { verifySession } from "@/lib/admin-session.server";
import { isSubmissionPath, MAX_UPLOAD_BYTES, type EventSubmission } from "@/lib/event-validation";
import {
  buildEventFileDownloadUrl,
  getEventFileFromKv,
  getEventsStoreAsync,
  saveEventFileToKv,
  saveEventsStoreAsync,
  saveFileLocally,
} from "@/lib/local-events-store";
import { getCloudflareKVNamespace } from "@/lib/local-homepage-store";

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function decodeEventFileDataUrl(
  dataUrl: string,
  fallbackContentType: string,
): { bytes: Uint8Array; contentType: string } {
  const maxBase64Chars = Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 256;
  if (dataUrl.length > maxBase64Chars) {
    throw new Error("Each event attachment must be 20 MB or smaller.");
  }
  const match = /^data:([^;,]*);base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataUrl);
  const encoded = match?.[2];
  if (encoded === undefined || encoded.length === 0) {
    throw new Error("An event attachment could not be read. Please upload it again.");
  }
  let binary: string;
  try {
    binary = atob(encoded);
  } catch {
    throw new Error("An event attachment could not be read. Please upload it again.");
  }
  if (binary.length > MAX_UPLOAD_BYTES) {
    throw new Error("Each event attachment must be 20 MB or smaller.");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return {
    bytes,
    contentType: match?.[1] || fallbackContentType || "application/octet-stream",
  };
}

export async function processStudentEventSubmission(
  data: EventSubmission,
  adminSessionToken: string | undefined,
): Promise<{ id: string; success: boolean; editToken?: string }> {
  const eventId = data.id || globalThis.crypto.randomUUID();
  const submissionFolder = `submissions/${eventId}/`;
  const submissionPaths = [data.reportObjectPath, ...data.photoObjectPaths];
  if (
    submissionPaths.some(
      (path) => !isSubmissionPath(path) || !path.startsWith(submissionFolder),
    )
  ) {
    throw new Error("Event attachments must belong to this submission.");
  }

  const {
    supabaseAdmin,
    hasSupabaseAdminConfig,
    getSupabaseAdminConfigErrorMessage,
  } = await import("@/integrations/supabase/client.server");

  const supabaseReady = hasSupabaseAdminConfig();
  const hasCfKv = Boolean(getCloudflareKVNamespace());

  // Require either valid Supabase admin credentials or durable Cloudflare KV storage
  if (!supabaseReady && !hasCfKv) {
    const configError = getSupabaseAdminConfigErrorMessage();
    throw new Error(
      configError || "Database configuration error: Server storage is not configured.",
    );
  }

  const currentEvents = await getEventsStoreAsync({
    strictKv: hasCfKv && !supabaseReady,
  });
  const existingStoreIndex = currentEvents.findIndex((e) => e.id === eventId);
  const existingStoreEvent =
    existingStoreIndex >= 0 ? currentEvents[existingStoreIndex] : undefined;

  let existingRemoteRow = false;
  if (supabaseReady) {
    const { data: existingRow, error: checkError } = await supabaseAdmin
      .from("student_forum_events")
      .select("id")
      .eq("id", eventId)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116" && checkError.code !== "42501") {
      console.warn("Supabase record check note:", checkError.message);
    }
    existingRemoteRow = Boolean(existingRow);
  }

  const isUpdate = existingRemoteRow || Boolean(existingStoreEvent);
  let issuedEditToken: string | undefined;
  let nextEditTokenHash = existingStoreEvent?.edit_token_hash;

  const normalizedResourcePersons = data.resourcePersons?.trim() || "";
  const normalizedSubmitterName = data.submitterName?.trim() || null;
  const normalizedSubmitterEmail = data.submitterEmail?.trim().toLowerCase() || null;

  if (isUpdate) {
    const session = await verifySession(adminSessionToken);
    let authorized = Boolean(session);

    if (!authorized && data.editToken && existingStoreEvent?.edit_token_hash) {
      const incomingHash = await sha256Hex(data.editToken);
      if (incomingHash === existingStoreEvent.edit_token_hash) {
        authorized = true;
      }
    }

    // Allow legacy records submitted before edit tokens existed ONLY when matching private submitter email
    if (
      !authorized &&
      existingStoreEvent &&
      !existingStoreEvent.edit_token_hash &&
      !existingRemoteRow &&
      normalizedSubmitterEmail &&
      existingStoreEvent.submitter_email?.trim().toLowerCase() === normalizedSubmitterEmail
    ) {
      authorized = true;
      issuedEditToken = globalThis.crypto.randomUUID();
      nextEditTokenHash = await sha256Hex(issuedEditToken);
    }

    if (!authorized) {
      throw new Error(
        "Unauthorized: Only the original submitting portal session, matching submitter verification, or an authenticated Student Affairs administrator can edit this event.",
      );
    }
  } else {
    issuedEditToken = globalThis.crypto.randomUUID();
    nextEditTokenHash = await sha256Hex(issuedEditToken);
  }

  // Store submitted report and photo files locally and in Cloudflare KV (when bound)
  const keepExistingReport =
    isUpdate &&
    !data.reportBase64 &&
    (data.reportObjectPath === `submissions/${eventId}/report.pdf` ||
      data.reportObjectPath === existingStoreEvent?.report_object_path);

  const finalReportObjectPath = keepExistingReport
    ? existingStoreEvent?.report_object_path || data.reportObjectPath
    : data.reportObjectPath;
  const finalReportFileName = keepExistingReport
    ? existingStoreEvent?.report_file_name || data.reportFileName
    : data.reportFileName;
  const finalReportContentType = keepExistingReport
    ? existingStoreEvent?.report_content_type || data.reportContentType
    : data.reportContentType;

  let reportDownloadUrl =
    (keepExistingReport ? existingStoreEvent?.report_download_url : undefined) ||
    `/${finalReportObjectPath}`;
  if (data.reportBase64) {
    saveFileLocally(finalReportObjectPath, data.reportBase64);
    const savedKvReport = await saveEventFileToKv(
      finalReportObjectPath,
      data.reportBase64,
      finalReportContentType,
      finalReportFileName,
    );
    if (savedKvReport) {
      reportDownloadUrl = buildEventFileDownloadUrl(finalReportObjectPath);
    } else if (hasCfKv && !supabaseReady) {
      throw new Error("Failed to store event report file in Cloudflare KV.");
    }
  }

  const keepExistingPhotos =
    isUpdate &&
    Boolean(existingStoreEvent) &&
    data.photoObjectPaths.length === 0 &&
    (!data.photoBase64s || data.photoBase64s.length === 0) &&
    (existingStoreEvent?.photo_object_paths?.length ?? 0) > 0;

  const finalPhotoObjectPaths = keepExistingPhotos && existingStoreEvent
    ? existingStoreEvent.photo_object_paths
    : data.photoObjectPaths;
  const finalPhotoFileNames = keepExistingPhotos && existingStoreEvent
    ? existingStoreEvent.photo_file_names
    : data.photoFileNames;

  const photoDownloadUrls: string[] = keepExistingPhotos
    ? existingStoreEvent?.photo_download_urls ||
      finalPhotoObjectPaths.map((p) => buildEventFileDownloadUrl(p))
    : [];

  if (!keepExistingPhotos) {
    for (let i = 0; i < finalPhotoObjectPaths.length; i++) {
      const pPath = finalPhotoObjectPaths[i];
      const pName = finalPhotoFileNames[i];
      const b64 = data.photoBase64s?.[i];
      if (!pPath) continue;

      let resolvedPhotoUrl = existingStoreEvent?.photo_download_urls?.[i] || `/${pPath}`;
      if (b64) {
        saveFileLocally(pPath, b64);
        const savedKvPhoto = await saveEventFileToKv(pPath, b64, undefined, pName);
        if (savedKvPhoto) {
          resolvedPhotoUrl = buildEventFileDownloadUrl(pPath);
        } else if (hasCfKv && !supabaseReady) {
          throw new Error("Failed to store event photo file in Cloudflare KV.");
        }
      }
      photoDownloadUrls.push(resolvedPhotoUrl);
    }
  }

  // Commit to Supabase when genuine service-role configuration is present
  if (supabaseReady) {
    const ensureExistingFile = async (path: string) => {
      const { data: signedFile, error: signedFileError } = await supabaseAdmin.storage
        .from("student-forum-files")
        .createSignedUrl(path, 60);
      if (!signedFileError && signedFile?.signedUrl) return;

      const savedFile = await getEventFileFromKv(path);
      if (!savedFile) {
        throw new Error("A previously saved event attachment is missing. Please upload it again.");
      }
      const { error: restoreError } = await supabaseAdmin.storage
        .from("student-forum-files")
        .upload(path, new Uint8Array(savedFile.bytes), {
          contentType: savedFile.contentType,
          upsert: false,
        });
      if (restoreError) {
        console.error("Could not restore an existing event attachment:", restoreError.message);
        throw new Error("A previously saved event attachment could not be restored.");
      }
    };

    const uploadNewFile = async (path: string, dataUrl: string, contentType: string) => {
      const decoded = decodeEventFileDataUrl(dataUrl, contentType);
      const { error: uploadError } = await supabaseAdmin.storage
        .from("student-forum-files")
        .upload(path, decoded.bytes, { contentType: decoded.contentType, upsert: false });
      if (uploadError) {
        console.error("Event attachment upload failed:", uploadError.message);
        throw new Error("An event attachment could not be saved. Please retry the submission.");
      }
    };

    if (data.reportBase64) {
      await uploadNewFile(finalReportObjectPath, data.reportBase64, finalReportContentType);
    } else if (isUpdate) {
      await ensureExistingFile(finalReportObjectPath);
    } else {
      throw new Error("Please upload the event report before submitting.");
    }

    for (let index = 0; index < finalPhotoObjectPaths.length; index++) {
      const photoPath = finalPhotoObjectPaths[index];
      if (!photoPath) continue;
      const photoDataUrl = data.photoBase64s?.[index];
      if (photoDataUrl) {
        await uploadNewFile(photoPath, photoDataUrl, "image/jpeg");
      } else if (isUpdate) {
        await ensureExistingFile(photoPath);
      } else {
        throw new Error("An event photo could not be read. Please upload it again.");
      }
    }

    const { error: upsertError } = await supabaseAdmin.from("student_forum_events").upsert({
      id: eventId,
      club_slug: data.clubSlug,
      forum_slug: data.forumSlug,
      event_name: data.eventName,
      event_start: data.eventStart,
      event_end: data.eventEnd,
      resource_persons: normalizedResourcePersons,
      submitter_name: normalizedSubmitterName,
      submitter_email: normalizedSubmitterEmail,
      report_object_path: finalReportObjectPath,
      report_file_name: finalReportFileName,
      report_content_type: finalReportContentType,
      photo_object_paths: finalPhotoObjectPaths,
      photo_file_names: finalPhotoFileNames,
    });

    if (upsertError) {
      console.error(
        "Supabase student event upsert failed:",
        upsertError.message || upsertError.code,
      );
      if (
        upsertError.code === "42501" ||
        upsertError.message?.toLowerCase().includes("permission denied")
      ) {
        throw new Error(
          "Database permission error: Unable to commit event submission. The server-side service-role credential lacks write permissions or is misconfigured.",
        );
      }
      throw new Error(
        `Database commit failed: ${upsertError.message || upsertError.code || "Database error"}`,
      );
    }
  } else {
    console.warn(
      "[Events] Supabase service-role secret is unavailable or invalid; saving event to durable Cloudflare KV storage.",
    );
  }

  // Persist in Cloudflare KV / local store (primary when KV-backed, secondary mirror with Supabase)
  const eventRecord: AdminEventRecord = {
    id: eventId,
    club_slug: data.clubSlug,
    forum_slug: data.forumSlug,
    event_name: data.eventName,
    event_start: data.eventStart,
    event_end: data.eventEnd,
    resource_persons: normalizedResourcePersons,
    submitter_name: normalizedSubmitterName,
    submitter_email: normalizedSubmitterEmail,
    report_object_path: finalReportObjectPath,
    report_file_name: finalReportFileName,
    report_content_type: finalReportContentType,
    photo_object_paths: finalPhotoObjectPaths,
    photo_file_names: finalPhotoFileNames,
    created_at: existingStoreEvent?.created_at || new Date().toISOString(),
    updated_at: isUpdate ? new Date().toISOString() : undefined,
    report_download_url: reportDownloadUrl,
    photo_download_urls: photoDownloadUrls,
    edit_token_hash: nextEditTokenHash,
  };

  try {
    // Re-read the latest KV snapshot right before writing so files uploaded earlier
    // do not create a stale read-modify-write race against concurrent submissions.
    const latestEvents = await getEventsStoreAsync({ strictKv: hasCfKv });
    const latestStoreIndex = latestEvents.findIndex((e) => e.id === eventId);
    const updatedEvents = [...latestEvents];
    if (latestStoreIndex >= 0) {
      updatedEvents[latestStoreIndex] = eventRecord;
    } else {
      updatedEvents.unshift(eventRecord);
    }
    await saveEventsStoreAsync(updatedEvents);
  } catch (kvErr) {
    if (!supabaseReady) {
      throw new Error(
        kvErr instanceof Error
          ? `Failed to save event submission to Cloudflare KV: ${kvErr.message}`
          : "Failed to save event submission to Cloudflare KV.",
      );
    }
    console.warn("KV cache update note (DB commit succeeded):", kvErr);
  }

  return issuedEditToken ? { id: eventId, success: true, editToken: issuedEditToken } : { id: eventId, success: true };
}
