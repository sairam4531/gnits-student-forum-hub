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

const PUBLIC_SUPABASE_TIMEOUT_MS = 1800;

async function fetchPublicSupabaseEvents(filter?: {
  clubSlug: string;
  forumSlug: string;
}): Promise<PublicEventRecord[]> {
  const { url, key } = getPublicSupabaseConfig();
  if (!url || !key) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PUBLIC_SUPABASE_TIMEOUT_MS);

  try {
    const client = createClient<Database>(url, key, {
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
          return fetch(input, { ...init, headers, signal: init?.signal ?? controller.signal });
        },
      },
    });

    let query = client
      .from("student_forum_event_summaries")
      .select("id, club_slug, forum_slug, event_name, event_start, event_end, created_at");

    if (filter) {
      query = query.eq("club_slug", filter.clubSlug).eq("forum_slug", filter.forumSlug);
    }

    const { data: remoteEvents, error } = await query.order("event_start", { ascending: false });
    if (error || !remoteEvents) return [];

    return remoteEvents.flatMap((ev): PublicEventRecord[] => {
      if (
        typeof ev.id !== "string" ||
        typeof ev.club_slug !== "string" ||
        typeof ev.forum_slug !== "string" ||
        typeof ev.event_name !== "string" ||
        typeof ev.event_start !== "string" ||
        typeof ev.event_end !== "string" ||
        typeof ev.created_at !== "string"
      ) {
        return [];
      }
      return [{
        id: ev.id,
        club_slug: ev.club_slug,
        forum_slug: ev.forum_slug,
        event_name: ev.event_name,
        event_start: ev.event_start,
        event_end: ev.event_end,
        created_at: ev.created_at,
      }];
    });
  } catch (err) {
    console.warn("Public Supabase query note (using KV/local store):", err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function mergePublicEventLists(
  remoteEvents: PublicEventRecord[],
  storeEvents: AdminEventRecord[],
  filter?: { clubSlug: string; forumSlug: string },
): PublicEventRecord[] {
  const results: PublicEventRecord[] = [];
  const seenIds = new Set<string>();

  for (const ev of remoteEvents) {
    if (!seenIds.has(ev.id)) {
      seenIds.add(ev.id);
      results.push(ev);
    }
  }

  for (const e of storeEvents) {
    if (filter && (e.club_slug !== filter.clubSlug || e.forum_slug !== filter.forumSlug)) {
      continue;
    }
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
      });
    }
  }

  results.sort((a, b) => b.event_start.localeCompare(a.event_start));
  return results;
}

export const getAllPublicEventsServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicEventRecord[]> => {
    const [remoteEvents, storeEvents] = await Promise.all([
      fetchPublicSupabaseEvents(),
      getEventsStoreAsync({ strictKv: true }),
    ]);
    return mergePublicEventLists(remoteEvents, storeEvents);
  },
);

export const getPublicForumEvents = createServerFn({ method: "GET" })
  .validator((input) => publicForumInput.parse(input))
  .handler(async ({ data }) => {
    if (!isKnownForum(data.clubSlug, data.forumSlug)) {
      throw new Error("This forum is not available.");
    }

    const filter = { clubSlug: data.clubSlug, forumSlug: data.forumSlug };
    const [remoteEvents, storeEvents] = await Promise.all([
      fetchPublicSupabaseEvents(filter),
      getEventsStoreAsync({ strictKv: true }),
    ]);
    return mergePublicEventLists(remoteEvents, storeEvents, filter);
  });

export const submitStudentEvent = createServerFn({ method: "POST" })
  .validator((input) => eventSubmissionSchema.parse(input))
  .handler(async ({ data }) => {
    const { verifySession } = await import("@/lib/admin.functions");
    const token = getCookie(SESSION_COOKIE_NAME);
    const session = await verifySession(token);
    if (!session) {
      throw new Error("Unauthorized. Please log in to Admin or IT-Admin to submit events.");
    }
    if (session.role === "admin" && data.clubSlug !== session.allowedClubSlug) {
      throw new Error("Unauthorized. Your login only permits adding or editing events in your assigned club category.");
    }
    const { processStudentEventSubmission } = await import("@/lib/events.server");
    return processStudentEventSubmission(data, token);
  });
