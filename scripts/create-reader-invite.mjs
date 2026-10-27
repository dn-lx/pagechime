import { randomBytes, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
const [origin, output, role = "admin"] = process.argv.slice(2);
if (!origin || !output || !["admin", "reader"].includes(role))
  throw Error(
    "Usage: node scripts/create-reader-invite.mjs https://your-reader.netlify.app /private/invite.json [admin|reader]",
  );
const url = new URL(origin);
if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash)
  throw Error("Use the HTTPS website origin.");
const token = randomBytes(32).toString("hex"),
  hash = createHash("sha256").update(token).digest("hex");
const sql = `insert into public.book_reader_invites(token_hash,role,expires_at) values('${hash}','${role}',now()+interval '48 hours');`;
writeFileSync(
  output,
  JSON.stringify(
    { sql, activationUrl: `${url.origin}/#invite=${token}` },
    null,
    2,
  ) + "\n",
  { mode: 0o600, flag: "wx" },
);
console.log(
  "Private invitation written to " +
    output +
    ". Apply its SQL in Me+ before opening its activation URL.",
);
