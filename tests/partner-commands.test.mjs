import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  commands,
  renderCommand,
  sync,
} from "../scripts/sync-partner-commands.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "aps-commands-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const command of commands) {
    const dir = join(root, ".agents/skills", command.skill);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "SKILL.md"), "Canonical fixture");
  }
  return root;
}
test("committed Gemini shortcuts exactly match their generator", async () => {
  assert.equal(await sync(process.cwd()), 6);
});
test("commands reference canonical procedures without shell injection or permission grants", () => {
  for (const command of commands) {
    const content = renderCommand(command);
    assert.ok(content.includes(`.agents/skills/${command.skill}/SKILL.md`));
    assert.ok(content.includes("AGENTS.md"));
    assert.ok(
      !/!\{|@\{|allowed-tools|permissionMode|bypassPermissions|--yolo/.test(
        content,
      ),
    );
    assert.match(content, /^description = ".+"$/m);
    assert.match(content, /^prompt = """$/m);
  }
});
test("preview refuses missing adapters without writing", async (t) => {
  const root = await fixture(t);
  await assert.rejects(sync(root), /Missing\/stale/);
  await assert.rejects(
    readFile(join(root, ".gemini/commands/aps/verify.toml")),
  );
});
test("explicit generation is repeatable and idempotent", async (t) => {
  const root = await fixture(t);
  assert.equal(await sync(root, true), 6);
  assert.equal(await sync(root), 6);
  assert.equal(await sync(root, true), 6);
});
test("stale generated commands are detected and can be regenerated", async (t) => {
  const root = await fixture(t);
  await sync(root, true);
  const path = join(root, ".gemini/commands/aps/verify.toml");
  await writeFile(path, (await readFile(path, "utf8")) + "# stale\n");
  await assert.rejects(sync(root), /Missing\/stale/);
  await sync(root, true);
  assert.equal(await sync(root), 6);
});
test("custom command is never silently overwritten", async (t) => {
  const root = await fixture(t);
  await sync(root, true);
  const path = join(root, ".gemini/commands/aps/verify.toml");
  await writeFile(path, "# my custom command\n");
  await assert.rejects(sync(root, true), /custom/);
  assert.equal(await readFile(path, "utf8"), "# my custom command\n");
});
test("obsolete/unmapped commands require explicit review", async (t) => {
  const root = await fixture(t);
  await sync(root, true);
  await writeFile(join(root, ".gemini/commands/aps/obsolete.toml"), "old");
  await assert.rejects(sync(root, true), /Unmapped/);
});
test("generation refuses a symlinked parent", async (t) => {
  const root = await fixture(t),
    outside = await fixture(t);
  try {
    await symlink(
      outside,
      join(root, ".gemini"),
      process.platform === "win32" ? "junction" : "dir",
    );
  } catch (error) {
    if (error.code === "EPERM") {
      t.skip("OS denies test symlink creation");
      return;
    }
    throw error;
  }
  await assert.rejects(sync(root, true), /non-regular/);
});
test("missing canonical skill prevents generation", async (t) => {
  const root = await fixture(t);
  await rm(join(root, ".agents/skills/verification-loop/SKILL.md"));
  await assert.rejects(sync(root, true));
});
