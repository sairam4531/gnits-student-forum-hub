import { createClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";

import type { Database } from "@/integrations/supabase/types";
import { eventSubmissionSchema } from "@/lib/event-validation";
import { isKnownForum } from "@/lib/event-validation";
import {
  getLocalEvents,
  saveLocalEvent,
  saveFileLocally,
  getEventsStoreAsync,
  saveEventsStoreAsync,
} from "@/lib/local-events-store";
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
    const results: PublicEventRecord[] = [];
    const seenIds = new Set<string>();

    // 1. Primary: Retrieve events from Supabase
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (url && key) {
      try {
        const client = createPublicClient(url, key);
        const { data: remoteEvents, error } = await client
          .from("student_forum_events")
          .select("id, club_slug, forum_slug, event_name, event_start, event_end, created_at, resource_persons")
          .order("event_start", { ascending: false });

        if (!error && remoteEvents) {
          for (const ev of remoteEvents) {
            seenIds.add(ev.id);
            results.push({
              id: ev.id,
              club_slug: ev.club_slug,
              forum_slug: ev.forum_slug,
              event_name: ev.event_name,
              event_start: ev.event_start,
              event_end: ev.event_end,
              created_at: ev.created_at,
              resource_persons: ev.resource_persons,
            });
          }
        }
      } catch (err) {
        console.warn("Public Supabase query note (using fallback):", err);
      }
    }

    // 2. Fallback / Shared KV store: Include events from Cloudflare KV & local store
    const all = await getEventsStoreAsync();
    for (const e of all) {
      if (!seenIds.has(e.id)) {
        seenIds.add(e.id);
        results.push({
          id: e.id,
          club_slug: e.club_slug,
          forum_slug: e.forum_slug,
          event_name: e.event_name,
          event_start: e.event_start,
          event_end: e.event_end,
          created_at: e.created_at,
          resource_persons: e.resource_persons,
        });
      }
    }

    results.sort((a, b) => (b.event_start > a.event_start ? 1 : -1));
    return results;
  },
);

export const getPublicForumEvents = createServerFn({ method: "GET" })
  .validator((input) => publicForumInput.parse(input))
  .handler(async ({ data }) => {
    if (!isKnownForum(data.clubSlug, data.forumSlug)) {
      throw new Error("This forum is not available.");
    }

    const matches: PublicEventRecord[] = [];
    const seenIds = new Set<string>();

    // 1. Primary: Fetch from Supabase
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (url && key) {
      try {
        const client = createPublicClient(url, key);
        const { data: remoteEvents, error } = await client
          .from("student_forum_events")
          .select("id, club_slug, forum_slug, event_name, event_start, event_end, created_at, resource_persons")
          .eq("club_slug", data.clubSlug)
          .eq("forum_slug", data.forumSlug)
          .order("event_start", { ascending: false });

        if (!error && remoteEvents) {
          for (const ev of remoteEvents) {
            seenIds.add(ev.id);
            matches.push(ev);
          }
        }
      } catch (err) {
        console.warn("Public Supabase query note (using fallback):", err);
      }
    }

    // 2. Shared KV store & local events
    const allLocal = await getEventsStoreAsync();
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
        resource_persons: e.resource_persons,
      }));

    for (const loc of localMatches) {
      if (!seenIds.has(loc.id)) {
        seenIds.add(loc.id);
        matches.push(loc);
      }
    }

    matches.sort((a, b) => (b.event_start > a.event_start ? 1 : -1));
    return matches;
  });

export const submitStudentEvent = createServerFn({ method: "POST" })
  .validator((input) => eventSubmissionSchema.parse(input))
  .handler(async ({ data }) => {
    const eventId = data.id || crypto.randomUUID();

    // 1. Save files locally if base64 provided and local filesystem available
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

    // 2. Primary: Persist to Supabase if accessible
    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    const supabaseUrl = process.env["SUPABASE_URL"];

    if (serviceKey && supabaseUrl) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
          console.warn("Supabase student event upsert note (persisting via Cloudflare KV):", upsertError.message);
        }
      } catch (dbErr) {
        console.warn("Supabase database connection note (persisting via Cloudflare KV):", dbErr);
      }
    } else {
      console.warn("Supabase credentials not configured in current environment, using Cloudflare KV store.");
    }

    // 3. Central Cloudflare KV + Local persistence
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

    const currentEvents = await getEventsStoreAsync();
    const existingIndex = currentEvents.findIndex((e) => e.id === eventId);
    if (existingIndex >= 0) {
      currentEvents[existingIndex] = eventRecord;
    } else {
      currentEvents.unshift(eventRecord);
    }
    await saveEventsStoreAsync(currentEvents);

    return { id: eventId, success: true };
  });
