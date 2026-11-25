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

const DEFAULT_CLOUDFLARE_ACCOUNT_ID = "f268748965c0561933f524c9983a8f01";
const DEFAULT_CLOUDFLARE_KV_NAMESPACE_ID = "354e86ab39ec47c7b5f4578b4a79ce6a";

export interface CloudflareKVBinding {
  get: <T = unknown>(
    key: string,
    type: "json" | "text" | "arrayBuffer" | "stream",
  ) => Promise<T | null>;
  put: (key: string, value: string | ArrayBuffer | ArrayBufferView) => Promise<void>;
  delete?: (key: string) => Promise<void>;
}

interface EnvContainer {
  KV?: unknown;
  [key: string]: unknown;
}

function readServerEnvVar(name: string): string | undefined {
  const g = globalThis as unknown as {
    __env__?: EnvContainer;
    __cloudflareEnv?: EnvContainer;
    env?: EnvContainer;
  };
  const candidates = [
    typeof process !== "undefined" ? process.env?.[name] : undefined,
    g.__env__?.[name],
    g.__cloudflareEnv?.[name],
    g.env?.[name],
  ];
  for (const val of candidates) {
    if (typeof val === "string" && val.trim().length > 0) {
      return val.trim();
    }
  }
  return undefined;
}

function toRequestBody(
  value: string | ArrayBuffer | ArrayBufferView,
): { body: BodyInit; contentType: string } {
  if (typeof value === "string") {
    return { body: value, contentType: "text/plain; charset=utf-8" };
  }
  if (value instanceof ArrayBuffer) {
    const copy = new Uint8Array(value.byteLength);
    copy.set(new Uint8Array(value));
    return { body: copy, contentType: "application/octet-stream" };
  }
  const view = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return { body: copy, contentType: "application/octet-stream" };
}

let cachedKvRestKey = "";
let cachedKvRestClient: CloudflareKVBinding | null = null;

/**
 * Create a Cloudflare KV REST API adapter matching the Worker KV binding interface
 * so external serverless deployments (such as Vercel) read and write the same store.
 */
function createCloudflareKvRestClient(
  accountId: string,
  namespaceId: string,
  apiToken: string,
): CloudflareKVBinding {
  const cacheKey = `${accountId}:${namespaceId}:${apiToken}`;
  if (cachedKvRestClient && cachedKvRestKey === cacheKey) {
    return cachedKvRestClient;
  }

  const keyUrl = (key: string) =>
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/storage/kv/namespaces/${encodeURIComponent(namespaceId)}/values/${encodeURIComponent(key)}`;

  const client: CloudflareKVBinding = {
    async get<T = unknown>(
      key: string,
      type: "json" | "text" | "arrayBuffer" | "stream",
    ): Promise<T | null> {
      const response = await fetch(keyUrl(key), {
        method: "GET",
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Cloudflare KV REST GET failed (HTTP ${response.status})`);
      }
      if (type === "json") {
        const text = await response.text();
        return text ? (JSON.parse(text) as T) : null;
      }
      if (type === "text") {
        return (await response.text()) as T;
      }
      if (type === "arrayBuffer") {
        return (await response.arrayBuffer()) as T;
      }
      return (response.body as T) ?? null;
    },

    async put(key: string, value: string | ArrayBuffer | ArrayBufferView): Promise<void> {
      const { body, contentType } = toRequestBody(value);
      const response = await fetch(keyUrl(key), {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": contentType,
        },
        body,
      });
      if (!response.ok) {
        throw new Error(`Cloudflare KV REST PUT failed (HTTP ${response.status})`);
      }
    },

    async delete(key: string): Promise<void> {
      const response = await fetch(keyUrl(key), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      if (response.status === 404) {
        return;
      }
      if (!response.ok) {
        throw new Error(`Cloudflare KV REST DELETE failed (HTTP ${response.status})`);
      }
    },
  };

  cachedKvRestKey = cacheKey;
  cachedKvRestClient = client;
  return client;
}

export function getCloudflareKVNamespace(): CloudflareKVBinding | null {
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

  const apiToken = readServerEnvVar("CLOUDFLARE_API_TOKEN");
  if (apiToken) {
    const accountId = readServerEnvVar("CLOUDFLARE_ACCOUNT_ID") || DEFAULT_CLOUDFLARE_ACCOUNT_ID;
    const namespaceId =
      readServerEnvVar("CLOUDFLARE_KV_NAMESPACE_ID") || DEFAULT_CLOUDFLARE_KV_NAMESPACE_ID;
    return createCloudflareKvRestClient(accountId, namespaceId, apiToken);
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
    throw new Error("Could not save homepage data to cloud storage. Please try again.");
  }
}

export function saveUploadedMedia(subfolder: string, fileName: string, base64Data: string): string {
  // On Cloudflare Workers or serverless hosts (e.g. Vercel), runtime static files cannot be served via /uploads/.
  // Returning the self-contained data URL ensures the media renders immediately in all browsers
  // and persists seamlessly in KV.
  if (
    getCloudflareKVNamespace() ||
    readServerEnvVar("VERCEL") ||
    typeof process === "undefined" ||
    !process.cwd
  ) {
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
