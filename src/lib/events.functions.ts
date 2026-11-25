import { createClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { eventSubmissionSchema } from "@/lib/event-validation";
import { isKnownForum } from "@/lib/event-validation";
import { getEventsStoreAsync } from "@/lib/local-events-store";
import { type AdminEventRecord, SESSION_COOKIE_NAME } from "@/lib/admin.functions";

const publicForumInput = z.object({
  clubSlug: z.string().min(1).max(80),
  forumSlug: z.string().min(1).max(100),
});

function getPublicSupabaseConfig() {
  const g = globalThis as unknown as {
    __env__?: Record<string, string | undefined>;
    __cloudflareEnv?: Record<string, string | undefined>;
    env?: Record<string, string | undefined>;
  };
  const url =
    g.__env__?.["SUPABASE_URL"] ||
    g.__env__?.["VITE_SUPABASE_URL"] ||
    g.__cloudflareEnv?.["SUPABASE_URL"] ||
    g.env?.["SUPABASE_URL"] ||
    (typeof process !== "undefined"
      ? (process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"])
      : undefined);
  const key =
    g.__env__?.["SUPABASE_PUBLISHABLE_KEY"] ||
    g.__env__?.["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    g.__cloudflareEnv?.["SUPABASE_PUBLISHABLE_KEY"] ||
    g.env?.["SUPABASE_PUBLISHABLE_KEY"] ||
    (typeof process !== "undefined"
      ? (process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"])
      : undefined);
  return { url, key };
}

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
    const { url, key } = getPublicSupabaseConfig();
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
    const { url, key } = getPublicSupabaseConfig();
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
    const { processStudentEventSubmission } = await import("@/lib/events.server");
    const token = getCookie(SESSION_COOKIE_NAME);
    return processStudentEventSubmission(data, token);
  });
