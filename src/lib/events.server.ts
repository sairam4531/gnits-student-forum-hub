// Server-only event submission processor with Supabase primary & durable Cloudflare KV persistence.
import type { AdminEventRecord } from "@/lib/admin.functions";
import { verifySession } from "@/lib/admin-session.server";
import type { EventSubmission } from "@/lib/event-validation";
import {
  buildEventFileDownloadUrl,
  getEventsStoreAsync,
  saveEventFileToKv,
  saveEventsStoreAsync,
  saveFileLocally,
} from "@/lib/local-events-store";
import { getCloudflareKVNamespace } from "@/lib/local-homepage-store";

export async function processStudentEventSubmission(
  data: EventSubmission,
  adminSessionToken: string | undefined,
): Promise<{ id: string; success: boolean }> {
  const eventId = data.id || globalThis.crypto.randomUUID();

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

  const currentEvents = await getEventsStoreAsync();
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
  if (isUpdate) {
    // Strictly require authenticated administrator session cookie to update an existing event
    const session = await verifySession(adminSessionToken);
    if (!session) {
      throw new Error(
        "Unauthorized: Only authenticated Student Affairs administrators are authorized to edit existing conducted event records.",
      );
    }
  }

  // Store submitted report and photo files locally and in Cloudflare KV (when bound)
  let reportDownloadUrl = existingStoreEvent?.report_download_url || `/${data.reportObjectPath}`;
  if (data.reportBase64) {
    saveFileLocally(data.reportObjectPath, data.reportBase64);
    const savedKvReport = await saveEventFileToKv(
      data.reportObjectPath,
      data.reportBase64,
      data.reportContentType,
      data.reportFileName,
    );
    if (savedKvReport) {
      reportDownloadUrl = buildEventFileDownloadUrl(data.reportObjectPath);
    }
  }

  const photoDownloadUrls: string[] = [];
  for (let i = 0; i < data.photoObjectPaths.length; i++) {
    const pPath = data.photoObjectPaths[i];
    const pName = data.photoFileNames[i];
    const b64 = data.photoBase64s?.[i];
    if (!pPath) continue;

    let resolvedPhotoUrl = existingStoreEvent?.photo_download_urls?.[i] || `/${pPath}`;
    if (b64) {
      saveFileLocally(pPath, b64);
      const savedKvPhoto = await saveEventFileToKv(pPath, b64, undefined, pName);
      if (savedKvPhoto) {
        resolvedPhotoUrl = buildEventFileDownloadUrl(pPath);
      }
    }
    photoDownloadUrls.push(resolvedPhotoUrl);
  }

  // Commit to Supabase when genuine service-role configuration is present
  if (supabaseReady) {
    const { error: upsertError } = await supabaseAdmin.from("student_forum_events").upsert({
      id: eventId,
      club_slug: data.clubSlug,
      forum_slug: data.forumSlug,
      event_name: data.eventName,
      event_start: data.eventStart,
      event_end: data.eventEnd,
      resource_persons: data.resourcePersons,
      submitter_name: data.submitterName,
      submitter_email: data.submitterEmail,
      report_object_path: data.reportObjectPath,
      report_file_name: data.reportFileName,
      report_content_type: data.reportContentType,
      photo_object_paths: data.photoObjectPaths,
      photo_file_names: data.photoFileNames,
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
    resource_persons: data.resourcePersons,
    submitter_name: data.submitterName,
    submitter_email: data.submitterEmail,
    report_object_path: data.reportObjectPath,
    report_file_name: data.reportFileName,
    report_content_type: data.reportContentType,
    photo_object_paths: data.photoObjectPaths,
    photo_file_names: data.photoFileNames,
    created_at: existingStoreEvent?.created_at || new Date().toISOString(),
    updated_at: isUpdate ? new Date().toISOString() : undefined,
    report_download_url: reportDownloadUrl,
    photo_download_urls: photoDownloadUrls,
  };

  try {
    const updatedEvents = [...currentEvents];
    if (existingStoreIndex >= 0) {
      updatedEvents[existingStoreIndex] = eventRecord;
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

  return { id: eventId, success: true };
}
