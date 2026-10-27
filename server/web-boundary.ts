export const READER_API =
  "https://wbqnctrvxohxwiaignhg.supabase.co/functions/v1/book-reader-api";
export const COOKIE = "__Host-reader_session";
export function cookieToken(request: Request) {
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export const privateHeaders = {
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "no-store",
  "Netlify-CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function proxyReader(
  request: Request,
  ip: string,
  send: typeof fetch = fetch,
) {
  const url = new URL(request.url),
    route = url.pathname
      .replace(/^\/api\/reader/, "")
      .replace(/^\/\.netlify\/functions\/reader/, "");
  if (
    !/^\/(?:me|login|register|activate|logout|state|admin\/(?:accounts(?:\/[a-f0-9-]{36})?|invites))$/.test(
      route,
    )
  )
    return new Response("Not found", { status: 404, headers: privateHeaders });
  if (!["GET", "POST", "PUT", "PATCH"].includes(request.method))
    return new Response(null, { status: 405, headers: privateHeaders });
  if (request.method !== "GET" && request.headers.get("origin") !== url.origin)
    return new Response("Please use the reader website.", {
      status: 403,
      headers: privateHeaders,
    });
  let body: string | undefined;
  if (request.method !== "GET") {
    body = await request.text();
    if (body.length > 24000)
      return new Response("Request too large", {
        status: 413,
        headers: privateHeaders,
      });
  }
  try {
    const session = cookieToken(request),
      headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
      };
    const account = request.headers.get("x-reader-account");
    if (account) headers["X-Reader-Account"] = account;
    if (session) headers.Authorization = `Bearer ${session}`;
    const response = await send(READER_API + route, {
      method: request.method,
      headers,
      body,
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    const out = new Headers({
      ...privateHeaders,
      "Content-Type": "application/json",
    });
    if (
      response.ok &&
      (route === "/login" || route === "/activate" || route === "/register")
    ) {
      if (!/^[a-f0-9]{64}$/.test(data.token))
        throw new Error("Invalid session");
      out.set(
        "Set-Cookie",
        `${COOKIE}=${data.token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`,
      );
      delete data.token;
    }
    // Logout revokes the opaque token on the server. Do not send a clearing
    // cookie from a delayed response: another tab may already have signed in.
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: out,
    });
  } catch {
    return new Response(
      JSON.stringify({
        error: "The reader service is temporarily unavailable.",
      }),
      {
        status: 503,
        headers: { ...privateHeaders, "Content-Type": "application/json" },
      },
    );
  }
}
export async function authorizeMedia(
  request: Request,
  send: typeof fetch = fetch,
  guestPaths: readonly string[] = [],
) {
  if (
    ["GET", "HEAD"].includes(request.method) &&
    guestPaths.includes(new URL(request.url).pathname)
  )
    return true;
  const session = cookieToken(request);
  if (!session) return false;
  try {
    return (
      await send(READER_API + "/me", {
        headers: { Authorization: `Bearer ${session}` },
        signal: AbortSignal.timeout(10000),
      })
    ).ok;
  } catch {
    return false;
  }
}
