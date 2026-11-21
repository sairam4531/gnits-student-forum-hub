import fs from "node:fs";
import path from "node:path";

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
  contact_number: string;
  updated_at: string;
}

export interface HomepageDataStore {
  photos: HomepagePhoto[];
  videos: HomepageVideo[];
  dean: DeanDetails;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const HOMEPAGE_FILE = path.join(DATA_DIR, "homepage.json");

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
      description:
        "G. Narayanamma Institute of Technology & Science - Empowering women engineers through technical excellence, leadership, and vibrant student forum activities.",
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
    name: "Dr. K. Rama Linga Reddy",
    designation: "Dean, Student Affairs & Professor",
    profile_photo: "",
    email: "dean.studentaffairs@gnits.ac.in",
    contact_number: "+91 040-23565648 / +91 9849000000",
    updated_at: new Date().toISOString(),
  },
};

export function getHomepageStore(): HomepageDataStore {
  try {
    if (!fs.existsSync(HOMEPAGE_FILE)) {
      saveHomepageStore(DEFAULT_HOMEPAGE_DATA);
      return DEFAULT_HOMEPAGE_DATA;
    }
    const content = fs.readFileSync(HOMEPAGE_FILE, "utf-8");
    const parsed = JSON.parse(content) as Partial<HomepageDataStore>;
    return {
      photos: Array.isArray(parsed.photos) ? parsed.photos : DEFAULT_HOMEPAGE_DATA.photos,
      videos: Array.isArray(parsed.videos) ? parsed.videos : DEFAULT_HOMEPAGE_DATA.videos,
      dean: parsed.dean || DEFAULT_HOMEPAGE_DATA.dean,
    };
  } catch (err) {
    console.warn("Could not read homepage data store:", err);
    return DEFAULT_HOMEPAGE_DATA;
  }
}

export function saveHomepageStore(data: HomepageDataStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(HOMEPAGE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Could not save homepage data store:", err);
  }
}

export function saveUploadedMedia(subfolder: string, fileName: string, base64Data: string): string {
  try {
    const uploadDir = path.resolve(process.cwd(), "public", "uploads", subfolder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName = `${Date.now()}_${sanitizedName}`;
    const filePath = path.join(uploadDir, uniqueName);

    const base64Content = base64Data.includes(",") ? base64Data.split(",")[1]! : base64Data;
    fs.writeFileSync(filePath, Buffer.from(base64Content, "base64"));
    return `/uploads/${subfolder}/${uniqueName}`;
  } catch (err) {
    console.error("Could not save uploaded media:", err);
    return base64Data;
  }
}
