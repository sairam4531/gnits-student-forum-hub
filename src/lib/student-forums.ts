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
] as const;

export type ForumClub = (typeof forums)[number];

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
