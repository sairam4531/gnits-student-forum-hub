export const forums = [
  {
    slug: "technical-events",
    name: "Technical Events",
    number: "01",
    accent: "mint",
    forums: ["ISTE", "IEEE", "CSI", "IETE", "ACM-W", "ACM-W-SIGAI", "GDG", "ATMOS FORUM", "IEI"],
  },
  {
    slug: "cultural-events",
    name: "Cultural Events",
    number: "02",
    accent: "coral",
    forums: [
      "Samskruthi",
      "Philanto",
      "Nrityastra",
      "Literaria Clava",
      "Artista",
      "Talantia",
      "Dhriti",
      "Suswara",
    ],
  },
  {
    slug: "outreach-events",
    name: "Outreach Events",
    number: "03",
    accent: "gold",
    forums: [
      "Rotaract Club",
      "NSS",
      "Street Cause",
      "Environmental Club (Unnat Bharat Abhiyan)",
      "Energy Swaraj",
      "Nirmaan",
    ],
  },
  {
    slug: "innovation-incubation-cell",
    name: "Innovation & Incubation Cell",
    number: "04",
    accent: "blue",
    forums: ["Innovation & Incubation Cell"],
  },
  {
    slug: "research-development-cell",
    name: "Research & Development Cell",
    number: "05",
    accent: "lilac",
    forums: ["Research & Development Cell"],
  },
  {
    slug: "women-protection-abhaya",
    name: "Women Protection Cell (Abhaya)",
    number: "06",
    accent: "rose",
    forums: ["Women Protection Cell (Abhaya)"],
  },
  {
    slug: "institutional-events",
    name: "Institutional Events",
    number: "00",
    accent: "gold",
    forums: [
      "Annual day",
      "Women's Leadership Conclave (WLC)",
      "Graduation Day",
      "Student Council",
      "Orientation Day",
      "Induction Program",
      "Ganesh Utsav",
      "Investiture Ceremony",
      "Student Welfare Fund (SWF)",
    ],
  },
] as const;

export const institutionalEvents = [
  "Annual day",
  "Women's Leadership Conclave (WLC)",
  "Graduation Day",
  "Student Council",
  "Orientation Day",
  "Induction Program",
  "Ganesh Utsav",
  "Investiture Ceremony",
  "Student Welfare Fund (SWF)",
] as const;

export const ACADEMIC_YEARS = [
  "AY:2023-24",
  "AY:2024-25",
  "AY:2025-26",
  "AY:2026-27",
  "AY:2027-28",
] as const;

export type AcademicYear = (typeof ACADEMIC_YEARS)[number];

export type ForumClub = (typeof forums)[number];

export function isInstitutionalClub(clubSlug: string) {
  return clubSlug === "institutional-events";
}

export function normalizeAcademicYear(ay?: string | null): AcademicYear | undefined {
  if (!ay) return undefined;
  const trimmed = ay.trim().toUpperCase();
  return ACADEMIC_YEARS.find(
    (entry) =>
      entry.toUpperCase() === trimmed ||
      toSlug(entry) === toSlug(trimmed) ||
      entry.replace(/^AY:/i, "") === trimmed.replace(/^AY:/i, ""),
  );
}

export function institutionalForumSlugWithAy(
  forumNameOrBaseSlug: string,
  academicYear?: string | null,
): string {
  const { baseSlug } = parseInstitutionalForumSlug(forumNameOrBaseSlug);
  const cleanBase = toSlug(baseSlug);
  const normalizedAy = normalizeAcademicYear(academicYear);
  if (!normalizedAy) return cleanBase;
  return `${cleanBase}--${toSlug(normalizedAy)}`;
}

export function parseInstitutionalForumSlug(slug: string): {
  baseSlug: string;
  academicYear?: AcademicYear;
} {
  const idx = slug.indexOf("--ay-");
  if (idx === -1) {
    return { baseSlug: slug };
  }
  const baseSlug = slug.slice(0, idx);
  const ayPart = slug.slice(idx + 2);
  const academicYear = normalizeAcademicYear(ayPart);
  return academicYear ? { baseSlug, academicYear } : { baseSlug: slug };
}

export function toSlug(label: string) {
  return label
    .toLowerCase()
    .replaceAll("&", "and")
    .replaceAll("(", "")
    .replaceAll(")", "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function forumSlug(clubSlug: string, forumName: string) {
  if (
    clubSlug === "innovation-incubation-cell" ||
    clubSlug === "research-development-cell" ||
    clubSlug === "women-protection-abhaya"
  ) {
    return clubSlug;
  }
  if (clubSlug === "outreach-events" && forumName === "Environmental Club (Unnat Bharat Abhiyan)") {
    return "environmental-club";
  }
  return toSlug(forumName);
}

export function findClub(clubSlug: string) {
  return forums.find((club) => club.slug === clubSlug);
}

export function findForum(clubSlug: string, forumSlug: string) {
  const club = findClub(clubSlug);
  return club?.forums.find((forum) => forumSlugForClub(clubSlug, forum) === forumSlug);
}

function forumSlugForClub(clubSlug: string, forumName: string) {
  return forumSlug(clubSlug, forumName);
}
