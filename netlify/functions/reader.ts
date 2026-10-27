import { proxyReader } from "../../server/web-boundary";
export default (request: Request, context: { ip: string }) =>
  proxyReader(request, context.ip);
export const config = { path: "/api/reader/*" };
