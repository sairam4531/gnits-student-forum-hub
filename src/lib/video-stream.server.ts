// Server-only chunked video storage & HTTP Range streaming handler.
// Stores video binary chunks in Cloudflare KV (globally shared across worker isolates)
// with local filesystem / /tmp fallback for Node.js dev and serverless containers.
import { getCloudflareKVNamespace } from "@/lib/local-homepage-store";
import { verifyAdminRequest } from "@/lib/admin-session.server";

export interface VideoStreamMetadata {
  id: string;
  totalChunks: number;
  totalSize: number;
  chunkSize: number;
  contentType: string;
  fileName: string;
  updatedAt: string;
}

const VALID_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{1,80}$/;
const MAX_SINGLE_CHUNK_BYTES = 10 * 1024 * 1024; // Safety bound per chunk request

function isValidVideoId(id: string | null): id is string {
  return Boolean(id && VALID_VIDEO_ID_RE.test(id));
}

function metaKey(id: string): string {
  return `video_meta:${id}`;
}

function chunkKey(id: string, index: number): string {
  return `video_chunk:${id}:${index}`;
}

async function resolveLocalVideoDir(id: string): Promise<string> {
  const path = await import("node:path");
  const os = await import("node:os");
  const fs = await import("node:fs");

  try {
    const localBase = path.resolve(process.cwd(), "public", "uploads", "videos", "_chunks", id);
    if (!fs.existsSync(localBase)) {
      fs.mkdirSync(localBase, { recursive: true });
    }
    return localBase;
  } catch {
    const tmpBase = path.join(os.tmpdir(), "gnits_videos", id);
    if (!fs.existsSync(tmpBase)) {
      fs.mkdirSync(tmpBase, { recursive: true });
    }
    return tmpBase;
  }
}

async function findExistingLocalVideoDir(id: string): Promise<string | null> {
  const path = await import("node:path");
  const os = await import("node:os");
  const fs = await import("node:fs");

  const candidates = [
    path.resolve(process.cwd(), "public", "uploads", "videos", "_chunks", id),
    path.join(os.tmpdir(), "gnits_videos", id),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "meta.json"))) {
      return dir;
    }
  }
  return null;
}

async function putChunk(id: string, index: number, buf: ArrayBuffer): Promise<void> {
  const kv = getCloudflareKVNamespace();
  if (kv) {
    await kv.put(chunkKey(id, index), buf);
    return;
  }

  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = await resolveLocalVideoDir(id);
  fs.writeFileSync(path.join(dir, `chunk_${index}`), new Uint8Array(buf));
}

async function putMeta(meta: VideoStreamMetadata): Promise<void> {
  const kv = getCloudflareKVNamespace();
  if (kv) {
    await kv.put(metaKey(meta.id), JSON.stringify(meta));
    return;
  }

  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = await resolveLocalVideoDir(meta.id);
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta), "utf-8");
}

async function getMeta(id: string): Promise<VideoStreamMetadata | null> {
  const kv = getCloudflareKVNamespace();
  if (kv) {
    const meta = await kv.get<VideoStreamMetadata>(metaKey(id), "json");
    if (meta) return meta;
  }

  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = await findExistingLocalVideoDir(id);
    if (!dir) return null;
    const raw = fs.readFileSync(path.join(dir, "meta.json"), "utf-8");
    return JSON.parse(raw) as VideoStreamMetadata;
  } catch {
    return null;
  }
}

async function getChunk(id: string, index: number): Promise<ArrayBuffer | null> {
  const kv = getCloudflareKVNamespace();
  if (kv) {
    const buf = await kv.get<ArrayBuffer>(chunkKey(id, index), "arrayBuffer");
    if (buf) return buf;
  }

  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = await findExistingLocalVideoDir(id);
    if (!dir) return null;
    const nodeBuf = fs.readFileSync(path.join(dir, `chunk_${index}`));
    const ab = new ArrayBuffer(nodeBuf.byteLength);
    new Uint8Array(ab).set(nodeBuf);
    return ab;
  } catch {
    return null;
  }
}

export async function deleteStoredVideoChunks(id: string): Promise<void> {
  if (!isValidVideoId(id)) return;
  try {
    const meta = await getMeta(id);
    const kv = getCloudflareKVNamespace();
    if (kv && typeof kv.delete === "function") {
      if (meta && meta.totalChunks > 0) {
        for (let i = 0; i < meta.totalChunks; i++) {
          await kv.delete(chunkKey(id, i));
        }
      }
      await kv.delete(metaKey(id));
    }
  } catch (err) {
    console.warn("Could not delete KV video chunks:", err);
  }

  try {
    const fs = await import("node:fs");
    const dir = await findExistingLocalVideoDir(id);
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch {
    // ignore on read-only fs
  }
}

export function extractCampusVideoId(videoUrl?: string | null): string | null {
  if (!videoUrl) return null;
  try {
    const parsed = new URL(videoUrl, "http://localhost");
    if (parsed.pathname !== "/api/campus-video") return null;
    const id = parsed.searchParams.get("id");
    return isValidVideoId(id) ? id : null;
  } catch {
    return null;
  }
}

export function parseByteRange(
  rangeHeader: string,
  totalSize: number,
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;
  const startRaw = match[1];
  const endRaw = match[2];

  if (!startRaw && !endRaw) return null;

  let start: number;
  let end: number;

  if (!startRaw && endRaw) {
    const suffix = Number(endRaw);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, totalSize - suffix);
    end = totalSize - 1;
  } else {
    start = Number(startRaw);
    end = endRaw ? Number(endRaw) : totalSize - 1;
  }

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= totalSize
  ) {
    return null;
  }

  return { start, end: Math.min(end, totalSize - 1) };
}

export async function handleCampusVideoRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!isValidVideoId(id)) {
    return Response.json({ error: "Invalid or missing video id." }, { status: 400 });
  }

  if (request.method === "POST") {
    const session = await verifyAdminRequest(request);
    if (!session) {
      return Response.json({ error: "Unauthorized administrator access." }, { status: 401 });
    }

    const action = url.searchParams.get("action") || "chunk";
    const totalChunks = Number(url.searchParams.get("total") || "0");
    const totalSize = Number(url.searchParams.get("size") || "0");
    const chunkSize = Number(url.searchParams.get("chunkSize") || "0");
    const contentType = url.searchParams.get("type") || "video/mp4";

    if (action === "chunk") {
      const index = Number(url.searchParams.get("index") ?? "-1");
      if (!Number.isInteger(index) || index < 0 || !Number.isInteger(totalChunks) || index >= totalChunks) {
        return Response.json({ error: "Invalid video chunk index." }, { status: 400 });
      }
      const buf = await request.arrayBuffer();
      if (buf.byteLength === 0 || buf.byteLength > MAX_SINGLE_CHUNK_BYTES) {
        return Response.json({ error: "Invalid video chunk payload size." }, { status: 400 });
      }
      await putChunk(id, index, buf);
      return Response.json({ ok: true, id, index });
    }

    if (action === "complete") {
      const fileName = url.searchParams.get("name") || `${id}.mp4`;
      if (
        !Number.isInteger(totalChunks) ||
        totalChunks <= 0 ||
        !Number.isInteger(totalSize) ||
        totalSize <= 0 ||
        !Number.isInteger(chunkSize) ||
        chunkSize <= 0
      ) {
        return Response.json({ error: "Invalid video metadata." }, { status: 400 });
      }

      const meta: VideoStreamMetadata = {
        id,
        totalChunks,
        totalSize,
        chunkSize,
        contentType: contentType.startsWith("video/") ? contentType : "video/mp4",
        fileName,
        updatedAt: new Date().toISOString(),
      };
      await putMeta(meta);
      return Response.json({
        ok: true,
        id,
        videoUrl: `/api/campus-video?id=${encodeURIComponent(id)}`,
      });
    }

    return Response.json({ error: "Unsupported action." }, { status: 400 });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const meta = await getMeta(id);
  if (!meta || meta.totalSize <= 0 || meta.totalChunks <= 0) {
    return new Response("Video not found", { status: 404 });
  }

  const baseHeaders: Record<string, string> = {
    "Content-Type": meta.contentType || "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
  };

  if (request.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        ...baseHeaders,
        "Content-Length": String(meta.totalSize),
      },
    });
  }

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const parsed = parseByteRange(rangeHeader, meta.totalSize);
    if (!parsed) {
      return new Response("Range Not Satisfiable", {
        status: 416,
        headers: {
          "Content-Range": `bytes */${meta.totalSize}`,
        },
      });
    }

    const chunkIndex = Math.floor(parsed.start / meta.chunkSize);
    const chunkStartOffset = chunkIndex * meta.chunkSize;
    const chunkBuf = await getChunk(id, chunkIndex);
    if (!chunkBuf) {
      return new Response("Video chunk not found", { status: 404 });
    }

    const chunkEndOffset = chunkStartOffset + chunkBuf.byteLength - 1;
    const actualEnd = Math.min(parsed.end, chunkEndOffset, meta.totalSize - 1);
    const slice = chunkBuf.slice(
      parsed.start - chunkStartOffset,
      actualEnd - chunkStartOffset + 1,
    );

    return new Response(slice, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${parsed.start}-${actualEnd}/${meta.totalSize}`,
        "Content-Length": String(slice.byteLength),
      },
    });
  }

  // Non-Range GET: return single chunk directly or stream sequentially one chunk at a time
  if (meta.totalChunks === 1) {
    const chunkBuf = await getChunk(id, 0);
    if (!chunkBuf) {
      return new Response("Video chunk not found", { status: 404 });
    }
    return new Response(chunkBuf, {
      status: 200,
      headers: {
        ...baseHeaders,
        "Content-Length": String(chunkBuf.byteLength),
      },
    });
  }

  let nextChunkIndex = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (nextChunkIndex >= meta.totalChunks) {
        controller.close();
        return;
      }
      const buf = await getChunk(id, nextChunkIndex);
      nextChunkIndex += 1;
      if (!buf) {
        controller.error(new Error("Missing video chunk"));
        return;
      }
      controller.enqueue(new Uint8Array(buf));
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...baseHeaders,
      "Content-Length": String(meta.totalSize),
    },
  });
}
