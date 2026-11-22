import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { AdminEventRecord } from "@/lib/admin.functions";

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
