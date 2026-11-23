import crypto from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { isKnownForum } from "@/lib/event-validation";
import {
  getLocalEvents,
  deleteLocalEvent,
  getEventsStoreAsync,
  saveEventsStoreAsync,
} from "@/lib/local-events-store";

export const SESSION_COOKIE_NAME = "gnits_admin_session";
const SESSION_SECRET =
  process.env["ADMIN_SESSION_SECRET"] || "gnits-student-council-secure-session-key-2026";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Temporary credentials as specified in requirements
const ADMIN_USERNAME = "studentcouncil";
const ADMIN_PASSWORD = "studentcouncil@1234";

export interface SessionPayload {
  username: string;
  exp: number;
}

export function signSession(username: string): string {
  const payload: SessionPayload = {
    username,
    exp: Date.now() + SESSION_DURATION_MS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  return `${data}.${signature}`;
}

export function verifySession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  if (!data || !sig) return null;

  const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf-8")) as SessionPayload;
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export interface AdminEventRecord {
  id: string;
  club_slug: string;
  forum_slug: string;
  event_name: string;
  event_start: string;
  event_end: string;
  resource_persons: string;
  submitter_name: string | null;
  submitter_email: string | null;
  report_object_path: string;
  report_file_name: string;
  report_content_type: string;
  photo_object_paths: string[];
  photo_file_names: string[];
  created_at: string;
  updated_at?: string | undefined;
  report_download_url?: string | undefined;
  photo_download_urls?: string[] | undefined;
}

export interface AdminProfileRecord {
  username: string;
  display_name: string;
  avatar_url: string | null;
  updated_at: string;
}

// In-memory fallback stores for development or offline testing when Supabase is unreachable
const memoryAdminProfile: AdminProfileRecord = {
  username: ADMIN_USERNAME,
  display_name: "GNITS Student Council Admin",
  avatar_url: null,
  updated_at: new Date().toISOString(),
};

const memoryEvents: AdminEventRecord[] = [];

// 1. Admin Login Server Function
export const adminLoginServerFn = createServerFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        username: z.string().trim().min(1),
        password: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // Verify temporary administrator credentials only on server
    if (data.username !== ADMIN_USERNAME || data.password !== ADMIN_PASSWORD) {
      throw new Error("Invalid username or password. Please verify your credentials.");
    }

    const token = signSession(ADMIN_USERNAME);
    setCookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(SESSION_DURATION_MS / 1000),
    });

    return {
      success: true,
      username: ADMIN_USERNAME,
    };
  });

// 2. Check Admin Session Server Function
export const getAdminSessionServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const token = getCookie(SESSION_COOKIE_NAME);
  const session = verifySession(token);
  return {
    authenticated: Boolean(session),
    username: session?.username ?? null,
  };
});

// 3. Admin Logout Server Function
export const adminLogoutServerFn = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(SESSION_COOKIE_NAME, {
    path: "/",
  });
  return { success: true };
});

// 4. Get Admin Profile Server Function
export const getAdminProfileServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const token = getCookie(SESSION_COOKIE_NAME);
  const session = verifySession(token);
  if (!session) throw new Error("Unauthorized. Please log in.");

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("admin_profiles")
      .select("username, display_name, avatar_url, updated_at")
      .eq("username", session.username)
      .maybeSingle();

    if (!error && data) {
      return data as AdminProfileRecord;
    }

    // Insert default profile if not exists
    const { data: newProfile } = await supabaseAdmin
      .from("admin_profiles")
      .upsert({
        username: session.username,
        display_name: "GNITS Student Council Admin",
      })
      .select()
      .single();

    if (newProfile) return newProfile as AdminProfileRecord;
  } catch (err) {
    console.warn("Using in-memory admin profile fallback:", err);
  }

  return memoryAdminProfile;
});

// 5. Update Admin Profile Server Function
export const updateAdminProfileServerFn = createServerFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        display_name: z.string().trim().min(1).max(120),
        avatar_url: z.string().url().max(2048).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const token = getCookie(SESSION_COOKIE_NAME);
    const session = verifySession(token);
    if (!session) throw new Error("Unauthorized. Please log in.");

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profile, error } = await supabaseAdmin
        .from("admin_profiles")
        .upsert({
          username: session.username,
          display_name: data.display_name,
          avatar_url: data.avatar_url ?? null,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!error && profile) {
        return profile as AdminProfileRecord;
      }
    } catch (err) {
      console.warn("Using in-memory admin profile update:", err);
    }

    memoryAdminProfile.display_name = data.display_name;
    memoryAdminProfile.avatar_url = data.avatar_url ?? null;
    memoryAdminProfile.updated_at = new Date().toISOString();
    return memoryAdminProfile;
  });

// 6. Get Admin Events (with private submitter details & signed download URLs)
export const getAdminForumEventsServerFn = createServerFn({ method: "GET" })
  .validator((input) =>
    z
      .object({
        clubSlug: z.string().min(1).max(80),
        forumSlug: z.string().min(1).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const token = getCookie(SESSION_COOKIE_NAME);
    const session = verifySession(token);
    if (!session) throw new Error("Unauthorized. Admin access required.");

    if (!isKnownForum(data.clubSlug, data.forumSlug)) {
      throw new Error("Invalid club or forum selected.");
    }

    const records: AdminEventRecord[] = [];
    const seenIds = new Set<string>();

    // 1. Primary: Fetch authoritative records from Supabase
    try {
      if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: events, error } = await supabaseAdmin
          .from("student_forum_events")
          .select("*")
          .eq("club_slug", data.clubSlug)
          .eq("forum_slug", data.forumSlug)
          .order("event_start", { ascending: false });

        if (!error && events) {
          for (const ev of events as AdminEventRecord[]) {
            seenIds.add(ev.id);
            if (ev.report_object_path) {
              const { data: reportUrl } = await supabaseAdmin.storage
                .from("student-forum-files")
                .createSignedUrl(ev.report_object_path, 3600);
              ev.report_download_url = reportUrl?.signedUrl || `/${ev.report_object_path}`;
            }
            if (ev.photo_object_paths && ev.photo_object_paths.length > 0) {
              const photoUrls: string[] = [];
              for (const p of ev.photo_object_paths) {
                const { data: pUrl } = await supabaseAdmin.storage
                  .from("student-forum-files")
                  .createSignedUrl(p, 3600);
                if (pUrl?.signedUrl) photoUrls.push(pUrl.signedUrl);
              }
              ev.photo_download_urls =
                photoUrls.length > 0 ? photoUrls : ev.photo_object_paths.map((p) => `/${p}`);
            }
            records.push(ev);
          }
        }
      }
    } catch (err) {
      console.warn("Supabase admin events query note:", err);
    }

    // 2. Secondary fallback / bundled events (e.g. if Supabase is cold)
    const allLocal = await getEventsStoreAsync();
    for (const ev of allLocal) {
      if (ev.club_slug === data.clubSlug && ev.forum_slug === data.forumSlug && !seenIds.has(ev.id)) {
        seenIds.add(ev.id);
        records.push({
          ...ev,
          report_download_url: ev.report_download_url || `/${ev.report_object_path}`,
          photo_download_urls: ev.photo_download_urls || ev.photo_object_paths.map((p) => `/${p}`),
        });
      }
    }

    records.sort((a, b) => (b.event_start > a.event_start ? 1 : -1));
    return records;
  });

// 7. Get All Admin Events (for cross-forum export)
export const getAllAdminEventsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const token = getCookie(SESSION_COOKIE_NAME);
  const session = verifySession(token);
  if (!session) throw new Error("Unauthorized. Admin access required.");

  const allRecords: AdminEventRecord[] = [];
  const seenIds = new Set<string>();

  // 1. Primary: Load all authoritative records from Supabase
  try {
    if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: events, error } = await supabaseAdmin
        .from("student_forum_events")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && events) {
        for (const ev of events as AdminEventRecord[]) {
          seenIds.add(ev.id);
          allRecords.push(ev);
        }
      }
    }
  } catch (err) {
    console.warn("Supabase all events query fallback:", err);
  }

  // 2. Secondary fallback / bundled events
  const allLocal = await getEventsStoreAsync();
  for (const ev of allLocal) {
    if (!seenIds.has(ev.id)) {
      seenIds.add(ev.id);
      allRecords.push(ev);
    }
  }

  return allRecords;
});

// 8. Delete Event as Administrator
export const deleteAdminEventServerFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const token = getCookie(SESSION_COOKIE_NAME);
    const session = verifySession(token);
    if (!session) throw new Error("Unauthorized. Admin access required.");

    deleteLocalEvent(data.id);
    const remaining = (await getEventsStoreAsync()).filter((e) => e.id !== data.id);
    await saveEventsStoreAsync(remaining);

    try {
      if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("student_forum_events").delete().eq("id", data.id);
      }
    } catch (err) {
      console.warn("Supabase event delete note:", err);
    }

    return { success: true, deletedId: data.id };
  });
