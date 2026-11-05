import { cookieToken, privateHeaders } from "./web-boundary.ts";
export const SHARED_API =
  "https://wbqnctrvxohxwiaignhg.supabase.co/functions/v1/pagechime-shared-library";
export async function proxySharedLibrary(
  request: Request,
  key: string | undefined,
  send: typeof fetch = fetch,
) {
  const url = new URL(request.url),
    route = url.pathname.replace(/^\/api\/library/, "");
  if (
    !/^\/(?:catalog|media\/shared-[a-f0-9-]{36}\/asset-\d{3}\.(?:pdf|mp3|m4a|wav|ogg|png|jpe?g|webp)|admin\/(?:prepare|drafts)|admin\/shared-[a-f0-9-]{36}\/(?:publish|verify\/asset-\d{3}\.[a-z0-9]+))$/.test(
      route,
    )
  )
    return new Response("Not found", { status: 404, headers: privateHeaders });
  if (!["GET", "HEAD", "POST"].includes(request.method))
    return new Response(null, { status: 405, headers: privateHeaders });
  if (request.method === "POST" && request.headers.get("origin") !== url.origin)
    return new Response("Please use the reader website.", {
      status: 403,
      headers: privateHeaders,
    });
  if (!key || !/^[a-f0-9]{64}$/.test(key))
    return Response.json(
      { error: "The shared library connection is unavailable." },
      { status: 503, headers: privateHeaders },
    );
  const headers: Record<string, string> = {
    "X-Pagechime-Library-Key": key,
    "Content-Type": "application/json",
  };
  const token = cookieToken(request);
  if (token) headers.Authorization = `Bearer ${token}`;
  // Stream/count request bytes before buffering. File data goes directly to signed storage URLs.
  let body: Uint8Array | undefined;
  if (request.method === "POST") {
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = request.body?.getReader();
    if (reader)
      for (;;) {
        const r = await reader.read();
        if (r.done) break;
        size += r.value.length;
        if (size > 100000) {
          await reader.cancel();
          return new Response("Book details are too large", {
            status: 413,
            headers: privateHeaders,
          });
        }
        chunks.push(r.value);
      }
    body = new Uint8Array(size);
    let n = 0;
    for (const c of chunks) {
      body.set(c, n);
      n += c.length;
    }
  }
  try {
    const response = await send(
      SHARED_API + route + (route === "/catalog" ? url.search : ""),
      {
        method: request.method,
        headers,
        body: body as BodyInit | undefined,
        redirect: "manual",
        signal: AbortSignal.timeout(55000),
      },
    );
    const out = new Headers({
      ...privateHeaders,
      "Content-Type": "application/json",
    });
    if (response.status === 302) {
      const dest = new URL(response.headers.get("location") || "");
      if (
        ![new URL(SHARED_API).origin, url.origin].includes(dest.origin) ||
        !dest.pathname.startsWith(
          "/storage/v1/object/sign/pagechime-shared-books-develop/",
        )
      )
        throw Error("Invalid media redirect.");
      out.set("Location", dest.href);
    }
    return new Response(request.method === "HEAD" ? null : response.body, {
      status: response.status,
      headers: out,
    });
  } catch {
    return Response.json(
      { error: "The shared library is unavailable. Please retry." },
      { status: 503, headers: privateHeaders },
    );
  }
}
