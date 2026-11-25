// Server-side Supabase client with service role key - bypasses RLS.
// Use this for admin operations in server functions and server routes only.
// For user-authenticated queries (with RLS), use the auth middleware instead.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export interface SupabaseServerConfig {
  url: string | undefined;
  publishableKey: string | undefined;
  serviceRoleKey: string | undefined;
  projectId: string | undefined;
}

export function getSupabaseServerConfig(): SupabaseServerConfig {
  const g = globalThis as unknown as {
    __env__?: Record<string, string | undefined>;
    __cloudflareEnv?: Record<string, string | undefined>;
    env?: Record<string, string | undefined>;
  };

  const url =
    g.__env__?.['SUPABASE_URL'] ||
    g.__env__?.['VITE_SUPABASE_URL'] ||
    g.__cloudflareEnv?.['SUPABASE_URL'] ||
    g.env?.['SUPABASE_URL'] ||
    (typeof process !== 'undefined'
      ? (process.env['SUPABASE_URL'] || process.env['VITE_SUPABASE_URL'])
      : undefined);

  const publishableKey =
    g.__env__?.['SUPABASE_PUBLISHABLE_KEY'] ||
    g.__env__?.['VITE_SUPABASE_PUBLISHABLE_KEY'] ||
    g.__cloudflareEnv?.['SUPABASE_PUBLISHABLE_KEY'] ||
    g.env?.['SUPABASE_PUBLISHABLE_KEY'] ||
    (typeof process !== 'undefined'
      ? (process.env['SUPABASE_PUBLISHABLE_KEY'] || process.env['VITE_SUPABASE_PUBLISHABLE_KEY'])
      : undefined);

  const serviceRoleKey =
    g.__env__?.['SUPABASE_SERVICE_ROLE_KEY'] ||
    g.__cloudflareEnv?.['SUPABASE_SERVICE_ROLE_KEY'] ||
    g.env?.['SUPABASE_SERVICE_ROLE_KEY'] ||
    (typeof process !== 'undefined' ? process.env['SUPABASE_SERVICE_ROLE_KEY'] : undefined);

  const projectId =
    g.__env__?.['SUPABASE_PROJECT_ID'] ||
    g.__env__?.['VITE_SUPABASE_PROJECT_ID'] ||
    g.__cloudflareEnv?.['SUPABASE_PROJECT_ID'] ||
    g.env?.['SUPABASE_PROJECT_ID'] ||
    (typeof process !== 'undefined'
      ? (process.env['SUPABASE_PROJECT_ID'] || process.env['VITE_SUPABASE_PROJECT_ID'])
      : undefined);

  return { url, publishableKey, serviceRoleKey, projectId };
}

export function validateServiceRoleKey(
  key: string | undefined,
  publishableKey?: string,
): { valid: boolean; reason?: string } {
  if (!key) {
    return {
      valid: false,
      reason: "SUPABASE_SERVICE_ROLE_KEY is not configured in the server environment.",
    };
  }
  if (publishableKey && key === publishableKey) {
    return {
      valid: false,
      reason: "SUPABASE_SERVICE_ROLE_KEY contains the public publishable key instead of the service role secret.",
    };
  }
  if (key.startsWith("sb_publishable_")) {
    return {
      valid: false,
      reason: "SUPABASE_SERVICE_ROLE_KEY starts with 'sb_publishable_' which is a public client key, not a service role secret.",
    };
  }
  if (key.startsWith("eyJ")) {
    try {
      const parts = key.split(".");
      if (parts.length >= 2 && parts[1]) {
        const payloadStr = Buffer.from(parts[1], "base64url").toString("utf-8");
        const payload = JSON.parse(payloadStr) as { role?: string; ref?: string };
        if (payload.role === "anon") {
          return {
            valid: false,
            reason: "SUPABASE_SERVICE_ROLE_KEY contains a JWT with 'anon' role instead of 'service_role'.",
          };
        }
      }
    } catch {
      // ignore parsing errors
    }
  }
  return { valid: true };
}

export function getSupabaseAdminConfigErrorMessage(): string | null {
  const { url, publishableKey, serviceRoleKey } = getSupabaseServerConfig();

  if (!url || !serviceRoleKey) {
    const missing = [
      ...(!url ? ['SUPABASE_URL'] : []),
      ...(!serviceRoleKey ? ['SUPABASE_SERVICE_ROLE_KEY'] : []),
    ];
    return `Missing Supabase server configuration: ${missing.join(', ')}. Please configure SUPABASE_SERVICE_ROLE_KEY in your Cloudflare Worker Secrets or deployment environment variables (e.g. Vercel).`;
  }

  const validation = validateServiceRoleKey(serviceRoleKey, publishableKey);
  if (!validation.valid) {
    return `Configuration error: ${validation.reason} Please configure the genuine SUPABASE_SERVICE_ROLE_KEY as a Cloudflare Worker Secret or deployment environment variable (e.g. Vercel).`;
  }

  return null;
}

export function hasSupabaseAdminConfig(): boolean {
  return getSupabaseAdminConfigErrorMessage() === null;
}

function createSupabaseAdminClient(): SupabaseClient<Database> {
  const { url, publishableKey, serviceRoleKey, projectId } = getSupabaseServerConfig();

  const configError = getSupabaseAdminConfigErrorMessage();
  if (configError || !url || !serviceRoleKey) {
    const message = configError || 'Missing Supabase server configuration.';
    console.error(`[Supabase Admin] ${message}`);
    throw new Error(message);
  }

  // Validate again explicitly to keep TypeScript narrowing crisp
  const validation = validateServiceRoleKey(serviceRoleKey, publishableKey);
  if (!validation.valid) {
    const message = `Configuration error: ${validation.reason} Please configure the genuine SUPABASE_SERVICE_ROLE_KEY as a Cloudflare Worker Secret or deployment environment variable (e.g. Vercel).`;
    console.error(`[Supabase Admin] ${message}`);
    throw new Error(message);
  }

  // Verify JWT project ref if available (without exposing the key)
  if (serviceRoleKey.startsWith("eyJ") && projectId) {
    try {
      const parts = serviceRoleKey.split(".");
      if (parts.length >= 2 && parts[1]) {
        const payloadStr = Buffer.from(parts[1], "base64url").toString("utf-8");
        const payload = JSON.parse(payloadStr) as { ref?: string };
        if (payload.ref && payload.ref !== projectId) {
          console.warn(
            "[Supabase Admin] Warning: Service role key project ref does not match configured project ID.",
          );
        }
      }
    } catch {
      // ignore
    }
  }

  return createClient<Database>(url, serviceRoleKey, {
    global: {
      fetch: createSupabaseFetch(serviceRoleKey),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _cachedClient: SupabaseClient<Database> | undefined;
let _cachedKey: string | undefined;
let _cachedUrl: string | undefined;

export function getSupabaseAdminClient(): SupabaseClient<Database> {
  const { url, serviceRoleKey } = getSupabaseServerConfig();
  if (_cachedClient && _cachedKey === serviceRoleKey && _cachedUrl === url) {
    return _cachedClient;
  }
  _cachedClient = createSupabaseAdminClient();
  _cachedKey = serviceRoleKey;
  _cachedUrl = url;
  return _cachedClient;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop, receiver) {
    const client = getSupabaseAdminClient();
    return Reflect.get(client, prop, receiver);
  },
});
