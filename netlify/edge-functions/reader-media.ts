import guestPaths from "../../.generated/guest-media.json" with { type: "json" };
import { authorizeMedia, privateHeaders } from "../../server/web-boundary.ts";
export default async (
  request: Request,
  context: { next: () => Promise<Response> },
) => {
  const shared =
    /^\/books\/(shared-[a-f0-9-]{36})\/(asset-\d{3}\.(?:pdf|mp3|m4a|wav|ogg|png|jpe?g|webp))$/.exec(
      new URL(request.url).pathname,
    );
  if (shared && ["GET", "HEAD"].includes(request.method))
    return new Response(null, {
      status: 302,
      headers: {
        ...privateHeaders,
        Location: `/api/library/media/${shared[1]}/${shared[2]}`,
      },
    });
  if (!(await authorizeMedia(request, fetch, guestPaths)))
    return new Response("Please sign in to read this book.", {
      status: 401,
      headers: privateHeaders,
    });
  const response = await context.next();
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(privateHeaders))
    headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
};
export const config = { path: ["/books/*", "/library.json"], onError: "fail" };
