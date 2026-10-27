import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
const tests = readdirSync("tests")
  .filter((x) => x.endsWith(".test.mjs"))
  .map((x) => "tests/" + x);
const r = spawnSync(process.execPath, ["--test", ...tests], {
  stdio: "inherit",
});
process.exit(r.status ?? 1);
