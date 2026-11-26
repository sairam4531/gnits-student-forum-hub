// Server-only authenticated upload & download handler for private event reports, documents & photos.
// Enforces server-verified admin session cookies per GNITS security policy.
import { verifyAdminRequest, type SessionPayload } from "@/lib/admin-session.server";
import {
  isSubmissionPath,
  isSupportedPhoto,
  isSupportedReport,
  MAX_UPLOAD_BYTES,
} from "@/lib/event-validation";
import {
  assembleLocalEventChunks,
  getEventFileStreamFromKv,
  saveEventFileBufferToKv,
  saveEventFileChunkToKv,
  saveEventFileChunkedMetaToKv,
  saveFileBufferLocally,
  saveLocalEventChunk,
} from "@/lib/local-events-store";
import { getCloudflareKVNamespace } from "@/lib/local-homepage-store";
import { forums } from "@/lib/student-forums";

const MAX_SINGLE_UPLOAD_BYTES = 4 * 1024 * 1024; // Safe under Vercel 4.5 MB limit
const LARGE_CHUNK_BYTES = 2.5 * 1024 * 1024;
const MAX_CHUNKS_PER_FILE = 12;

function inferContentTypeFromPath(filePath: string): string {
  const cleanPath = filePath.split("?")[0] || filePath;
  const ext = cleanPath.slice(cleanPath.lastIndexOf(".")).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".avif") return "image/avif";
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

async function readLocalEventFile(
  filePath: string,
): Promise<{ bytes: ArrayBuffer; contentType: string; fileName: string } | null> {
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const cleanPath = filePath.replace(/^\/+/, "");
    const resolved = path.resolve(process.cwd(), "public", cleanPath);
    const publicRoot = path.resolve(process.cwd(), "public", "submissions") + path.sep;
    if (!resolved.startsWith(publicRoot) || !fs.existsSync(resolved)) {
      return null;
    }
    const buf = fs.readFileSync(resolved);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return {
      bytes: ab,
      contentType: inferContentTypeFromPath(cleanPath),
      fileName: path.basename(cleanPath),
    };
  } catch {
    return null;
  }
}

function isAllowedUploadAttachment(
  kind: string,
  fileName: string,
  contentType: string,
): boolean {
  if (kind === "report" || kind === "document") {
    return isSupportedReport({ name: fileName, type: contentType });
  }
  if (kind === "photo") {
    return (
      isSupportedPhoto({ type: contentType }) ||
      /\.(jpe?g|png|webp|gif|avif|bmp)$/i.test(fileName)
    );
  }
  return false;
}

function authorizeUploadRequest(
  session: SessionPayload,
  url: URL,
): {
  error?: Response;
  objectPath: string;
  kind: "report" | "document" | "photo";
  fileName: string;
  contentType: string;
} {
  const rawPath = url.searchParams.get("path")?.trim() || "";
  if (!isSubmissionPath(rawPath)) {
    return {
      error: Response.json({ error: "Invalid event file path." }, { status: 400 }),
      objectPath: "",
      kind: "report",
      fileName: "",
      contentType: "",
    };
  }

  const clubSlug = url.searchParams.get("clubSlug")?.trim() || "";
  if (!forums.some((f) => f.slug === clubSlug)) {
    return {
      error: Response.json({ error: "Invalid club category for upload." }, { status: 400 }),
      objectPath: "",
      kind: "report",
      fileName: "",
      contentType: "",
    };
  }

  if (session.role === "admin" && clubSlug !== session.allowedClubSlug) {
    return {
      error: Response.json(
        {
          error:
            "Unauthorized. Your Admin login only permits uploading files in your assigned club category.",
        },
        { status: 403 },
      ),
      objectPath: "",
      kind: "report",
      fileName: "",
      contentType: "",
    };
  }

  const rawKind = url.searchParams.get("kind")?.trim() || "report";
  if (rawKind !== "report" && rawKind !== "document" && rawKind !== "photo") {
    return {
      error: Response.json({ error: "Invalid attachment kind." }, { status: 400 }),
      objectPath: "",
      kind: "report",
      fileName: "",
      contentType: "",
    };
  }

  const fileName = url.searchParams.get("name")?.trim() || rawPath.split("/").pop() || "file";
  const contentType = url.searchParams.get("type")?.trim() || inferContentTypeFromPath(fileName);
  if (!isAllowedUploadAttachment(rawKind, fileName, contentType)) {
    return {
      error: Response.json(
        { error: "Unsupported event attachment file format." },
        { status: 400 },
      ),
      objectPath: "",
      kind: rawKind,
      fileName,
      contentType,
    };
  }

  return { objectPath: rawPath, kind: rawKind, fileName, contentType };
}

async function handleEventFileUploadPost(
  request: Request,
  session: SessionPayload,
): Promise<Response> {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "upload";
  const validated = authorizeUploadRequest(session, url);
  if (validated.error) return validated.error;

  const { objectPath, fileName, contentType } = validated;
  const { supabaseAdmin, hasSupabaseAdminConfig } = await import(
    "@/integrations/supabase/client.server"
  );
  const supabaseReady = hasSupabaseAdminConfig();
  const hasCfKv = Boolean(getCloudflareKVNamespace());

  if (action === "prepare-large") {
    const size = Number(url.searchParams.get("size") || "0");
    if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
      return Response.json(
        { error: "Each event attachment must be 20 MB or smaller." },
        { status: 400 },
      );
    }

    if (supabaseReady) {
      const { data: signed, error: signedErr } = await supabaseAdmin.storage
        .from("student-forum-files")
        .createSignedUploadUrl(objectPath, { upsert: true });

      if (!signedErr && signed?.signedUrl) {
        return Response.json({
          ok: true,
          mode: "signed-url",
          signedUrl: signed.signedUrl,
          token: signed.token,
          path: signed.path || objectPath,
        });
      }
      console.warn("Supabase signed upload URL note:", signedErr?.message);
    }

    return Response.json({
      ok: true,
      mode: "chunked",
      chunkSize: LARGE_CHUNK_BYTES,
      path: objectPath,
    });
  }

  if (action === "chunk") {
    const index = Number(url.searchParams.get("index") ?? "-1");
    const totalChunks = Number(url.searchParams.get("total") || "0");
    if (
      !Number.isInteger(index) ||
      !Number.isInteger(totalChunks) ||
      totalChunks <= 0 ||
      totalChunks > MAX_CHUNKS_PER_FILE ||
      index < 0 ||
      index >= totalChunks
    ) {
      return Response.json({ error: "Invalid attachment chunk index." }, { status: 400 });
    }

    const buf = await request.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_SINGLE_UPLOAD_BYTES) {
      return Response.json({ error: "Invalid attachment chunk size." }, { status: 400 });
    }

    saveLocalEventChunk(objectPath, index, new Uint8Array(buf));
    if (hasCfKv) {
      const saved = await saveEventFileChunkToKv(objectPath, index, buf);
      if (!saved) {
        return Response.json(
          { error: "Failed to persist attachment chunk to Cloudflare KV." },
          { status: 500 },
        );
      }
    }
    return Response.json({ ok: true, index, path: objectPath });
  }

  if (action === "complete") {
    const totalChunks = Number(url.searchParams.get("total") || "0");
    const totalSize = Number(url.searchParams.get("size") || "0");
    if (
      !Number.isInteger(totalChunks) ||
      totalChunks <= 0 ||
      totalChunks > MAX_CHUNKS_PER_FILE ||
      !Number.isFinite(totalSize) ||
      totalSize <= 0 ||
      totalSize > MAX_UPLOAD_BYTES
    ) {
      return Response.json({ error: "Invalid chunked upload completion details." }, { status: 400 });
    }

    assembleLocalEventChunks(objectPath, totalChunks);
    if (hasCfKv) {
      const finalized = await saveEventFileChunkedMetaToKv(
        objectPath,
        totalChunks,
        totalSize,
        contentType,
        fileName,
      );
      if (!finalized) {
        return Response.json(
          { error: "Failed to finalize chunked attachment in Cloudflare KV." },
          { status: 500 },
        );
      }
    }
    return Response.json({ ok: true, path: objectPath, mode: "chunked" });
  }

  // Default action === "upload": single binary file (<= 4 MB)
  const buf = await request.arrayBuffer();
  if (buf.byteLength === 0) {
    return Response.json({ error: "Attachment payload cannot be empty." }, { status: 400 });
  }
  if (buf.byteLength > MAX_SINGLE_UPLOAD_BYTES) {
    return Response.json(
      { error: "Single-request binary upload exceeded 4 MB limit; use chunked upload." },
      { status: 413 },
    );
  }

  const bytes = new Uint8Array(buf);
  saveFileBufferLocally(objectPath, bytes);

  if (hasCfKv) {
    const savedKv = await saveEventFileBufferToKv(objectPath, bytes, contentType, fileName);
    if (!savedKv && !supabaseReady) {
      return Response.json(
        { error: "Failed to store attachment in Cloudflare KV." },
        { status: 500 },
      );
    }
  }

  if (supabaseReady) {
    const { error: uploadError } = await supabaseAdmin.storage
      .from("student-forum-files")
      .upload(objectPath, bytes, { contentType, upsert: true });
    if (uploadError) {
      console.error("Supabase attachment upload error:", uploadError.message);
      return Response.json(
        { error: "Could not save event attachment to storage. Please retry." },
        { status: 500 },
      );
    }
  }

  return Response.json({ ok: true, path: objectPath, mode: "direct" });
}

export async function handleEventFileRequest(request: Request): Promise<Response> {
  if (request.method === "POST") {
    const session = await verifyAdminRequest(request);
    if (!session) {
      return Response.json(
        { error: "Unauthorized. Admin authentication is required to upload event files." },
        { status: 401 },
      );
    }
    return handleEventFileUploadPost(request, session);
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const session = await verifyAdminRequest(request);
  if (!session) {
    return Response.json(
      { error: "Unauthorized. Admin authentication is required to access event files." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const rawPath = url.searchParams.get("path")?.trim() || "";
  if (!isSubmissionPath(rawPath)) {
    return Response.json({ error: "Invalid event file path." }, { status: 400 });
  }

  const kvStream = await getEventFileStreamFromKv(rawPath);
  if (kvStream) {
    const safeFileName = (kvStream.fileName || rawPath.split("/").pop() || "file").replace(
      /[^a-zA-Z0-9._ -]/g,
      "_",
    );
    const headers: Record<string, string> = {
      "Content-Type": kvStream.contentType || "application/octet-stream",
      "Content-Length": String(kvStream.size),
      "Content-Disposition": `inline; filename="${safeFileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    };
    if (request.method === "HEAD") {
      return new Response(null, { status: 200, headers });
    }
    return new Response(kvStream.stream, { status: 200, headers });
  }

  const localStored = await readLocalEventFile(rawPath);
  if (localStored) {
    const safeFileName = (localStored.fileName || rawPath.split("/").pop() || "file").replace(
      /[^a-zA-Z0-9._ -]/g,
      "_",
    );
    const headers: Record<string, string> = {
      "Content-Type": localStored.contentType || "application/octet-stream",
      "Content-Length": String(localStored.bytes.byteLength),
      "Content-Disposition": `inline; filename="${safeFileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    };
    if (request.method === "HEAD") {
      return new Response(null, { status: 200, headers });
    }
    return new Response(localStored.bytes, { status: 200, headers });
  }

  // Fallback to Supabase private storage when running in serverless environments (e.g. Vercel)
  try {
    const { supabaseAdmin, hasSupabaseAdminConfig } = await import(
      "@/integrations/supabase/client.server"
    );
    if (hasSupabaseAdminConfig()) {
      const { data: blob, error } = await supabaseAdmin.storage
        .from("student-forum-files")
        .download(rawPath);
      if (!error && blob) {
        const fileName = rawPath.split("/").pop() || "file";
        const safeFileName = fileName.replace(/[^a-zA-Z0-9._ -]/g, "_");
        const headers: Record<string, string> = {
          "Content-Type": blob.type || inferContentTypeFromPath(rawPath),
          "Content-Length": String(blob.size),
          "Content-Disposition": `inline; filename="${safeFileName}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        };
        if (request.method === "HEAD") {
          return new Response(null, { status: 200, headers });
        }
        return new Response(blob.stream(), { status: 200, headers });
      }
    }
  } catch (err) {
    console.warn("Supabase event file download note:", err);
  }

  return new Response("Event file not found", { status: 404 });
}
