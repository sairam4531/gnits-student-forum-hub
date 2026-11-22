import { createClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";

import type { Database } from "@/integrations/supabase/types";
import { eventSubmissionSchema } from "@/lib/event-validation";
import { isKnownForum } from "@/lib/event-validation";
import { getLocalEvents, saveLocalEvent, saveFileLocally } from "@/lib/local-events-store";
import type { AdminEventRecord } from "@/lib/admin.functions";

const publicForumInput = z.object({
  clubSlug: z.string().min(1).max(80),
  forumSlug: z.string().min(1).max(100),
});

function createPublicClient(url: string, key: string) {
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(input instanceof Request ? input.headers : undefined);
        if (init?.headers) {
          new Headers(init.headers).forEach((value, name) => headers.set(name, value));
        }
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export interface PublicEventRecord {
  id: string;
  club_slug: string;
  forum_slug: string;
  event_name: string;
  event_start: string;
  event_end: string;
  created_at: string;
  resource_persons?: string;
}

export const getAllPublicEventsServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicEventRecord[]> => {
    const all = getLocalEvents();
    return all.map((e) => ({
      id: e.id,
      club_slug: e.club_slug,
      forum_slug: e.forum_slug,
      event_name: e.event_name,
      event_start: e.event_start,
      event_end: e.event_end,
      created_at: e.created_at,
      resource_persons: e.resource_persons,
    }));
  },
);

export const getPublicForumEvents = createServerFn({ method: "GET" })
  .validator((input) => publicForumInput.parse(input))
  .handler(async ({ data }) => {
    if (!isKnownForum(data.clubSlug, data.forumSlug)) {
      throw new Error("This forum is not available.");
    }

    // 1. Load local events first
    const allLocal = getLocalEvents();
    const localMatches = allLocal
      .filter((e) => e.club_slug === data.clubSlug && e.forum_slug === data.forumSlug)
      .map((e) => ({
        id: e.id,
        club_slug: e.club_slug,
        forum_slug: e.forum_slug,
        event_name: e.event_name,
        event_start: e.event_start,
        event_end: e.event_end,
        created_at: e.created_at,
      }));

    // 2. Try fetching from Supabase if reachable
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (url && key) {
      try {
        const client = createPublicClient(url, key);
        const { data: remoteEvents, error } = await client
          .from("student_forum_events")
          .select("id, club_slug, forum_slug, event_name, event_start, event_end, created_at")
          .eq("club_slug", data.clubSlug)
          .eq("forum_slug", data.forumSlug)
          .order("event_start", { ascending: false });

        if (!error && remoteEvents && remoteEvents.length > 0) {
          const seenIds = new Set(localMatches.map((e) => e.id));
          for (const ev of remoteEvents) {
            if (!seenIds.has(ev.id)) {
              localMatches.push(ev);
            }
          }
        }
      } catch (err) {
        console.warn("Public Supabase query note (using local cache):", err);
      }
    }

    // Sort descending by event_start
    localMatches.sort((a, b) => (b.event_start > a.event_start ? 1 : -1));
    return localMatches;
  });

export const submitStudentEvent = createServerFn({ method: "POST" })
  .validator((input) => eventSubmissionSchema.parse(input))
  .handler(async ({ data }) => {
    const eventId = data.id || crypto.randomUUID();

    // 1. Save files locally if base64 provided
    if (data.reportBase64) {
      saveFileLocally(data.reportObjectPath, data.reportBase64);
    }
    if (data.photoBase64s && data.photoBase64s.length > 0) {
      for (let i = 0; i < data.photoBase64s.length; i++) {
        const pPath = data.photoObjectPaths[i];
        const b64 = data.photoBase64s[i];
        if (pPath && b64) {
          saveFileLocally(pPath, b64);
        }
      }
    }

    // 2. Create and persist local event record
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
      created_at: new Date().toISOString(),
      updated_at: data.id ? new Date().toISOString() : undefined,
      report_download_url: `/${data.reportObjectPath}`,
      photo_download_urls: data.photoObjectPaths.map((p) => `/${p}`),
    };

    saveLocalEvent(eventRecord);

    // 3. Try syncing to Supabase if configured and alive
    try {
      if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("student_forum_events").upsert({
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
      }
    } catch (err) {
      console.warn("Supabase background sync note (local save completed):", err);
    }

    return { id: eventId, success: true };
  });
