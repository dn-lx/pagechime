// Public negative contract checks; never need credentials or read private rows.
const base = process.env.READER_API_URL;
if (
  !base ||
  !/^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/book-reader-api$/.test(
    base,
  )
)
  throw Error("Set the reader API URL explicitly.");
for (const [path, method, body, status] of [
  ["/me", "GET", undefined, 401],
  ["/state", "GET", undefined, 401],
  ["/login", "POST", null, 400],
  [
    "/login",
    "POST",
    {
      username: "probe_" + crypto.randomUUID().replaceAll("-", "").slice(0, 20),
      password: "A verification password only.",
    },
    401,
  ],
]) {
  const r = await fetch(base + path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (r.status !== status)
    throw Error(`${method} ${path}: expected ${status}, got ${r.status}`);
  const json = await r.json();
  if (typeof json.error !== "string" || "token" in json)
    throw Error("Unsafe error contract");
  console.log(`${method} ${path}: ${status} (expected)`);
}
