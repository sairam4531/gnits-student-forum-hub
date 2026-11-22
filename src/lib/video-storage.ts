const DB_NAME = "GNITS_CAMPUS_VIDEO_DB";
const STORE_NAME = "videos";
const FEATURED_KEY = "featured_campus_video";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not available"));
    }
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalVideoBlob(file: Blob, fileName?: string): Promise<string> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const data = {
        blob: file,
        name: fileName || "campus_video.mp4",
        updated_at: Date.now(),
      };
      store.put(data, FEATURED_KEY);
      tx.oncomplete = () => {
        // Broadcast event so any open portal tabs reload video instantly
        try {
          if (typeof window !== "undefined" && "BroadcastChannel" in window) {
            const channel = new BroadcastChannel("gnits_video_broadcast");
            channel.postMessage({ type: "VIDEO_UPDATED" });
            channel.close();
          }
        } catch {
          // ignore
        }
        resolve(URL.createObjectURL(file));
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Could not save to IndexedDB:", err);
    return "";
  }
}

export async function getLocalVideoBlobUrl(): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(FEATURED_KEY);
      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          resolve(URL.createObjectURL(req.result.blob));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function clearLocalVideoBlob(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(FEATURED_KEY);
  } catch {
    // ignore
  }
}
