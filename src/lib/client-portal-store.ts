import type {
  HomepageDataStore,
  HomepagePhoto,
  HomepageVideo,
  DeanDetails,
} from "@/lib/local-homepage-store";
import type { PublicEventRecord } from "@/lib/events.functions";
import type { AdminEventRecord } from "@/lib/admin.functions";

export const HOMEPAGE_KEY = "GNITS_HOMEPAGE_PERSISTENT_DATA_V3";
export const EVENTS_KEY = "GNITS_EVENTS_PERSISTENT_DATA_V3";
export const ADMIN_EVENTS_KEY = "GNITS_ADMIN_EVENTS_PERSISTENT_DATA_V3";
const EVENT_EDIT_TOKENS_KEY = "GNITS_EVENT_EDIT_TOKENS_V1";
export const DELETED_IDS_KEY = "GNITS_DELETED_ITEMS_TRACKER_V3";
const SYNC_BROADCAST_CHANNEL = "gnits_portal_sync_channel";

export interface DeletedTracker {
  videoIds: string[];
  photoIds: string[];
  eventIds: string[];
}

export interface ClientHomepageData extends HomepageDataStore {
  isUserModified?: boolean | undefined;
  lastUpdated?: number | undefined;
}

// Default initial state
const DEFAULT_CLIENT_DATA: ClientHomepageData = {
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  videos: [],
  dean: {
    id: "dean-1",
    name: "Dr. Aparna Palle",
    designation: "Dean, Student Affairs & Professor",
    profile_photo: "",
    email: "palle.aparna@gnits.ac.in",
    contact_number: "Dean – Student Affairs, GNITS, Hyderabad",
    office: "Dean – Student Affairs, GNITS, Hyderabad",
    updated_at: new Date().toISOString(),
  },
};

function isClient(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function broadcastUpdate(type: "HOMEPAGE" | "EVENTS") {
  if (!isClient()) return;
  try {
    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel(SYNC_BROADCAST_CHANNEL);
      bc.postMessage({ type, timestamp: Date.now() });
      bc.close();
    }
  } catch {
    // ignore
  }
}

export function getDeletedTracker(): DeletedTracker {
  if (!isClient()) return { videoIds: [], photoIds: [], eventIds: [] };
  try {
    const raw = localStorage.getItem(DELETED_IDS_KEY);
    if (!raw) return { videoIds: [], photoIds: [], eventIds: [] };
    const parsed = JSON.parse(raw);
    return {
      videoIds: Array.isArray(parsed.videoIds) ? parsed.videoIds : [],
      photoIds: Array.isArray(parsed.photoIds) ? parsed.photoIds : [],
      eventIds: Array.isArray(parsed.eventIds) ? parsed.eventIds : [],
    };
  } catch {
    return { videoIds: [], photoIds: [], eventIds: [] };
  }
}

function saveDeletedTracker(tracker: DeletedTracker): void {
  if (!isClient()) return;
  try {
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(tracker));
  } catch {
    // ignore
  }
}

// -------------------------------------------------------------
// CLIENT HOMEPAGE STORE
// -------------------------------------------------------------
export function sanitizeVideoRecord(v: HomepageVideo): HomepageVideo {
  const url = v.video_url?.trim() || "";
  const isInvalidUrl =
    !url ||
    url.includes("ForBiggerBlazes") ||
    url === "/assets/campus_loop_video.mp4" ||
    (!url.startsWith("data:") &&
      !url.startsWith("blob:") &&
      !url.startsWith("/") &&
      !url.startsWith("http://") &&
      !url.startsWith("https://"));

  return {
    ...v,
    video_url: isInvalidUrl ? "" : url,
    thumbnail_url: v.thumbnail_url || "/assets/student-affairs-reference.jpg",
  };
}

export function sanitizeDeanRecord(d?: DeanDetails | null): DeanDetails {
  const contact = (
    d?.contact_number?.trim() ||
    d?.office?.trim() ||
    DEFAULT_CLIENT_DATA.dean.contact_number ||
    "Dean – Student Affairs, GNITS, Hyderabad"
  );
  const office = (
    d?.office?.trim() ||
    d?.contact_number?.trim() ||
    DEFAULT_CLIENT_DATA.dean.office ||
    "Dean – Student Affairs, GNITS, Hyderabad"
  );

  return {
    id: d?.id || "dean-1",
    name: d?.name || DEFAULT_CLIENT_DATA.dean.name,
    designation: d?.designation || DEFAULT_CLIENT_DATA.dean.designation,
    profile_photo: d?.profile_photo || "",
    email: d?.email || DEFAULT_CLIENT_DATA.dean.email,
    contact_number: contact,
    office: office,
    updated_at: d?.updated_at || new Date().toISOString(),
  };
}

export function getClientHomepageData(): ClientHomepageData {
  if (!isClient()) return DEFAULT_CLIENT_DATA;
  try {
    const raw = localStorage.getItem(HOMEPAGE_KEY);
    if (!raw) return DEFAULT_CLIENT_DATA;
    const parsed = JSON.parse(raw) as Partial<ClientHomepageData>;
    const tracker = getDeletedTracker();

    const photos = Array.isArray(parsed.photos)
      ? parsed.photos.filter((p) => !tracker.photoIds.includes(p.id))
      : DEFAULT_CLIENT_DATA.photos;

    const rawVideos = Array.isArray(parsed.videos)
      ? parsed.videos.filter((v) => !tracker.videoIds.includes(v.id))
      : DEFAULT_CLIENT_DATA.videos;

    const videos = rawVideos.length > 0
      ? rawVideos.map(sanitizeVideoRecord)
      : DEFAULT_CLIENT_DATA.videos.map(sanitizeVideoRecord);

    const dean = sanitizeDeanRecord(parsed.dean);

    return {
      photos,
      videos,
      dean,
      isUserModified: parsed.isUserModified ?? false,
      lastUpdated: parsed.lastUpdated ?? Date.now(),
    };
  } catch (err) {
    console.warn("Could not read client homepage store:", err);
    return DEFAULT_CLIENT_DATA;
  }
}

export function saveClientHomepageData(data: Partial<ClientHomepageData>): void {
  if (!isClient()) return;
  try {
    const current = getClientHomepageData();
    const updated: ClientHomepageData = {
      photos: data.photos ?? current.photos,
      videos: data.videos ?? current.videos,
      dean: data.dean ?? current.dean,
      isUserModified: true,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(HOMEPAGE_KEY, JSON.stringify(updated));
    broadcastUpdate("HOMEPAGE");
  } catch (err) {
    console.warn("Could not save client homepage store:", err);
  }
}

// -------------------------------------------------------------
// DEAN DETAILS SPECIFIC
// -------------------------------------------------------------
export function saveClientDeanDetails(dean: DeanDetails): void {
  const current = getClientHomepageData();
  saveClientHomepageData({
    ...current,
    dean: {
      ...dean,
      updated_at: new Date().toISOString(),
    },
  });
}

// -------------------------------------------------------------
// VIDEOS SPECIFIC
// -------------------------------------------------------------
export function saveClientVideo(video: HomepageVideo): void {
  const current = getClientHomepageData();
  const existingIdx = current.videos.findIndex((v) => v.id === video.id);

  let updatedVideos = [...current.videos];
  if (video.is_featured) {
    updatedVideos = updatedVideos.map((v) => ({ ...v, is_featured: false }));
  }

  if (existingIdx >= 0) {
    updatedVideos[existingIdx] = { ...video, updated_at: new Date().toISOString() };
  } else {
    updatedVideos.unshift({ ...video, updated_at: new Date().toISOString() });
  }

  // Remove from deleted tracker if re-added
  const tracker = getDeletedTracker();
  if (tracker.videoIds.includes(video.id)) {
    tracker.videoIds = tracker.videoIds.filter((id) => id !== video.id);
    saveDeletedTracker(tracker);
  }

  saveClientHomepageData({
    ...current,
    videos: updatedVideos,
  });
}

export function deleteClientVideo(videoId: string): void {
  const current = getClientHomepageData();
  const tracker = getDeletedTracker();

  if (!tracker.videoIds.includes(videoId)) {
    tracker.videoIds.push(videoId);
    saveDeletedTracker(tracker);
  }

  const remaining = current.videos.filter((v) => v.id !== videoId);
  saveClientHomepageData({
    ...current,
    videos: remaining,
  });
}

// -------------------------------------------------------------
// PHOTOS SPECIFIC
// -------------------------------------------------------------
export function saveClientPhoto(photo: HomepagePhoto): void {
  const current = getClientHomepageData();
  const existingIdx = current.photos.findIndex((p) => p.id === photo.id);

  let updatedPhotos = [...current.photos];
  if (existingIdx >= 0) {
    updatedPhotos[existingIdx] = { ...photo, updated_at: new Date().toISOString() };
  } else {
    updatedPhotos.unshift({ ...photo, updated_at: new Date().toISOString() });
  }

  // Remove from deleted tracker if re-added
  const tracker = getDeletedTracker();
  if (tracker.photoIds.includes(photo.id)) {
    tracker.photoIds = tracker.photoIds.filter((id) => id !== photo.id);
    saveDeletedTracker(tracker);
  }

  saveClientHomepageData({
    ...current,
    photos: updatedPhotos,
  });
}

export function deleteClientPhoto(photoId: string): void {
  const current = getClientHomepageData();
  const tracker = getDeletedTracker();

  if (!tracker.photoIds.includes(photoId)) {
    tracker.photoIds.push(photoId);
    saveDeletedTracker(tracker);
  }

  const remaining = current.photos.filter((p) => p.id !== photoId);
  saveClientHomepageData({
    ...current,
    photos: remaining,
  });
}

// -------------------------------------------------------------
// EVENTS SPECIFIC
// -------------------------------------------------------------
export function getClientEvents(): PublicEventRecord[] {
  if (!isClient()) return [];
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const tracker = getDeletedTracker();
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e) => !tracker.eventIds.includes(e.id));
  } catch {
    return [];
  }
}

export function saveClientEvent(
  event: PublicEventRecord,
  options: { broadcast?: boolean } = {},
): void {
  if (!isClient()) return;
  try {
    const current = getClientEvents();
    const existingIdx = current.findIndex((e) => e.id === event.id);
    if (existingIdx >= 0 && JSON.stringify(current[existingIdx]) === JSON.stringify(event)) {
      return;
    }

    const updated = [...current];
    if (existingIdx >= 0) {
      updated[existingIdx] = event;
    } else {
      updated.unshift(event);
    }

    localStorage.setItem(EVENTS_KEY, JSON.stringify(updated));
    if (options.broadcast !== false) {
      broadcastUpdate("EVENTS");
    }
  } catch {
    // ignore
  }
}

export function syncClientEvents(events: PublicEventRecord[]): void {
  if (!isClient()) return;
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  } catch {
    // ignore
  }
}

export function syncClientForumEvents(
  clubSlug: string,
  forumSlug: string,
  forumEvents: PublicEventRecord[],
): void {
  if (!isClient()) return;
  try {
    const others = getClientEvents().filter(
      (e) => !(e.club_slug === clubSlug && e.forum_slug === forumSlug),
    );
    localStorage.setItem(EVENTS_KEY, JSON.stringify([...forumEvents, ...others]));
  } catch {
    // ignore
  }
}

export function getEventEditToken(eventId: string): string | undefined {
  if (!isClient()) return undefined;
  try {
    const raw = localStorage.getItem(EVENT_EDIT_TOKENS_KEY);
    if (!raw) return undefined;
    const map = JSON.parse(raw) as Record<string, string>;
    return typeof map[eventId] === "string" ? map[eventId] : undefined;
  } catch {
    return undefined;
  }
}

export function saveEventEditToken(eventId: string, token: string): void {
  if (!isClient() || !token) return;
  try {
    const raw = localStorage.getItem(EVENT_EDIT_TOKENS_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[eventId] = token;
    localStorage.setItem(EVENT_EDIT_TOKENS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function deleteClientEvent(eventId: string): void {
  if (!isClient()) return;
  try {
    const tracker = getDeletedTracker();
    if (!tracker.eventIds.includes(eventId)) {
      tracker.eventIds.push(eventId);
      saveDeletedTracker(tracker);
    }
    const current = getClientEvents();
    const remaining = current.filter((e) => e.id !== eventId);
    localStorage.setItem(EVENTS_KEY, JSON.stringify(remaining));
    broadcastUpdate("EVENTS");
  } catch {
    // ignore
  }
}

// -------------------------------------------------------------
// ADMIN EVENTS SPECIFIC (Full metadata for reports & excel)
// -------------------------------------------------------------
export function getClientAdminEvents(): AdminEventRecord[] {
  if (!isClient()) return [];
  try {
    const raw = localStorage.getItem(ADMIN_EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const tracker = getDeletedTracker();
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e: AdminEventRecord) => !tracker.eventIds.includes(e.id));
  } catch {
    return [];
  }
}

export function saveClientAdminEvent(
  event: AdminEventRecord,
  options: { broadcast?: boolean } = {},
): void {
  if (!isClient()) return;
  try {
    const current = getClientAdminEvents();
    const existingIdx = current.findIndex((e) => e.id === event.id);
    if (existingIdx >= 0 && JSON.stringify(current[existingIdx]) === JSON.stringify(event)) {
      return;
    }

    const updated = [...current];
    if (existingIdx >= 0) {
      updated[existingIdx] = event;
    } else {
      updated.unshift(event);
    }

    localStorage.setItem(ADMIN_EVENTS_KEY, JSON.stringify(updated));
    if (options.broadcast !== false) {
      broadcastUpdate("EVENTS");
    }
  } catch {
    // ignore
  }
}

export function deleteClientAdminEvent(eventId: string): void {
  if (!isClient()) return;
  try {
    const tracker = getDeletedTracker();
    if (!tracker.eventIds.includes(eventId)) {
      tracker.eventIds.push(eventId);
      saveDeletedTracker(tracker);
    }
    const current = getClientAdminEvents();
    const remaining = current.filter((e) => e.id !== eventId);
    localStorage.setItem(ADMIN_EVENTS_KEY, JSON.stringify(remaining));
    deleteClientEvent(eventId);
    broadcastUpdate("EVENTS");
  } catch {
    // ignore
  }
}

// -------------------------------------------------------------
// SMART MERGE WITH SERVER DATA
// Guarantees: User uploaded/updated details are NEVER deleted unless explicitly deleted by user
// -------------------------------------------------------------
export function mergeServerWithClient(serverData: HomepageDataStore): ClientHomepageData {
  const tracker = getDeletedTracker();

  // 1. Dean Details: Server-provided Dean is always authoritative across all browsers.
  const sDean = serverData.dean;
  const finalDean = sanitizeDeanRecord({
    id: sDean?.id || "dean-1",
    name: sDean?.name?.trim() || DEFAULT_CLIENT_DATA.dean.name,
    designation: sDean?.designation?.trim() || DEFAULT_CLIENT_DATA.dean.designation,
    profile_photo: sDean?.profile_photo?.trim() || "",
    email: sDean?.email?.trim() || DEFAULT_CLIENT_DATA.dean.email,
    contact_number:
      sDean?.contact_number?.trim() ||
      sDean?.office?.trim() ||
      DEFAULT_CLIENT_DATA.dean.contact_number,
    office:
      sDean?.office?.trim() ||
      sDean?.contact_number?.trim() ||
      DEFAULT_CLIENT_DATA.dean.office,
    updated_at: sDean?.updated_at || new Date().toISOString(),
  });

  // 2. Videos: Authoritative server video list replaces any stale browser-local copy
  const finalVideos: HomepageVideo[] = Array.isArray(serverData.videos)
    ? serverData.videos
        .filter((sv) => sv.video_url && !sv.video_url.includes("ForBiggerBlazes"))
        .map(sanitizeVideoRecord)
    : [];

  // 3. Photos: Server photos are authoritative across all browsers
  const serverPhotos = Array.isArray(serverData.photos) ? serverData.photos : [];
  const finalPhotos: HomepagePhoto[] =
    serverPhotos.length > 0 ? serverPhotos : DEFAULT_CLIENT_DATA.photos;

  // Clear old per-browser homepage deletion flags once authoritative server state loads
  if (tracker.videoIds.length > 0 || tracker.photoIds.length > 0) {
    saveDeletedTracker({ ...tracker, videoIds: [], photoIds: [] });
  }

  const result: ClientHomepageData = {
    dean: finalDean,
    videos: finalVideos,
    photos: finalPhotos,
    isUserModified: false,
    lastUpdated: Date.now(),
  };

  // Keep client storage refreshed without exceeding the ~5MB localStorage quota on large base64 videos
  if (isClient()) {
    try {
      const cacheSafeResult: ClientHomepageData = {
        ...result,
        videos: result.videos.map((v) =>
          v.video_url.startsWith("data:") && v.video_url.length > 500_000
            ? { ...v, video_url: "" }
            : v,
        ),
      };
      localStorage.setItem(HOMEPAGE_KEY, JSON.stringify(cacheSafeResult));
    } catch {
      // ignore
    }
  }

  return result;
}
