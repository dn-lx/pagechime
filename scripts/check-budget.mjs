import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
function files(p) {
  return readdirSync(p, { withFileTypes: true }).flatMap((x) =>
    x.isDirectory() ? files(join(p, x.name)) : [join(p, x.name)],
  );
}
const out = "apps/web/out",
  all = files(out),
  shell = all.filter(
    (p) => !p.includes("/books/") && /\.(js|css|woff2)$/.test(p),
  ),
  bytes = shell.reduce((s, p) => s + gzipSync(readFileSync(p)).length, 0),
  limit = 900 * 1024;
console.log(
  `Compressed JS/CSS/fonts: ${Math.round(bytes / 1024)} KiB / ${limit / 1024} KiB`,
);
if (bytes > limit) process.exitCode = 1;
for (const p of all)
  if (statSync(p).size > 25 * 1024 * 1024) {
    console.error("Static-host per-file limit exceeded:", p);
    process.exitCode = 1;
  }
