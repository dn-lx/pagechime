import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { isMainModule } from "../scripts/lib/entrypoint.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "aps-entry-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
async function alias(t, target, link) {
  try {
    await symlink(target, link, "file");
    return true;
  } catch (error) {
    if (error.code === "EPERM") {
      t.skip("OS denies test symlink creation");
      return false;
    }
    throw error;
  }
}

test("entrypoint recognizes absolute and relative file identities", async (t) => {
  const dir = await fixture(t),
    file = join(dir, "entry space.mjs");
  await writeFile(file, "// fixture");
  const url = pathToFileURL(file).href;
  assert.equal(isMainModule(url, file), true);
  assert.equal(isMainModule(url, relative(process.cwd(), file)), true);
  assert.equal(isMainModule(url, resolve(file)), true);
});
test("entrypoint does not equate different files, directories or absent paths", async (t) => {
  const dir = await fixture(t),
    file = join(dir, "one.mjs"),
    other = join(dir, "two.mjs");
  await writeFile(file, "// same text");
  await writeFile(other, "// same text");
  const url = pathToFileURL(file).href;
  for (const candidate of [other, dir, join(dir, "missing.mjs"), "", null])
    assert.equal(isMainModule(url, candidate), false);
  assert.equal(isMainModule("https://example.invalid/entry.mjs", file), false);
});
test("entrypoint resolves symlink aliases rather than silently skipping execution", async (t) => {
  const dir = await fixture(t),
    file = join(dir, "entry.mjs"),
    link = join(dir, "alias space.mjs");
  await writeFile(file, "// fixture");
  if (!(await alias(t, file, link))) return;
  assert.equal(isMainModule(pathToFileURL(file).href, link), true);
});

const entrypoints = [
  { name: "verify.mjs", args: ["--help"], output: /node scripts\/verify\.mjs/ },
  {
    name: "agent-evals.mjs",
    args: ["--help"],
    output: /node scripts\/agent-evals\.mjs/,
  },
  {
    name: "sync-partner-commands.mjs",
    args: [],
    output: /Gemini project commands valid: 6/,
  },
];
for (const entry of entrypoints) {
  const file = join(root, "scripts", entry.name);
  test(`${entry.name}: relative CLI invocation executes the real entry point`, () => {
    const result = spawnSync(
      process.execPath,
      [join("scripts", entry.name), ...entry.args],
      { cwd: root, encoding: "utf8", timeout: 10000 },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, entry.output);
  });
  test(`${entry.name}: symlinked CLI invocation does not silently succeed without work`, async (t) => {
    const dir = await fixture(t),
      link = join(dir, `alias ${entry.name}`);
    if (!(await alias(t, file, link))) return;
    const result = spawnSync(process.execPath, [link, ...entry.args], {
      cwd: root,
      encoding: "utf8",
      timeout: 10000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, entry.output);
  });
  test(`${entry.name}: importing the module does not execute its CLI`, () => {
    const code = `await import(${JSON.stringify(pathToFileURL(file).href)}); console.log('IMPORTED_ONLY')`;
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", code],
      { cwd: root, encoding: "utf8", timeout: 10000 },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "IMPORTED_ONLY");
  });
}
