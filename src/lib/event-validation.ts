import { z } from "zod";

import {
  forums,
  forumSlug,
  isInstitutionalClub,
  parseInstitutionalForumSlug,
} from "@/lib/student-forums";

const eventDetailsShape = {
  clubSlug: z.string().min(1).max(80),
  forumSlug: z.string().min(1).max(100),
  eventName: z.string().trim().min(1).max(160),
  eventStart: z.string().date(),
  eventEnd: z.string().date(),
  resourcePersons: z.string().trim().max(2000).optional(),
  submitterName: z.string().trim().max(120).optional(),
  submitterEmail: z.string().trim().max(254).optional(),
};

function addEventDetailsIssues(
  event: z.infer<z.ZodObject<typeof eventDetailsShape>>,
  context: z.RefinementCtx,
) {
  if (event.eventStart > event.eventEnd) {
    context.addIssue({
      code: "custom",
      path: ["eventEnd"],
      message: "The end date must be on or after the start date.",
    });
  }
  if (!isKnownForum(event.clubSlug, event.forumSlug)) {
    context.addIssue({
      code: "custom",
      path: ["forumSlug"],
      message: "Choose a forum from the GNITS list.",
    });
  }
  // Student Forums require resource persons, submitter name, and valid student email;
  // non-Student-Forum (institutional) events do not ask for or require these fields.
  if (!isInstitutionalClub(event.clubSlug)) {
    if (!event.resourcePersons || event.resourcePersons.trim().length === 0) {
      context.addIssue({
        code: "custom",
        path: ["resourcePersons"],
        message: "Please provide Resource Person names & designations.",
      });
    }
    if (!event.submitterName || event.submitterName.trim().length === 0) {
      context.addIssue({
        code: "custom",
        path: ["submitterName"],
        message: "Submitter name is required.",
      });
    }
    const email = event.submitterEmail?.trim() || "";
    if (!email || !z.string().email().safeParse(email).success) {
      context.addIssue({
        code: "custom",
        path: ["submitterEmail"],
        message: "Valid submitter email is required.",
      });
    }
  } else if (event.submitterEmail && event.submitterEmail.trim().length > 0) {
    if (!z.string().email().safeParse(event.submitterEmail.trim()).success) {
      context.addIssue({
        code: "custom",
        path: ["submitterEmail"],
        message: "Valid submitter email is required.",
      });
    }
  }
}

export const eventDetailsSchema = z.object(eventDetailsShape).superRefine(addEventDetailsIssues);

export const eventSubmissionSchema = z
  .object({
    id: z.string().uuid().optional(),
    ...eventDetailsShape,
    reportObjectPath: z.string().min(1).max(500),
    reportFileName: z.string().trim().min(1).max(180),
    reportContentType: z.string().max(150),
    photoObjectPaths: z.array(z.string().min(1).max(500)).max(20),
    photoFileNames: z.array(z.string().trim().min(1).max(180)).max(20),
    reportBase64: z.string().optional(),
    photoBase64s: z.array(z.string()).optional(),
    editToken: z.string().min(16).max(128).optional(),
  })
  .superRefine((event, context) => {
    addEventDetailsIssues(event, context);
    if (event.photoObjectPaths.length !== event.photoFileNames.length) {
      context.addIssue({
        code: "custom",
        path: ["photoFileNames"],
        message: "Each photo must have a matching file name.",
      });
    }
    const paths = [event.reportObjectPath, ...event.photoObjectPaths];
    const submissionFolders = new Set(paths.map((path) => path.split("/").slice(0, 2).join("/")));
    if (
      paths.some((path) => !isSubmissionPath(path)) ||
      submissionFolders.size !== 1 ||
      !isSupportedReport({ name: event.reportFileName, type: event.reportContentType })
    ) {
      context.addIssue({
        code: "custom",
        path: ["reportObjectPath"],
        message: "The uploaded files are not valid submission files.",
      });
    }
    if (event.id && paths.some((path) => !path.startsWith(`submissions/${event.id}/`))) {
      context.addIssue({
        code: "custom",
        path: ["reportObjectPath"],
        message: "Event files must belong to this submission.",
      });
    }
  });

export type EventSubmission = z.infer<typeof eventSubmissionSchema>;

export function isKnownForum(clubSlug: string, selectedForumSlug: string) {
  const club = forums.find((entry) => entry.slug === clubSlug);
  if (!club) return false;
  if (isInstitutionalClub(clubSlug)) {
    const { baseSlug, academicYear } = parseInstitutionalForumSlug(selectedForumSlug);
    if (selectedForumSlug.includes("--ay-") && !academicYear) {
      return false;
    }
    return club.forums.some((forum) => forumSlug(club.slug, forum) === baseSlug);
  }
  return club.forums.some((forum) => forumSlug(club.slug, forum) === selectedForumSlug);
}

export function isSubmissionPath(path: string) {
  return /^submissions\/[0-9a-f-]{36}\/[a-zA-Z0-9][a-zA-Z0-9._ -]{0,179}$/.test(path);
}

export function isSupportedReport(file: Pick<File, "name" | "type">) {
  const extension = file.name.toLowerCase().split(".").pop();
  return extension === "pdf" || extension === "doc" || extension === "docx";
}

export function isSupportedPhoto(file: Pick<File, "type">) {
  return file.type.startsWith("image/");
}

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_EVENT_PHOTOS = 20;
