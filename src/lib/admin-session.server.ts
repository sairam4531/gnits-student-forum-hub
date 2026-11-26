// Server-only session security module for GNITS Student Affairs Portal.
// Compatible with Cloudflare Workers and Node.js using the standard Web Crypto API.

export const SESSION_COOKIE_NAME = "gnits_admin_session";
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type PortalRole = "it-admin" | "admin";

export interface AdminAccountConfig {
  username: string;
  password: string;
  role: PortalRole;
  allowedClubSlug: string | null;
  label: string;
}

export const ADMIN_USERNAME = "studentcouncil";
export const ADMIN_PASSWORD = "studentcouncil@1234";

const PORTAL_ACCOUNTS: readonly AdminAccountConfig[] = [
  {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
    role: "it-admin",
    allowedClubSlug: null,
    label: "IT-Admin (Student Council)",
  },
  {
    username: "gnitstechnical",
    password: "gnitstechnical@1234",
    role: "admin",
    allowedClubSlug: "technical-events",
    label: "Technical Events Admin",
  },
  {
    username: "gnitscultural",
    password: "gnitscultural@1234",
    role: "admin",
    allowedClubSlug: "cultural-events",
    label: "Cultural Events Admin",
  },
  {
    username: "gnitsoutreach",
    password: "gnitsoutreach@1234",
    role: "admin",
    allowedClubSlug: "outreach-events",
    label: "Outreach Events Admin",
  },
  {
    username: "gnitsi&i",
    password: "gnitsi&i@1234",
    role: "admin",
    allowedClubSlug: "innovation-incubation-cell",
    label: "Innovation & Incubation Cell Admin",
  },
  {
    username: "gnitsr&d",
    password: "gnitsr&d@1234",
    role: "admin",
    allowedClubSlug: "research-development-cell",
    label: "Research & Development Cell Admin",
  },
  {
    username: "gnitswpc",
    password: "gnitswpc@1234",
    role: "admin",
    allowedClubSlug: "women-protection-abhaya",
    label: "Women Protection Cell (Abhaya) Admin",
  },
];

export interface SessionPayload {
  username: string;
  role: PortalRole;
  allowedClubSlug: string | null;
  label: string;
  exp: number;
}

export function resolvePortalAccount(
  username: string,
): Omit<AdminAccountConfig, "password"> | null {
  const normalized = username.trim().toLowerCase();
  const match = PORTAL_ACCOUNTS.find((acc) => acc.username === normalized);
  if (!match) return null;
  const { password: _omit, ...safeAccount } = match;
  return safeAccount;
}

export function authenticatePortalCredentials(
  username: string,
  password: string,
  expectedPortal?: PortalRole,
): Omit<AdminAccountConfig, "password"> {
  const normalized = username.trim().toLowerCase();
  const account = PORTAL_ACCOUNTS.find((acc) => acc.username === normalized);
  if (!account || account.password !== password) {
    throw new Error("Invalid username or password. Please verify your credentials.");
  }

  if (expectedPortal === "it-admin" && account.role !== "it-admin") {
    throw new Error("Only IT-Admin credentials can sign in at /it-admin. Use /admin for club coordinator logins.");
  }
  if (expectedPortal === "admin" && account.role !== "admin") {
    throw new Error("IT-Admin credentials must sign in at /it-admin.");
  }

  const { password: _omit, ...safeAccount } = account;
  return safeAccount;
}

function getAdminSessionSecret(): string {
  const g = globalThis as unknown as {
    __env__?: { ADMIN_SESSION_SECRET?: string };
    __cloudflareEnv?: { ADMIN_SESSION_SECRET?: string };
    env?: { ADMIN_SESSION_SECRET?: string };
  };
  const secret =
    (typeof process !== "undefined" && process.env?.["ADMIN_SESSION_SECRET"]) ||
    g.__env__?.ADMIN_SESSION_SECRET ||
    g.__cloudflareEnv?.ADMIN_SESSION_SECRET ||
    g.env?.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "ADMIN_SESSION_SECRET is not configured on the server. Please set it in your deployment environment variables or secrets.",
    );
  }
  return secret;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf-8").toString("base64url");
}

function bufferToBase64Url(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString("base64url");
}

function base64UrlToBuffer(b64url: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(b64url, "base64url");
  const ab = new ArrayBuffer(buf.byteLength);
  const u8 = new Uint8Array(ab);
  u8.set(buf);
  return u8;
}

function base64UrlDecode(b64url: string): string {
  return Buffer.from(b64url, "base64url").toString("utf-8");
}

export async function signSession(
  accountOrUsername:
    | string
    | Pick<SessionPayload, "username" | "role" | "allowedClubSlug" | "label">,
): Promise<string> {
  const secret = getAdminSessionSecret();
  const resolved =
    typeof accountOrUsername === "string"
      ? (resolvePortalAccount(accountOrUsername) ?? {
          username: accountOrUsername,
          role: "it-admin" as const,
          allowedClubSlug: null,
          label: "IT-Admin (Student Council)",
        })
      : accountOrUsername;

  const payload: SessionPayload = {
    username: resolved.username,
    role: resolved.role,
    allowedClubSlug: resolved.allowedClubSlug,
    label: resolved.label,
    exp: Date.now() + SESSION_DURATION_MS,
  };
  const data = base64UrlEncode(JSON.stringify(payload));
  const key = await getHmacKey(secret);
  const encoder = new TextEncoder();
  const sigBuffer = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const sig = bufferToBase64Url(sigBuffer);
  return `${data}.${sig}`;
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  if (!data || !sig) return null;

  try {
    const secret = getAdminSessionSecret();
    const key = await getHmacKey(secret);
    const sigBuffer = base64UrlToBuffer(sig);
    const dataBuffer = new TextEncoder().encode(data);

    // Web Crypto subtle.verify is constant-time (timing-safe)
    const isValid = await globalThis.crypto.subtle.verify("HMAC", key, sigBuffer, dataBuffer);
    if (!isValid) return null;

    const raw = JSON.parse(base64UrlDecode(data)) as Partial<SessionPayload> & {
      username?: string;
      exp?: number;
    };
    if (!raw.username) return null;
    if (raw.exp && Date.now() > raw.exp) return null;

    const resolved = resolvePortalAccount(raw.username);
    const role: PortalRole =
      raw.role === "admin" || raw.role === "it-admin"
        ? raw.role
        : resolved?.role ?? "it-admin";

    return {
      username: raw.username,
      role,
      allowedClubSlug:
        raw.allowedClubSlug !== undefined
          ? raw.allowedClubSlug
          : (resolved?.allowedClubSlug ?? null),
      label: raw.label || resolved?.label || "IT-Admin (Student Council)",
      exp: raw.exp ?? Date.now() + SESSION_DURATION_MS,
    };
  } catch {
    return null;
  }
}

export function getCookieFromHeader(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const eqIdx = part.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).trim();
    if (key === name) {
      const rawVal = part.slice(eqIdx + 1).trim();
      try {
        return decodeURIComponent(rawVal);
      } catch {
        return rawVal;
      }
    }
  }
  return undefined;
}

export async function verifyAdminRequest(request: Request): Promise<SessionPayload | null> {
  const token = getCookieFromHeader(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  return verifySession(token);
}
