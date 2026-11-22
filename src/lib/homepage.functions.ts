import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import crypto from "node:crypto";
import {
  getHomepageStore,
  getHomepageStoreAsync,
  saveHomepageStore,
  saveHomepageStoreAsync,
  saveUploadedMedia,
  type HomepagePhoto,
  type HomepageVideo,
  type DeanDetails,
} from "@/lib/local-homepage-store";

const SESSION_COOKIE_NAME = "gnits_admin_session";
const SESSION_SECRET =
  process.env["ADMIN_SESSION_SECRET"] || "gnits-student-council-secure-session-key-2026";

function verifyAdminSession(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [data, sig] = parts;
  if (!data || !sig) return false;

  const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  if (sig.length !== expectedSig.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return false;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf-8")) as {
      username: string;
      exp: number;
    };
    return !payload.exp || Date.now() <= payload.exp;
  } catch {
    return false;
  }
}

// -------------------------------------------------------------
// PUBLIC HOMEPAGE DATA
// -------------------------------------------------------------
export const getPublicHomepageDataServerFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const store = await getHomepageStoreAsync();
    const activePhotos = store.photos.filter((p) => p.is_active);
    const featuredPhotos = activePhotos
      .filter((p) => p.is_featured)
      .sort((a, b) => a.display_order - b.display_order);

    // If no photos explicitly featured, take the top 2 active photos
    const displayPhotos = featuredPhotos.length > 0 ? featuredPhotos.slice(0, 4) : activePhotos.slice(0, 4);

    const activeVideos = store.videos.filter((v) => v.is_active);
    const featuredVideo =
      activeVideos.find((v) => v.is_featured) ||
      activeVideos[0] ||
      null;

    return {
      photos: activePhotos,
      featuredPhotos: displayPhotos,
      featuredVideo,
      allVideos: activeVideos,
      dean: store.dean,
    };
  },
);

export const getAllPublicPhotosServerFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const store = await getHomepageStoreAsync();
    return store.photos
      .filter((p) => p.is_active)
      .sort((a, b) => a.display_order - b.display_order);
  },
);

// -------------------------------------------------------------
// ADMIN HOMEPAGE DATA & MANAGEMENT
// -------------------------------------------------------------
export const getAdminHomepageDataServerFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const sessionToken = getCookie(SESSION_COOKIE_NAME);
    if (!verifyAdminSession(sessionToken)) {
      throw new Error("Unauthorized administrator access.");
    }
    return await getHomepageStoreAsync();
  },
);

// Photo CRUD
const PhotoInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.string().default("Campus"),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  display_order: z.number().default(0),
  image_url: z.string().optional(),
  imageBase64: z.string().optional(),
  imageFileName: z.string().optional(),
});

export const savePhotoAdminServerFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => PhotoInputSchema.parse(d))
  .handler(async ({ data }) => {
    const sessionToken = getCookie(SESSION_COOKIE_NAME);
    if (!verifyAdminSession(sessionToken)) {
      throw new Error("Unauthorized administrator access.");
    }

    const store = await getHomepageStoreAsync();
    let finalImageUrl = data.image_url || "";

    if (data.imageBase64 && data.imageFileName) {
      finalImageUrl = saveUploadedMedia("photos", data.imageFileName, data.imageBase64);
    }

    if (!finalImageUrl) {
      finalImageUrl = "/assets/student-forum-dance-01.jpg";
    }

    const now = new Date().toISOString();

    if (data.id) {
      // Edit
      const index = store.photos.findIndex((p) => p.id === data.id);
      if (index === -1) throw new Error("Photo not found.");
      store.photos[index] = {
        ...store.photos[index]!,
        title: data.title,
        description: data.description || "",
        category: data.category,
        is_active: data.is_active,
        is_featured: data.is_featured,
        display_order: data.display_order,
        image_url: finalImageUrl,
        updated_at: now,
      };
    } else {
      // Create new
      const newPhoto: HomepagePhoto = {
        id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: data.title,
        description: data.description || "",
        category: data.category,
        is_active: data.is_active,
        is_featured: data.is_featured,
        display_order: data.display_order || store.photos.length + 1,
        image_url: finalImageUrl,
        created_at: now,
        updated_at: now,
      };
      store.photos.unshift(newPhoto);
    }

    await saveHomepageStoreAsync(store);
    return { success: true };
  });

export const deletePhotoAdminServerFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const sessionToken = getCookie(SESSION_COOKIE_NAME);
    if (!verifyAdminSession(sessionToken)) {
      throw new Error("Unauthorized administrator access.");
    }

    const store = await getHomepageStoreAsync();
    store.photos = store.photos.filter((p) => p.id !== data.id);
    await saveHomepageStoreAsync(store);
    return { success: true };
  });

export const togglePhotoStatusServerFn = createServerFn({ method: "POST" })
  .validator(
    (d: unknown) =>
      z
        .object({
          id: z.string(),
          field: z.enum(["is_active", "is_featured"]),
          value: z.boolean(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const sessionToken = getCookie(SESSION_COOKIE_NAME);
    if (!verifyAdminSession(sessionToken)) {
      throw new Error("Unauthorized administrator access.");
    }

    const store = await getHomepageStoreAsync();
    const photo = store.photos.find((p) => p.id === data.id);
    if (photo) {
      photo[data.field] = data.value;
      photo.updated_at = new Date().toISOString();
      await saveHomepageStoreAsync(store);
    }
    return { success: true };
  });

// Video CRUD
const VideoInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional().default("GNITS Campus Video"),
  description: z.string().optional().default(""),
  video_url: z.string().optional(),
  videoBase64: z.string().optional(),
  videoFileName: z.string().optional(),
  thumbnail_url: z.string().optional(),
  thumbnailBase64: z.string().optional(),
  thumbnailFileName: z.string().optional(),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(true),
  display_order: z.number().default(0),
});

export const saveVideoAdminServerFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => VideoInputSchema.parse(d))
  .handler(async ({ data }) => {
    const sessionToken = getCookie(SESSION_COOKIE_NAME);
    if (!verifyAdminSession(sessionToken)) {
      throw new Error("Unauthorized administrator access.");
    }

    const store = await getHomepageStoreAsync();
    let finalVideoUrl = data.video_url || "";
    let finalThumbnailUrl = data.thumbnail_url || "";

    // Convert Google Drive view links to direct streaming links if provided
    if (finalVideoUrl.includes("drive.google.com")) {
      const match = finalVideoUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        finalVideoUrl = `https://drive.google.com/uc?export=download&id=${match[1]}`;
      }
    }

    if (data.videoBase64 && data.videoFileName) {
      try {
        finalVideoUrl = saveUploadedMedia("videos", data.videoFileName, data.videoBase64);
      } catch (err) {
        console.warn("Could not save video to disk:", err);
      }
    }

    if (data.thumbnailBase64 && data.thumbnailFileName) {
      try {
        finalThumbnailUrl = saveUploadedMedia("thumbnails", data.thumbnailFileName, data.thumbnailBase64);
      } catch (err) {
        console.warn("Could not save thumbnail to disk:", err);
      }
    }

    if (!finalThumbnailUrl) {
      finalThumbnailUrl = "/assets/student-affairs-reference.jpg";
    }

    if (!finalVideoUrl) {
      finalVideoUrl = "/assets/campus_loop_video.mp4";
    }

    const now = new Date().toISOString();
    const finalTitle = data.title?.trim() || data.videoFileName || "GNITS Campus Video";
    const finalDescription = data.description?.trim() || "";

    // If setting as featured, unfeature others
    if (data.is_featured) {
      store.videos.forEach((v) => {
        v.is_featured = false;
      });
    }

    if (data.id) {
      const idx = store.videos.findIndex((v) => v.id === data.id);
      if (idx === -1) throw new Error("Video not found.");
      store.videos[idx] = {
        ...store.videos[idx]!,
        title: finalTitle,
        description: finalDescription,
        video_url: finalVideoUrl,
        thumbnail_url: finalThumbnailUrl,
        is_active: data.is_active,
        is_featured: data.is_featured,
        display_order: data.display_order,
        updated_at: now,
      };
    } else {
      const newVideo: HomepageVideo = {
        id: `video-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: finalTitle,
        description: finalDescription,
        video_url: finalVideoUrl,
        thumbnail_url: finalThumbnailUrl,
        is_active: data.is_active,
        is_featured: data.is_featured,
        display_order: data.display_order || store.videos.length + 1,
        created_at: now,
        updated_at: now,
      };
      store.videos.unshift(newVideo);
    }

    await saveHomepageStoreAsync(store);
    return { success: true };
  });

export const deleteVideoAdminServerFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const sessionToken = getCookie(SESSION_COOKIE_NAME);
    if (!verifyAdminSession(sessionToken)) {
      throw new Error("Unauthorized administrator access.");
    }

    const store = await getHomepageStoreAsync();
    store.videos = store.videos.filter((v) => v.id !== data.id);
    await saveHomepageStoreAsync(store);
    return { success: true };
  });

export const setFeaturedVideoAdminServerFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const sessionToken = getCookie(SESSION_COOKIE_NAME);
    if (!verifyAdminSession(sessionToken)) {
      throw new Error("Unauthorized administrator access.");
    }

    const store = await getHomepageStoreAsync();
    store.videos.forEach((v) => {
      v.is_featured = v.id === data.id;
    });
    await saveHomepageStoreAsync(store);
    return { success: true };
  });

// Dean Details Update
const DeanDetailsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  designation: z.string().min(1, "Designation is required"),
  email: z.string().email("Valid email is required"),
  contact_number: z.string().optional(),
  office: z.string().optional(),
  profile_photo: z.string().optional(),
  photoBase64: z.string().optional(),
  photoFileName: z.string().optional(),
});

export const updateDeanDetailsAdminServerFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => DeanDetailsSchema.parse(d))
  .handler(async ({ data }) => {
    const sessionToken = getCookie(SESSION_COOKIE_NAME);
    if (!verifyAdminSession(sessionToken)) {
      throw new Error("Unauthorized administrator access.");
    }

    const store = await getHomepageStoreAsync();
    let finalPhotoUrl = (data.profile_photo || "").trim();

    if (data.photoBase64) {
      finalPhotoUrl = saveUploadedMedia("dean", data.photoFileName || "dean_photo.jpg", data.photoBase64);
    } else if (!finalPhotoUrl && store.dean.profile_photo) {
      finalPhotoUrl = store.dean.profile_photo;
    }

    const officeValue =
      data.office?.trim() ||
      data.contact_number?.trim() ||
      store.dean.office ||
      store.dean.contact_number ||
      "Dean – Student Affairs, GNITS, Hyderabad";

    store.dean = {
      id: store.dean.id || "dean-1",
      name: data.name,
      designation: data.designation,
      email: data.email,
      contact_number: officeValue,
      office: officeValue,
      profile_photo: finalPhotoUrl,
      updated_at: new Date().toISOString(),
    };

    await saveHomepageStoreAsync(store);
    return { success: true, dean: store.dean };
  });
