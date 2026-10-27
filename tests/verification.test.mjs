import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  writeFile,
  readFile,
  rm,
  mkdir,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  validateConfig,
  verify,
  snapshot,
  sameDirectory,
} from "../scripts/verify.mjs";
import {
  readDocument,
  writeArtifact,
  options,
} from "../scripts/lib/evidence.mjs";

const config = (
  command = ["node", "-e", 'process.stdout.write("ok")'],
  extra = {},
) => ({
  schema_version: 1,
  checks: [
    {
      id: "test",
      phase: "tests",
      description: "Synthetic fixture, not an agent evaluation",
      command,
      timeout_ms: 5000,
      ...extra,
    },
  ],
  profiles: {
    starter: {
      scope: "synthetic fixture",
      checks: ["test"],
      manual_evidence: [],
    },
  },
});
async function fixture(t, git = true) {
  const root = await mkdtemp(join(tmpdir(), "aps-verify-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, ".gitignore"), ".agent-artifacts/\n");
  if (git) {
    const commands = [
      ["init", "-q"],
      ["config", "user.name", "Fixture"],
      ["config", "user.email", "fixture@example.invalid"],
      ["add", "."],
      ["commit", "-qm", "fixture"],
    ];
    for (const args of commands)
      assert.equal(spawnSync("git", ["-C", root, ...args]).status, 0);
  }
  return root;
}

test("plan does not execute the configured command or require git", async (t) => {
  const root = await fixture(t, false);
  const result = await verify(
    root,
    config(["node", "-e", 'require("fs").writeFileSync("UNEXPECTED", "bad")']),
  );
  assert.equal(result.status, "PLAN");
  assert.equal(result.repository, null);
  await assert.rejects(readFile(join(root, "UNEXPECTED")));
});
test("a clean committed candidate passes only the declared scope", async (t) => {
  const result = await verify(await fixture(t), config(), "starter", true);
  assert.equal(result.status, "PASS");
  assert.equal(result.release_authorized, false);
  assert.match(result.repository.before.sha, /^[a-f0-9]{40}$/);
  assert.equal(result.repository.before.sha, result.repository.after.sha);
});
test("nonzero command exit cannot be hidden by optimistic output", async (t) => {
  const result = await verify(
    await fixture(t),
    config(["node", "-e", 'console.log("ALL PASS");process.exit(7)']),
    "starter",
    true,
  );
  assert.equal(result.status, "FAIL");
  assert.equal(result.checks[0].exit_code, 7);
});
test("missing executable fails", async (t) => {
  const result = await verify(
    await fixture(t),
    config(["aps-nonexistent-executable"]),
    "starter",
    true,
  );
  assert.equal(result.status, "FAIL");
  assert.equal(result.checks[0].status, "ERROR");
});
test("timeout is a failure and returns promptly", async (t) => {
  const start = Date.now();
  const result = await verify(
    await fixture(t),
    config(["node", "-e", "setInterval(()=>{},1000)"], { timeout_ms: 100 }),
    "starter",
    true,
  );
  assert.equal(result.checks[0].status, "TIMEOUT");
  assert.equal(result.status, "FAIL");
  assert.ok(Date.now() - start < 10000);
});
test("excessive output fails without storing the output", async (t) => {
  const result = await verify(
    await fixture(t),
    config(["node", "-e", 'process.stdout.write("x".repeat(2000000))']),
    "starter",
    true,
  );
  assert.equal(result.checks[0].status, "OUTPUT_LIMIT");
  assert.ok(JSON.stringify(result).length < 10000);
});
test("reports contain hashes, not command stdout/stderr secrets", async (t) => {
  const result = await verify(
    await fixture(t),
    config(["node", "-e", 'console.error("PRIVATE-SENTINEL")']),
    "starter",
    true,
  );
  assert.ok(!JSON.stringify(result).includes("PRIVATE-SENTINEL"));
  assert.ok(result.checks[0].output.stderr_bytes > 0);
});
test("shell metacharacters remain literal argv", async (t) => {
  const result = await verify(
    await fixture(t),
    config([
      "node",
      "-e",
      'if(process.argv[1]!=="$(echo injected); exit 9")process.exit(8)',
      "$(echo injected); exit 9",
    ]),
    "starter",
    true,
  );
  assert.equal(result.checks[0].status, "PASS");
});
test("unconfigured check is incomplete, not passing", async (t) => {
  const result = await verify(await fixture(t), config(null), "starter", true);
  assert.equal(result.status, "INCOMPLETE");
  assert.equal(result.checks[0].status, "UNCONFIGURED");
});
test("manual/runtime evidence stays unverified even when commands pass", async (t) => {
  const c = config();
  c.profiles.starter.manual_evidence = ["Check the actual deployed revision"];
  const result = await verify(await fixture(t), c, "starter", true);
  assert.equal(result.status, "INCOMPLETE");
  assert.equal(result.manual_evidence[0].status, "NOT_VERIFIED");
});
test("dirty candidate cannot be mistaken for tested HEAD", async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, "uncommitted.txt"), "change");
  const result = await verify(root, config(), "starter", true);
  assert.equal(result.status, "INCOMPLETE");
  assert.equal(result.repository.before.dirty, true);
});
test("mutation during checks invalidates candidate evidence", async (t) => {
  const result = await verify(
    await fixture(t),
    config([
      "node",
      "-e",
      'require("fs").writeFileSync("modified.txt","changed")',
    ]),
    "starter",
    true,
  );
  assert.equal(result.status, "INCOMPLETE");
  assert.ok(result.issues.some((issue) => issue.includes("changed during")));
});
test("revision change during checks is detected", async (t) => {
  const command = [
    "node",
    "-e",
    'const c=require("child_process");c.execFileSync("git",["commit","--allow-empty","-qm","new revision"])',
  ];
  const result = await verify(
    await fixture(t),
    config(command),
    "starter",
    true,
  );
  assert.equal(result.status, "INCOMPLETE");
  assert.notEqual(result.repository.before.sha, result.repository.after.sha);
});
test("missing Git evidence prevents configured command execution", async (t) => {
  const root = await fixture(t, false);
  const result = await verify(
    root,
    config(["node", "-e", 'require("fs").writeFileSync("UNEXPECTED","bad")']),
    "starter",
    true,
  );
  assert.equal(result.status, "INCOMPLETE");
  assert.equal(result.checks[0].status, "NOT_RUN");
  await assert.rejects(readFile(join(root, "UNEXPECTED")));
});
test("invalid and misleading configuration fails closed", () => {
  for (const change of [
    (c) => (c.schema_version = 2),
    (c) => (c.checks = []),
    (c) => (c.checks[0].command = "echo pass | tail -1"),
    (c) => (c.checks[0].timeout_ms = -1),
    (c) => c.checks.push(c.checks[0]),
    (c) => (c.profiles.starter.checks = ["missing"]),
    (c) => (c.profiles.starter.checks = []),
    (c) => c.profiles.starter.checks.push("test"),
    (c) => (c.profiles.starter.bypass = true),
  ]) {
    const c = config();
    change(c);
    assert.throws(() => validateConfig(c));
  }
});
test("strict CLI options reject repeats, unknown options and missing values", () => {
  for (const args of [
    ["--run", "--run"],
    ["--unknown"],
    ["--config"],
    ["--config", "--run"],
  ])
    assert.throws(() => options(args, ["--config"], ["--run"]));
});
test("input reads reject escape, malformed JSON and oversize files", async (t) => {
  const root = await fixture(t, false);
  await writeFile(join(root, "bad.json"), "{");
  await assert.rejects(readDocument(root, "bad.json"));
  await writeFile(join(root, "large.json"), " ".repeat(100));
  await assert.rejects(readDocument(root, "large.json", 50));
  await assert.rejects(readDocument(root, "../outside.json"));
});
test("artifact writes are exclusive, private and cannot escape their directory", async (t) => {
  const root = await fixture(t, false);
  await writeArtifact(root, "test.json", { status: "INCOMPLETE" });
  assert.equal(
    JSON.parse(await readFile(join(root, ".agent-artifacts/test.json"))).status,
    "INCOMPLETE",
  );
  await assert.rejects(writeArtifact(root, "test.json", {}));
  await assert.rejects(writeArtifact(root, "../escape.json", {}));
});
test("symlink artifact directory is rejected", async (t) => {
  const root = await fixture(t, false),
    outside = await fixture(t, false);
  try {
    await symlink(
      outside,
      join(root, ".agent-artifacts"),
      process.platform === "win32" ? "junction" : "dir",
    );
  } catch (error) {
    if (error.code === "EPERM") {
      t.skip("OS denies test symlink creation");
      return;
    }
    throw error;
  }
  await assert.rejects(writeArtifact(root, "bad.json", {}), /symlink/);
});
test("CLI incomplete report exits 2 rather than green", async (t) => {
  const root = await fixture(t);
  await mkdir(join(root, ".agents"));
  await writeFile(
    join(root, ".agents/verification.json"),
    JSON.stringify(config(null)),
  );
  spawnSync("git", ["-C", root, "add", "."]);
  spawnSync("git", ["-C", root, "commit", "-qm", "config"]);
  const script = new URL("../scripts/verify.mjs", import.meta.url);
  const result = spawnSync(process.execPath, [fileURLToPath(script), "--run"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 2, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, "INCOMPLETE");
});

test("repository identity accepts aliases but rejects a nested working directory", async (t) => {
  const root = await fixture(t),
    nested = join(root, "nested");
  await mkdir(nested);
  assert.equal(sameDirectory(root, join(root, "nested", "..")), true);
  assert.equal(sameDirectory(root, nested), false);
  assert.match(snapshot(root).sha, /^[a-f0-9]{40}$/);
  assert.equal(snapshot(nested).sha, null);
  const result = await verify(
    nested,
    config(["node", "-e", 'require("fs").writeFileSync("UNEXPECTED","bad")']),
    "starter",
    true,
  );
  assert.equal(result.status, "INCOMPLETE");
  await assert.rejects(readFile(join(nested, "UNEXPECTED")));
});

test("malformed JSON diagnostics do not disclose input content", async (t) => {
  const root = await fixture(t, false);
  await writeFile(
    join(root, "private.json"),
    '{"token":"PRIVATE-JSON-SENTINEL",invalid}',
  );
  await assert.rejects(readDocument(root, "private.json"), (error) => {
    assert.equal(error.message, "Invalid JSON input; inspect the file locally");
    assert.ok(!error.message.includes("PRIVATE-JSON-SENTINEL"));
    return true;
  });
});
