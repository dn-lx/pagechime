import { proxySharedLibrary } from "../../server/shared-library-boundary";
declare const Netlify: { env: { get(name: string): string | undefined } };
export default (request: Request) =>
  proxySharedLibrary(request, Netlify.env.get("PAGECHIME_LIBRARY_KEY"));
export const config = { path: "/api/library/*" };
