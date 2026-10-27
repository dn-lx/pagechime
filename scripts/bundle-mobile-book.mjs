import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
  existsSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(dirname(fileURLToPath(import.meta.url))),
  source = join(root, "apps/web/public/books/manifest"),
  dest = join(root, "apps/mobile/assets/books/manifest");
if (!existsSync(join(source, "book.json")))
  throw Error("Prepare the private book assets first.");
function copy(a, b) {
  mkdirSync(b, { recursive: true });
  for (const x of readdirSync(a, { withFileTypes: true }))
    x.isDirectory()
      ? copy(join(a, x.name), join(b, x.name))
      : copyFileSync(join(a, x.name), join(b, x.name));
}
copy(source, dest);
const b = JSON.parse(readFileSync(join(source, "book.json")));
writeFileSync(
  join(root, "apps/mobile/assets/catalog.generated.ts"),
  `import type {Book} from '@pagechime/core';\nexport const catalog:{book:Book;audio:number[];pdf:number;cover:number}[]=[{book:require('./books/manifest/book.json'),audio:[${b.chapters.map((c) => `require('./books/manifest/audio/${c.file}')`).join(",")}],pdf:require('./books/manifest/book.pdf'),cover:require('./books/manifest/cover.webp')}];\n`,
);
console.log(
  "Bundled private mobile book inputs:",
  b.chapters.length,
  "chapters",
);
