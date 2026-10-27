import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
const root = dirname(dirname(fileURLToPath(import.meta.url))),
  out = join(root, "apps/web/out");
function files(p, prefix = "") {
  return readdirSync(p, { withFileTypes: true }).flatMap((x) =>
    x.isDirectory()
      ? files(join(p, x.name), prefix + "/" + x.name)
      : [prefix + "/" + x.name],
  );
}
const all = files(out).filter(
  (p) =>
    !p.startsWith("/books/") &&
    !p.endsWith(".map") &&
    !p.endsWith(".txt") &&
    !p.endsWith(".json") &&
    !p.endsWith(".html") &&
    p != "/sw.js",
);
const version = createHash("sha256")
  .update(all.join("|") + readFileSync(join(out, "index.html")))
  .digest("hex")
  .slice(0, 12);
writeFileSync(
  join(out, "sw.js"),
  readFileSync(join(root, "scripts/service-worker.js"), "utf8")
    .replace("__VERSION__", version)
    .replace("__SHELL__", JSON.stringify(["/", "/index.html", ...all])),
);
writeFileSync(
  join(out, "version.json"),
  JSON.stringify({
    version: "0.1.0",
    revision: process.env.APP_REVISION || "development",
  }),
);
