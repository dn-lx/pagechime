import guestPaths from "../../.generated/guest-media.json" with { type: "json" };
import { authorizeMedia, privateHeaders } from "../../server/web-boundary.ts";
export default async (
  request: Request,
  context: { next: () => Promise<Response> },
) => {
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
