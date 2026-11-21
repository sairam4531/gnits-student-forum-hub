import fs from "node:fs";
import path from "node:path";
import type { AdminEventRecord } from "@/lib/admin.functions";

const DATA_DIR = path.resolve(process.cwd(), "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");

export function getLocalEvents(): AdminEventRecord[] {
  try {
    if (!fs.existsSync(EVENTS_FILE)) return [];
    const content = fs.readFileSync(EVENTS_FILE, "utf-8");
    return JSON.parse(content) as AdminEventRecord[];
  } catch (err) {
    console.warn("Could not read local events file:", err);
    return [];
  }
}

export function saveLocalEvent(event: AdminEventRecord): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const events = getLocalEvents();
    // Check if event with same id already exists
    const existingIndex = events.findIndex((e) => e.id === event.id);
    if (existingIndex >= 0) {
      events[existingIndex] = event;
    } else {
      events.unshift(event);
    }
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2), "utf-8");
  } catch (err) {
    console.error("Could not save event locally:", err);
  }
}

export function saveFileLocally(relativePath: string, base64Data: string): string {
  try {
    // Clean relative path (e.g. submissions/<uuid>/<file.ext>)
    const cleanPath = relativePath.replace(/^\/+/, "");
    const targetPath = path.resolve(process.cwd(), "public", cleanPath);
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    // Strip data URL prefix if present
    const base64Content = base64Data.includes(",") ? base64Data.split(",")[1]! : base64Data;
    fs.writeFileSync(targetPath, Buffer.from(base64Content, "base64"));
    return `/${cleanPath}`;
  } catch (err) {
    console.error("Could not save file locally:", err);
    return `/${relativePath}`;
  }
}
