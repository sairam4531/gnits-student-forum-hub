import { createClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { eventSubmissionSchema } from "@/lib/event-validation";
import { isKnownForum } from "@/lib/event-validation";

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

export const getPublicForumEvents = createServerFn({ method: "GET" })
  .inputValidator((input) => publicForumInput.parse(input))
  .handler(async ({ data }) => {
    if (!isKnownForum(data.clubSlug, data.forumSlug)) {
      throw new Error("This forum is not available.");
    }
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Event browsing is temporarily unavailable.");
    const client = createPublicClient(url, key);
    const { data: events, error } = await client
      .from("student_forum_events")
      .select("id, club_slug, forum_slug, event_name, event_start, event_end, created_at")
      .eq("club_slug", data.clubSlug)
      .eq("forum_slug", data.forumSlug)
      .order("event_start", { ascending: false });
    if (error) throw new Error("Could not load events for this forum.");
    return events ?? [];
  });

export const submitStudentEvent = createServerFn({ method: "POST" })
  .inputValidator((input) => eventSubmissionSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const paths = [data.reportObjectPath, ...data.photoObjectPaths];
    const folder = data.reportObjectPath.split("/").slice(0, 2).join("/");
    const { data: uploadedFiles, error: storageError } = await supabaseAdmin.storage
      .from("student-forum-files")
      .list(folder, { limit: 100 });
    if (storageError || !uploadedFiles) {
      throw new Error("The uploaded files could not be verified. Please try again.");
    }
    const uploadedNames = new Set(uploadedFiles.map((file) => file.name));
    const attachmentsExist = paths.every((path) => uploadedNames.has(path.split("/").at(-1) ?? ""));
    if (!attachmentsExist) {
      throw new Error("One or more uploaded files could not be found. Please upload them again.");
    }
    const { data: event, error } = await supabaseAdmin
      .from("student_forum_events")
      .insert({
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
      })
      .select("id")
      .single();
    if (error || !event) throw new Error("Your event could not be submitted. Please try again.");
    return { id: event.id };
  });