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
  deleteEventFilesFromKv,
  hasEventFileInKv,
  buildEventFileDownloadUrl,
} from "@/lib/local-events-store";
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  type PortalRole,
  type SessionPayload,
} from "@/lib/admin-session.server";

export { SESSION_COOKIE_NAME, SESSION_DURATION_MS, type PortalRole, type SessionPayload };

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  const { verifySession: serverVerify } = await import("@/lib/admin-session.server");
  return serverVerify(token);
}

export async function signSession(
  accountOrUsername:
    | string
    | Pick<SessionPayload, "username" | "role" | "allowedClubSlug" | "label">,
): Promise<string> {
  const { signSession: serverSign } = await import("@/lib/admin-session.server");
  return serverSign(accountOrUsername);
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
  document_object_paths?: string[] | undefined;
  document_file_names?: string[] | undefined;
  document_content_types?: string[] | undefined;
  created_at: string;
  updated_at?: string | undefined;
  report_download_url?: string | undefined;
  photo_download_urls?: string[] | undefined;
  document_download_urls?: string[] | undefined;
  edit_token_hash?: string | undefined;
}

export interface AdminProfileRecord {
  username: string;
  display_name: string;
  avatar_url: string | null;
  updated_at: string;
}

// In-memory fallback stores for development or offline testing when Supabase is unreachable
const memoryAdminProfile: AdminProfileRecord = {
  username: "studentcouncil",
  display_name: "GNITS Student Council Admin",
  avatar_url: null,
  updated_at: new Date().toISOString(),
};

const memoryEvents: AdminEventRecord[] = [];

// 1. Admin / IT-Admin Login Server Function
export const adminLoginServerFn = createServerFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        username: z.string().trim().min(1),
        password: z.string().min(1),
        portal: z.enum(["admin", "it-admin"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { authenticatePortalCredentials } = await import("@/lib/admin-session.server");
    const account = authenticatePortalCredentials(data.username, data.password, data.portal);

    const token = await signSession(account);
    setCookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(SESSION_DURATION_MS / 1000),
    });

    return {
      success: true,
      username: account.username,
      role: account.role,
      allowedClubSlug: account.allowedClubSlug,
      label: account.label,
    };
  });

// 2. Check Admin / IT-Admin Session Server Function
export const getAdminSessionServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const token = getCookie(SESSION_COOKIE_NAME);
  const session = await verifySession(token);
  return {
    authenticated: Boolean(session),
    username: session?.username ?? null,
    role: session?.role ?? null,
    allowedClubSlug: session?.allowedClubSlug ?? null,
    label: session?.label ?? null,
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
  const session = await verifySession(token);
  if (!session) throw new Error("Unauthorized. Please log in.");

  if (session.role !== "it-admin") {
    return {
      username: session.username,
      display_name: session.label,
      avatar_url: null,
      updated_at: new Date().toISOString(),
    } satisfies AdminProfileRecord;
  }

  try {
    const { supabaseAdmin, hasSupabaseAdminConfig } = await import(
      "@/integrations/supabase/client.server"
    );
    if (hasSupabaseAdminConfig()) {
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
    }
  } catch (err) {
    console.warn("Using in-memory admin profile fallback:", err);
  }

  return memoryAdminProfile;
});

// 5. Update Admin Profile Server Function (IT-Admin only)
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
    const session = await verifySession(token);
    if (!session || session.role !== "it-admin") {
      throw new Error("Unauthorized. Only IT-Admin can update this profile.");
    }

    try {
      const { supabaseAdmin, hasSupabaseAdminConfig } = await import(
        "@/integrations/supabase/client.server"
      );
      if (hasSupabaseAdminConfig()) {
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
    const session = await verifySession(token);
    if (!session) throw new Error("Unauthorized. Admin access required.");

    if (!isKnownForum(data.clubSlug, data.forumSlug)) {
      throw new Error("Invalid club or forum selected.");
    }

    const records: AdminEventRecord[] = [];
    const seenIds = new Set<string>();

    // 1. Primary: Fetch authoritative records from Supabase
    try {
      const { supabaseAdmin, hasSupabaseAdminConfig } = await import(
        "@/integrations/supabase/client.server"
      );
      if (hasSupabaseAdminConfig()) {
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

    // 2. Secondary fallback / bundled events (e.g. if Supabase is cold or KV-backed)
    const allLocal = await getEventsStoreAsync({ strictKv: true });
    const localById = new Map(allLocal.map((item) => [item.id, item]));

    // Attach document metadata stored in KV onto matching Supabase rows when present
    for (const rec of records) {
      const kvRec = localById.get(rec.id);
      if (kvRec?.document_object_paths?.length && !rec.document_object_paths?.length) {
        rec.document_object_paths = kvRec.document_object_paths;
        rec.document_file_names = kvRec.document_file_names;
        rec.document_content_types = kvRec.document_content_types;
        rec.document_download_urls = kvRec.document_download_urls;
      }
    }

    for (const ev of allLocal) {
      if (ev.club_slug === data.clubSlug && ev.forum_slug === data.forumSlug && !seenIds.has(ev.id)) {
        seenIds.add(ev.id);
        let resolvedReportUrl = ev.report_download_url || `/${ev.report_object_path}`;
        if (
          ev.report_object_path &&
          !resolvedReportUrl.startsWith("/api/event-file") &&
          !resolvedReportUrl.startsWith("http") &&
          (await hasEventFileInKv(ev.report_object_path))
        ) {
          resolvedReportUrl = buildEventFileDownloadUrl(ev.report_object_path);
        }

        const resolvedPhotoUrls: string[] = [];
        for (let i = 0; i < (ev.photo_object_paths?.length || 0); i++) {
          const p = ev.photo_object_paths[i]!;
          let pUrl = ev.photo_download_urls?.[i] || `/${p}`;
          if (
            !pUrl.startsWith("/api/event-file") &&
            !pUrl.startsWith("http") &&
            (await hasEventFileInKv(p))
          ) {
            pUrl = buildEventFileDownloadUrl(p);
          }
          resolvedPhotoUrls.push(pUrl);
        }

        const resolvedDocUrls: string[] = [];
        for (let i = 0; i < (ev.document_object_paths?.length || 0); i++) {
          const d = ev.document_object_paths![i]!;
          let dUrl = ev.document_download_urls?.[i] || `/${d}`;
          if (
            !dUrl.startsWith("/api/event-file") &&
            !dUrl.startsWith("http") &&
            (await hasEventFileInKv(d))
          ) {
            dUrl = buildEventFileDownloadUrl(d);
          }
          resolvedDocUrls.push(dUrl);
        }

        const { edit_token_hash: _omitHash, ...safeAdminEv } = ev;
        records.push({
          ...safeAdminEv,
          report_download_url: resolvedReportUrl,
          photo_download_urls: resolvedPhotoUrls,
          ...(resolvedDocUrls.length > 0 ? { document_download_urls: resolvedDocUrls } : {}),
        });
      }
    }

    records.sort((a, b) => (b.event_start > a.event_start ? 1 : -1));

    // When a category Admin views another category or IT-Admin institutional events,
    // display the event metadata and reports/documents/photos without exposing private submitter contacts.
    if (session.role === "admin" && data.clubSlug !== session.allowedClubSlug) {
      return records.map((rec) => ({
        ...rec,
        submitter_name: null,
        submitter_email: null,
      }));
    }

    return records;
  });

// 7. Get All Admin Events (for IT-Admin cross-forum export)
export const getAllAdminEventsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const token = getCookie(SESSION_COOKIE_NAME);
  const session = await verifySession(token);
  if (!session || session.role !== "it-admin") {
    throw new Error("Unauthorized. IT-Admin access required.");
  }

  const allRecords: AdminEventRecord[] = [];
  const seenIds = new Set<string>();

  // 1. Primary: Load all authoritative records from Supabase
  try {
    const { supabaseAdmin, hasSupabaseAdminConfig } = await import(
      "@/integrations/supabase/client.server"
    );
    if (hasSupabaseAdminConfig()) {
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
  const allLocal = await getEventsStoreAsync({ strictKv: true });
  for (const ev of allLocal) {
    if (!seenIds.has(ev.id)) {
      seenIds.add(ev.id);
      const { edit_token_hash: _omitHash, ...safeEv } = ev;
      allRecords.push(safeEv);
    }
  }

  return allRecords;
});

// 8. Delete Event (IT-Admin only)
export const deleteAdminEventServerFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const token = getCookie(SESSION_COOKIE_NAME);
    const session = await verifySession(token);
    if (!session || session.role !== "it-admin") {
      throw new Error("Unauthorized. Only IT-Admin can delete events.");
    }

    deleteLocalEvent(data.id);
    const existingEvents = await getEventsStoreAsync({ strictKv: true });
    const targetEvent = existingEvents.find((e) => e.id === data.id);
    const remaining = existingEvents.filter((e) => e.id !== data.id);
    await saveEventsStoreAsync(remaining);

    if (targetEvent) {
      await deleteEventFilesFromKv([
        targetEvent.report_object_path,
        ...(targetEvent.photo_object_paths || []),
        ...(targetEvent.document_object_paths || []),
      ]);
    }

    try {
      const { supabaseAdmin, hasSupabaseAdminConfig } = await import(
        "@/integrations/supabase/client.server"
      );
      if (hasSupabaseAdminConfig()) {
        await supabaseAdmin.from("student_forum_events").delete().eq("id", data.id);
      }
    } catch (err) {
      console.warn("Supabase event delete note:", err);
    }

    return { success: true, deletedId: data.id };
  });
