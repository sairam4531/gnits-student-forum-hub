import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

const campusVideoMiddleware = createMiddleware().server(async ({ request, pathname, next }) => {
  if (pathname === "/api/campus-video") {
    const { handleCampusVideoRequest } = await import("./lib/video-stream.server");
    return handleCampusVideoRequest(request);
  }
  if (pathname === "/api/event-file") {
    const { handleEventFileRequest } = await import("./lib/event-file.server");
    return handleEventFileRequest(request);
  }
  return next();
});

const noCacheMiddleware = createMiddleware().server(async ({ pathname, next }) => {
  const result = await next();
  if (
    pathname !== "/api/campus-video" &&
    !pathname.startsWith("/assets/") &&
    result?.response instanceof Response
  ) {
    const headers = new Headers(result.response.headers);
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    headers.set("CDN-Cache-Control", "no-store");
    headers.set("Vercel-CDN-Cache-Control", "no-store");
    headers.set("Pragma", "no-cache");
    return {
      ...result,
      response: new Response(result.response.body, {
        status: result.response.status,
        statusText: result.response.statusText,
        headers,
      }),
    };
  }
  return result;
});

// requestMiddleware runs on every request; functionMiddleware only on server functions, where
// client sendContext is unvalidated input. Append to these arrays, never replace them.
// Enabling Lovable Cloud adds functionMiddleware: [attachSupabaseAuth], the bearer token that
// requireSupabaseAuth server functions need. Add it by hand only if Lovable Cloud or a
// user-managed Supabase project is connected, no middleware here sets Authorization, and the
// project did not intentionally replace it.
export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, noCacheMiddleware, campusVideoMiddleware, csrfMiddleware],
}));
