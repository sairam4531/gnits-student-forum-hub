import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { AdminEventRecord } from "@/lib/admin.functions";
import { isSubmissionPath } from "@/lib/event-validation";
import { getCloudflareKVNamespace } from "@/lib/local-homepage-store";

const LOCAL_DATA_DIR = path.resolve(process.cwd(), "data");
const LOCAL_EVENTS_FILE = path.join(LOCAL_DATA_DIR, "events.json");

const TMP_DATA_DIR = path.join(os.tmpdir(), "gnits_data");
const TMP_EVENTS_FILE = path.join(TMP_DATA_DIR, "events.json");

declare global {
  // eslint-disable-next-line no-var
  var __gnitsEventsStore: AdminEventRecord[] | undefined;
}

export function getLocalEvents(): AdminEventRecord[] {
  if (globalThis.__gnitsEventsStore) {
    return globalThis.__gnitsEventsStore;
  }

  // Check /tmp
  try {
    if (fs.existsSync(TMP_EVENTS_FILE)) {
      const content = fs.readFileSync(TMP_EVENTS_FILE, "utf-8");
      const list = JSON.parse(content) as AdminEventRecord[];
      globalThis.__gnitsEventsStore = list;
      return list;
    }
  } catch {
    // fallback
  }

  // Check local data file
  try {
    if (fs.existsSync(LOCAL_EVENTS_FILE)) {
      const content = fs.readFileSync(LOCAL_EVENTS_FILE, "utf-8");
      const list = JSON.parse(content) as AdminEventRecord[];
      globalThis.__gnitsEventsStore = list;
      return list;
    }
  } catch (err) {
    console.warn("Could not read local events file:", err);
  }

  globalThis.__gnitsEventsStore = [];
  return [];
}

export function saveLocalEvent(event: AdminEventRecord): void {
  const events = getLocalEvents();
  const existingIndex = events.findIndex((e) => e.id === event.id);
  if (existingIndex >= 0) {
    events[existingIndex] = event;
  } else {
    events.unshift(event);
  }

  globalThis.__gnitsEventsStore = events;

  // Write to /tmp
  try {
    if (!fs.existsSync(TMP_DATA_DIR)) {
      fs.mkdirSync(TMP_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(TMP_EVENTS_FILE, JSON.stringify(events, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not save events to tmp:", err);
  }

  // Write to local data
  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_EVENTS_FILE, JSON.stringify(events, null, 2), "utf-8");
  } catch {
    // Expected on read-only serverless filesystems
  }
}

export function deleteLocalEvent(id: string): void {
  const events = getLocalEvents().filter((e) => e.id !== id);
  globalThis.__gnitsEventsStore = events;

  // Write to /tmp
  try {
    if (fs.existsSync(TMP_EVENTS_FILE)) {
      fs.writeFileSync(TMP_EVENTS_FILE, JSON.stringify(events, null, 2), "utf-8");
    }
  } catch {
    // ignore
  }

  // Write to local data
  try {
    if (fs.existsSync(LOCAL_EVENTS_FILE)) {
      fs.writeFileSync(LOCAL_EVENTS_FILE, JSON.stringify(events, null, 2), "utf-8");
    }
  } catch {
    // Expected on read-only serverless filesystems
  }
}

export function saveFileLocally(relativePath: string, base64Data: string): string {
  try {
    const cleanPath = relativePath.replace(/^\/+/, "");
    const targetPath = path.resolve(process.cwd(), "public", cleanPath);
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const base64Content = base64Data.includes(",") ? base64Data.split(",")[1]! : base64Data;
    fs.writeFileSync(targetPath, Buffer.from(base64Content, "base64"));
    return `/${cleanPath}`;
  } catch {
    return base64Data;
  }
}

export async function getEventsStoreAsync(options?: {
  strictKv?: boolean;
}): Promise<AdminEventRecord[]> {
  const strictKv = Boolean(options?.strictKv);
  try {
    const cfKv = getCloudflareKVNamespace();
    if (cfKv && typeof cfKv.get === "function") {
      const kvData = await cfKv.get<AdminEventRecord[]>("events_store", "json");
      if (Array.isArray(kvData)) {
        globalThis.__gnitsEventsStore = kvData;
        return kvData;
      }
      // Never leak bundled sample data when Cloudflare KV is configured
      const emptyEvents: AdminEventRecord[] = [];
      globalThis.__gnitsEventsStore = emptyEvents;
      return emptyEvents;
    }
  } catch (err) {
    if (strictKv) {
      throw new Error(
        err instanceof Error
          ? `Could not read events store from Cloudflare KV: ${err.message}`
          : "Could not read events store from Cloudflare KV.",
      );
    }
    console.warn("Could not read events store from Cloudflare KV:", err);
  }

  return getLocalEvents();
}

export async function saveEventsStoreAsync(events: AdminEventRecord[]): Promise<void> {
  // 1. Persist to Cloudflare KV first so remote persistence failures are surfaced to callers
  const cfKv = getCloudflareKVNamespace();
  if (cfKv && typeof cfKv.put === "function") {
    await cfKv.put("events_store", JSON.stringify(events));
  }

  globalThis.__gnitsEventsStore = events;

  // 2. Write to local /tmp and data/ for dev fallback
  try {
    if (!fs.existsSync(TMP_DATA_DIR)) {
      fs.mkdirSync(TMP_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(TMP_EVENTS_FILE, JSON.stringify(events, null, 2), "utf-8");
  } catch {}
  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_EVENTS_FILE, JSON.stringify(events, null, 2), "utf-8");
  } catch {}
}

export interface StoredEventFileMetadata {
  contentType: string;
  size: number;
  fileName: string;
}

function eventFileMetaKey(objectPath: string): string {
  return `event_file_meta:${objectPath}`;
}

function eventFileDataKey(objectPath: string): string {
  return `event_file_data:${objectPath}`;
}

export function buildEventFileDownloadUrl(objectPath: string): string {
  return `/api/event-file?path=${encodeURIComponent(objectPath)}`;
}

function parseDataUrlBase64(
  dataUrlOrBase64: string,
  fallbackContentType = "application/octet-stream",
): { bytes: Uint8Array<ArrayBuffer>; contentType: string } | null {
  const trimmed = dataUrlOrBase64.trim();
  if (!trimmed) return null;

  let contentType = fallbackContentType;
  let base64Body = trimmed;

  const commaIdx = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && commaIdx > 0) {
    const header = trimmed.slice(5, commaIdx);
    const semiIdx = header.indexOf(";");
    const detectedType = (semiIdx >= 0 ? header.slice(0, semiIdx) : header).trim();
    if (detectedType) contentType = detectedType;
    base64Body = trimmed.slice(commaIdx + 1);
  }

  try {
    const binaryStr = atob(base64Body);
    const buffer = new ArrayBuffer(binaryStr.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return { bytes, contentType };
  } catch {
    return null;
  }
}

export async function saveEventFileToKv(
  objectPath: string,
  dataUrlOrBase64: string,
  fallbackContentType?: string,
  fileName?: string,
): Promise<boolean> {
  if (!isSubmissionPath(objectPath)) return false;
  const cfKv = getCloudflareKVNamespace();
  if (!cfKv || typeof cfKv.put !== "function") return false;

  const decoded = parseDataUrlBase64(dataUrlOrBase64, fallbackContentType);
  if (!decoded || decoded.bytes.byteLength === 0) return false;

  const meta: StoredEventFileMetadata = {
    contentType: decoded.contentType,
    size: decoded.bytes.byteLength,
    fileName: fileName || objectPath.split("/").pop() || "file",
  };

  try {
    await cfKv.put(eventFileDataKey(objectPath), decoded.bytes.buffer);
    await cfKv.put(eventFileMetaKey(objectPath), JSON.stringify(meta));
    return true;
  } catch (err) {
    console.warn("Could not save event file to Cloudflare KV:", objectPath, err);
    return false;
  }
}

export async function getEventFileFromKv(
  objectPath: string,
): Promise<{ bytes: ArrayBuffer; contentType: string; fileName: string } | null> {
  if (!isSubmissionPath(objectPath)) return null;
  const cfKv = getCloudflareKVNamespace();
  if (!cfKv || typeof cfKv.get !== "function") return null;

  try {
    const [meta, bytes] = await Promise.all([
      cfKv.get<StoredEventFileMetadata>(eventFileMetaKey(objectPath), "json"),
      cfKv.get<ArrayBuffer>(eventFileDataKey(objectPath), "arrayBuffer"),
    ]);
    if (!bytes) return null;
    return {
      bytes,
      contentType: meta?.contentType || "application/octet-stream",
      fileName: meta?.fileName || objectPath.split("/").pop() || "file",
    };
  } catch (err) {
    console.warn("Could not read event file from Cloudflare KV:", objectPath, err);
    return null;
  }
}

export async function hasEventFileInKv(objectPath: string): Promise<boolean> {
  if (!isSubmissionPath(objectPath)) return false;
  const cfKv = getCloudflareKVNamespace();
  if (!cfKv || typeof cfKv.get !== "function") return false;
  try {
    const meta = await cfKv.get<StoredEventFileMetadata>(eventFileMetaKey(objectPath), "json");
    return Boolean(meta && meta.size > 0);
  } catch {
    return false;
  }
}

export async function deleteEventFilesFromKv(paths: string[]): Promise<void> {
  const cfKv = getCloudflareKVNamespace();
  if (!cfKv || typeof cfKv.delete !== "function") return;

  for (const p of paths) {
    if (!isSubmissionPath(p)) continue;
    try {
      await cfKv.delete(eventFileMetaKey(p));
      await cfKv.delete(eventFileDataKey(p));
    } catch {
      // ignore cleanup failures
    }
  }
}
