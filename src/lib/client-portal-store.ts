import type {
  HomepageDataStore,
  HomepagePhoto,
  HomepageVideo,
  DeanDetails,
} from "@/lib/local-homepage-store";
import type { PublicEventRecord } from "@/lib/events.functions";

const HOMEPAGE_KEY = "GNITS_HOMEPAGE_PERSISTENT_DATA_V2";
const EVENTS_KEY = "GNITS_EVENTS_PERSISTENT_DATA_V2";
const DELETED_IDS_KEY = "GNITS_DELETED_ITEMS_TRACKER_V2";
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
  videos: [
    {
      id: "video-1",
      title: "GNITS Campus Tour & Student Affairs Highlights",
      description: "Empowering women engineers through technical excellence, leadership, and vibrant student forum activities.",
      video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      thumbnail_url: "/assets/student-affairs-reference.jpg",
      is_active: true,
      is_featured: true,
      display_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  dean: {
    id: "dean-1",
    name: "Dr. Aparna Patle",
    designation: "Dean, Student Affairs & Professor",
    profile_photo: "",
    email: "aparna.patle@gnits.ac.in",
    contact_number: "",
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

    const videos = Array.isArray(parsed.videos)
      ? parsed.videos.filter((v) => !tracker.videoIds.includes(v.id))
      : DEFAULT_CLIENT_DATA.videos;

    return {
      photos,
      videos,
      dean: parsed.dean || DEFAULT_CLIENT_DATA.dean,
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

export function saveClientEvent(event: PublicEventRecord): void {
  if (!isClient()) return;
  try {
    const current = getClientEvents();
    const existingIdx = current.findIndex((e) => e.id === event.id);
    const updated = [...current];

    if (existingIdx >= 0) {
      updated[existingIdx] = event;
    } else {
      updated.unshift(event);
    }

    localStorage.setItem(EVENTS_KEY, JSON.stringify(updated));
    broadcastUpdate("EVENTS");
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
// SMART MERGE WITH SERVER DATA
// Guarantees: User uploaded/updated details are NEVER deleted unless explicitly deleted by user
// -------------------------------------------------------------
export function mergeServerWithClient(serverData: HomepageDataStore): ClientHomepageData {
  const clientData = getClientHomepageData();
  const tracker = getDeletedTracker();

  // 1. Dean Details: If client modified Dean, preserve client Dean!
  let finalDean = serverData.dean || clientData.dean;
  if (clientData.isUserModified && clientData.dean) {
    finalDean = clientData.dean;
  }

  // 2. Videos: Merge without resurrecting deleted items, preserving user-uploaded videos
  const mergedVideosMap = new Map<string, HomepageVideo>();

  // Add server videos that were not deleted
  (serverData.videos || []).forEach((sv) => {
    if (!tracker.videoIds.includes(sv.id)) {
      mergedVideosMap.set(sv.id, sv);
    }
  });

  // Client videos take precedence or append
  (clientData.videos || []).forEach((cv) => {
    if (!tracker.videoIds.includes(cv.id)) {
      mergedVideosMap.set(cv.id, cv);
    }
  });

  const finalVideos = Array.from(mergedVideosMap.values());

  // 3. Photos: Merge without resurrecting deleted items
  const mergedPhotosMap = new Map<string, HomepagePhoto>();

  (serverData.photos || []).forEach((sp) => {
    if (!tracker.photoIds.includes(sp.id)) {
      mergedPhotosMap.set(sp.id, sp);
    }
  });

  (clientData.photos || []).forEach((cp) => {
    if (!tracker.photoIds.includes(cp.id)) {
      mergedPhotosMap.set(cp.id, cp);
    }
  });

  const finalPhotos = Array.from(mergedPhotosMap.values());

  const result: ClientHomepageData = {
    dean: finalDean,
    videos: finalVideos,
    photos: finalPhotos,
    isUserModified: clientData.isUserModified ?? false,
    lastUpdated: Date.now(),
  };

  // Keep client storage refreshed with the verified merged state
  if (isClient()) {
    try {
      localStorage.setItem(HOMEPAGE_KEY, JSON.stringify(result));
    } catch {
      // ignore
    }
  }

  return result;
}
