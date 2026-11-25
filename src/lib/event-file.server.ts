// Server-only authenticated download handler for private event reports & photos.
// Enforces server-verified admin session cookies per GNITS security policy.
import { verifyAdminRequest } from "@/lib/admin-session.server";
import { isSubmissionPath } from "@/lib/event-validation";
import { getEventFileFromKv } from "@/lib/local-events-store";

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
    const ext = path.extname(cleanPath).toLowerCase();
    const contentType =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".png"
          ? "image/png"
          : ext === ".webp"
            ? "image/webp"
            : ext === ".doc"
              ? "application/msword"
              : ext === ".docx"
                ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                : ext === ".jpg" || ext === ".jpeg"
                  ? "image/jpeg"
                  : "application/octet-stream";
    return {
      bytes: ab,
      contentType,
      fileName: path.basename(cleanPath),
    };
  } catch {
    return null;
  }
}

export async function handleEventFileRequest(request: Request): Promise<Response> {
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

  const stored = (await getEventFileFromKv(rawPath)) || (await readLocalEventFile(rawPath));
  if (!stored) {
    return new Response("Event file not found", { status: 404 });
  }

  const safeFileName = (stored.fileName || rawPath.split("/").pop() || "file").replace(
    /[^a-zA-Z0-9._ -]/g,
    "_",
  );
  const headers: Record<string, string> = {
    "Content-Type": stored.contentType || "application/octet-stream",
    "Content-Length": String(stored.bytes.byteLength),
    "Content-Disposition": `inline; filename="${safeFileName}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };

  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }

  return new Response(stored.bytes, { status: 200, headers });
}
