import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface HomepagePhoto {
  id: string;
  title: string;
  description: string;
  image_url: string;
  category: string;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface HomepageVideo {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface DeanDetails {
  id: string;
  name: string;
  designation: string;
  profile_photo: string;
  email: string;
  contact_number?: string | undefined;
  office?: string | undefined;
  updated_at: string;
}

export interface HomepageDataStore {
  photos: HomepagePhoto[];
  videos: HomepageVideo[];
  dean: DeanDetails;
}

// 1. Project local data path
const LOCAL_DATA_DIR = path.resolve(process.cwd(), "data");
const LOCAL_HOMEPAGE_FILE = path.join(LOCAL_DATA_DIR, "homepage.json");

// 2. Serverless writable temporary fallback path (Vercel / AWS Lambda)
const TMP_DATA_DIR = path.join(os.tmpdir(), "gnits_data");
const TMP_HOMEPAGE_FILE = path.join(TMP_DATA_DIR, "homepage.json");

// 3. In-memory global singleton for warm lambda containers
declare global {
  // eslint-disable-next-line no-var
  var __gnitsHomepageStore: HomepageDataStore | undefined;
}

const DEFAULT_HOMEPAGE_DATA: HomepageDataStore = {
  photos: [
    {
      id: "photo-1",
      title: "Scenic Mountain & Sunrise Campus Vista",
      description: "Inspiring morning view of the sprawling GNITS academic atmosphere.",
      image_url: "/assets/student-forum-dance-01.jpg",
      category: "Campus",
      is_active: true,
      is_featured: true,
      display_order: 1,
      created_at: "2026-11-20T10:00:00.000Z",
      updated_at: "2026-11-20T10:00:00.000Z",
    },
    {
      id: "photo-2",
      title: "GNITS Green Campus & Academic Quad",
      description: "Lush campus avenue surrounded by serene trees and modern infrastructure.",
      image_url: "/assets/student-forum-team-02.webp",
      category: "Campus",
      is_active: true,
      is_featured: true,
      display_order: 2,
      created_at: "2026-11-19T09:30:00.000Z",
      updated_at: "2026-11-19T09:30:00.000Z",
    },
    {
      id: "photo-3",
      title: "Annual Fest & Cultural Stage Celebrations",
      description: "Student Council forum performances celebrating creativity, talent, and youth.",
      image_url: "/assets/student-forum-stage-04.webp",
      category: "Events",
      is_active: true,
      is_featured: false,
      display_order: 3,
      created_at: "2026-11-18T14:15:00.000Z",
      updated_at: "2026-11-18T14:15:00.000Z",
    },
    {
      id: "photo-4",
      title: "Technical Innovation & Robotics Hackathon",
      description: "Women engineers collaborating on cutting-edge AI and hardware prototypes.",
      image_url: "/assets/student-forum-team-03.webp",
      category: "Clubs",
      is_active: true,
      is_featured: false,
      display_order: 4,
      created_at: "2026-11-17T11:00:00.000Z",
      updated_at: "2026-11-17T11:00:00.000Z",
    },
  ],
  videos: [],
  dean: {
    id: "dean-1",
    name: "Dr. Aparna Patle",
    designation: "Dean, Student Affairs & Professor",
    profile_photo: "",
    email: "aparna.patle@gnits.ac.in",
    contact_number: "Dean – Student Affairs, GNITS, Hyderabad",
    office: "Dean – Student Affairs, GNITS, Hyderabad",
    updated_at: "2026-11-22T19:42:00.000Z",
  },
};

export function getHomepageStore(): HomepageDataStore {
  // 1. Check in-memory global cache first
  if (globalThis.__gnitsHomepageStore) {
    return globalThis.__gnitsHomepageStore;
  }

  // 2. Check /tmp filesystem cache (writable across warm requests on serverless)
  try {
    if (fs.existsSync(TMP_HOMEPAGE_FILE)) {
      const content = fs.readFileSync(TMP_HOMEPAGE_FILE, "utf-8");
      const parsed = JSON.parse(content) as Partial<HomepageDataStore>;
      const store: HomepageDataStore = {
        photos: Array.isArray(parsed.photos) ? parsed.photos : DEFAULT_HOMEPAGE_DATA.photos,
        videos: Array.isArray(parsed.videos) ? parsed.videos : DEFAULT_HOMEPAGE_DATA.videos,
        dean: parsed.dean || DEFAULT_HOMEPAGE_DATA.dean,
      };
      globalThis.__gnitsHomepageStore = store;
      return store;
    }
  } catch {
    // continue to local file
  }

  // 3. Check local bundled file
  try {
    if (fs.existsSync(LOCAL_HOMEPAGE_FILE)) {
      const content = fs.readFileSync(LOCAL_HOMEPAGE_FILE, "utf-8");
      const parsed = JSON.parse(content) as Partial<HomepageDataStore>;
      const store: HomepageDataStore = {
        photos: Array.isArray(parsed.photos) ? parsed.photos : DEFAULT_HOMEPAGE_DATA.photos,
        videos: Array.isArray(parsed.videos) ? parsed.videos : DEFAULT_HOMEPAGE_DATA.videos,
        dean: parsed.dean || DEFAULT_HOMEPAGE_DATA.dean,
      };
      globalThis.__gnitsHomepageStore = store;
      return store;
    }
  } catch (err) {
    console.warn("Could not read local homepage store:", err);
  }

  // 4. Fallback to default data
  globalThis.__gnitsHomepageStore = DEFAULT_HOMEPAGE_DATA;
  return DEFAULT_HOMEPAGE_DATA;
}

export function saveHomepageStore(data: HomepageDataStore): void {
  // 1. Update in-memory singleton
  globalThis.__gnitsHomepageStore = data;

  // 2. Write to /tmp (always writable in Serverless environments)
  try {
    if (!fs.existsSync(TMP_DATA_DIR)) {
      fs.mkdirSync(TMP_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(TMP_HOMEPAGE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not write to tmp homepage store:", err);
  }

  // 3. Attempt write to project workspace data/ (succeeds in local dev, fails harmlessly on read-only serverless)
  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_HOMEPAGE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Expected on read-only serverless filesystems
  }
}

export function getCloudflareKVNamespace(): {
  get: <T = unknown>(key: string, type: "json" | "text") => Promise<T | null>;
  put: (key: string, value: string) => Promise<void>;
} | null {
  const g = globalThis as unknown as {
    __env__?: { KV?: any };
    __cloudflareEnv?: { KV?: any };
    env?: { KV?: any };
    KV?: any;
  };
  const kv =
    g.__env__?.KV ||
    g.__cloudflareEnv?.KV ||
    g.env?.KV ||
    g.KV ||
    (typeof process !== "undefined" && (process.env as any)?.KV) ||
    null;

  if (kv && typeof kv.get === "function" && typeof kv.put === "function") {
    return kv;
  }
  return null;
}

export async function getHomepageStoreAsync(): Promise<HomepageDataStore> {
  // 1. If running on Cloudflare Workers and KV binding is present, fetch from KV
  try {
    const cfKv = getCloudflareKVNamespace();
    if (cfKv && typeof cfKv.get === "function") {
      const kvData = await cfKv.get<Partial<HomepageDataStore>>("homepage_store", "json");
      if (kvData && (Array.isArray(kvData.photos) || Array.isArray(kvData.videos) || kvData.dean)) {
        const store: HomepageDataStore = {
          photos: Array.isArray(kvData.photos) ? kvData.photos : DEFAULT_HOMEPAGE_DATA.photos,
          videos: Array.isArray(kvData.videos) ? kvData.videos : DEFAULT_HOMEPAGE_DATA.videos,
          dean: kvData.dean ? { ...DEFAULT_HOMEPAGE_DATA.dean, ...kvData.dean } : DEFAULT_HOMEPAGE_DATA.dean,
        };
        globalThis.__gnitsHomepageStore = store;
        return store;
      }
    }
  } catch (err) {
    console.warn("Could not read homepage store from Cloudflare KV:", err);
  }

  // 2. Fall back to synchronous local reader (memory -> /tmp -> local file -> defaults)
  return getHomepageStore();
}

export async function saveHomepageStoreAsync(data: HomepageDataStore): Promise<void> {
  // 1. Keep local memory and disk in sync for fallback
  saveHomepageStore(data);

  // 2. If running on Cloudflare Workers, persist to KV
  try {
    const cfKv = getCloudflareKVNamespace();
    if (cfKv && typeof cfKv.put === "function") {
      await cfKv.put("homepage_store", JSON.stringify(data));
    }
  } catch (err) {
    console.warn("Could not persist homepage store to Cloudflare KV:", err);
  }
}

export function saveUploadedMedia(subfolder: string, fileName: string, base64Data: string): string {
  // On Cloudflare Workers or serverless edge, runtime static files cannot be served via /uploads/.
  // Returning the self-contained data URL ensures the media renders immediately in all browsers
  // and persists seamlessly in KV.
  if (getCloudflareKVNamespace() || typeof process === "undefined" || !process.cwd) {
    return base64Data;
  }

  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueName = `${Date.now()}_${sanitizedName}`;

  // Attempt writing to public/uploads in local dev/Node environments
  try {
    const uploadDir = path.resolve(process.cwd(), "public", "uploads", subfolder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filePath = path.join(uploadDir, uniqueName);
    const base64Content = base64Data.includes(",") ? base64Data.split(",")[1]! : base64Data;
    fs.writeFileSync(filePath, Buffer.from(base64Content, "base64"));
    return `/uploads/${subfolder}/${uniqueName}`;
  } catch {
    // If filesystem is read-only (e.g. Cloudflare / Vercel), return data URL directly
    return base64Data;
  }
}
