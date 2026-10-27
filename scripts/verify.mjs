import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { isMainModule } from "./lib/entrypoint.mjs";
import {
  artifactTarget,
  digest,
  keys,
  options,
  readDocument,
  requireThat,
  text,
  unique,
  writeArtifact,
} from "./lib/evidence.mjs";

export function validateConfig(config) {
  keys(config, ["schema_version", "checks", "profiles"], "Verification config");
  requireThat(config.schema_version === 1, "Unsupported verification schema");
  requireThat(
    Array.isArray(config.checks) &&
      config.checks.length > 0 &&
      config.checks.length <= 64,
    "Expected 1-64 checks",
  );
  const ids = [];
  for (const check of config.checks) {
    keys(
      check,
      ["id", "phase", "description", "command", "timeout_ms"],
      "Check",
    );
    requireThat(
      typeof check.id === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(check.id),
      "Invalid check id",
    );
    requireThat(
      text(check.phase) && text(check.description),
      "Check needs phase and description",
    );
    requireThat(
      Number.isInteger(check.timeout_ms) &&
        check.timeout_ms >= 50 &&
        check.timeout_ms <= 1800000,
      "Timeout must be 50-1800000 ms",
    );
    requireThat(
      check.command === null ||
        (Array.isArray(check.command) &&
          check.command.length > 0 &&
          check.command.length <= 128 &&
          check.command.every(
            (arg) => typeof arg === "string" && !arg.includes("\0"),
          ) &&
          text(check.command[0])),
      "Command must be an argv array or null",
    );
    ids.push(check.id);
  }
  unique(ids, "Check ids");
  keys(config.profiles, ["starter", "feature", "release"], "Profiles");
  requireThat(
    Object.keys(config.profiles).length > 0,
    "No profiles configured",
  );
  for (const profile of Object.values(config.profiles)) {
    keys(profile, ["scope", "checks", "manual_evidence"], "Profile");
    requireThat(text(profile.scope), "Profile needs an explicit scope");
    requireThat(
      Array.isArray(profile.checks) &&
        profile.checks.length > 0 &&
        profile.checks.every((id) => ids.includes(id)),
      "Profile references missing checks",
    );
    unique(profile.checks, "Profile checks");
    requireThat(
      Array.isArray(profile.manual_evidence) &&
        profile.manual_evidence.every(text),
      "manual_evidence must be an array of requirements",
    );
    unique(profile.manual_evidence, "Manual evidence requirements");
  }
  return config;
}

function git(root, args) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    timeout: 10000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0)
    throw new Error("Git evidence unavailable");
  return result.stdout.trim();
}
export function sameDirectory(leftPath, rightPath) {
  // Git and Node may preserve different casing/8.3 spellings for one Windows path.
  // Compare filesystem identity instead of loosening the repository-root boundary.
  const left = statSync(leftPath, { bigint: true }),
    right = statSync(rightPath, { bigint: true });
  if (!left.isDirectory() || !right.isDirectory()) return false;
  if (left.ino > 0n && right.ino > 0n)
    return left.dev === right.dev && left.ino === right.ino;
  return realpathSync.native(leftPath) === realpathSync.native(rightPath);
}
export function snapshot(root) {
  try {
    const top = realpathSync(git(root, ["rev-parse", "--show-toplevel"]));
    requireThat(sameDirectory(top, root), "Run from the repository root");
    const sha = git(root, ["rev-parse", "HEAD"]);
    requireThat(
      /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(sha),
      "Invalid Git revision",
    );
    const status = git(root, [
      "status",
      "--porcelain",
      "--untracked-files=normal",
    ]);
    return { sha, dirty: status.length > 0, status_sha256: digest(status) };
  } catch {
    return { sha: null, dirty: null, status_sha256: null };
  }
}

export function executeCheck(root, check, outputLimit = 1024 * 1024) {
  if (check.command === null)
    return Promise.resolve({
      id: check.id,
      phase: check.phase,
      status: "UNCONFIGURED",
    });
  return new Promise((done) => {
    const start = Date.now(),
      hashes = { stdout: createHash("sha256"), stderr: createHash("sha256") };
    const sizes = { stdout: 0, stderr: 0 };
    let failure = null,
      errorCode = null,
      timer,
      killTimer,
      finished = false;
    const [program, ...args] = check.command;
    const child = spawn(program === "node" ? process.execPath : program, args, {
      cwd: root,
      shell: false,
      detached: process.platform !== "win32",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const kill = () => {
      // Best effort process-tree cleanup, not a sandbox or a guarantee against daemonized descendants.
      if (!child.pid) return;
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          timeout: 5000,
          windowsHide: true,
          stdio: "ignore",
        });
      } else {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      }
    };
    const finish = (code, signal) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      done({
        id: check.id,
        phase: check.phase,
        status: failure || (code === 0 ? "PASS" : "FAIL"),
        exit_code: code,
        signal,
        error_code: errorCode,
        duration_ms: Date.now() - start,
        output: {
          stdout_bytes: sizes.stdout,
          stderr_bytes: sizes.stderr,
          stdout_sha256: hashes.stdout.digest("hex"),
          stderr_sha256: hashes.stderr.digest("hex"),
        },
      });
    };
    const stop = (reason) => {
      if (failure || finished) return;
      failure = reason;
      kill();
      // A descendant may retain a pipe after termination. Never hang indefinitely.
      killTimer = setTimeout(() => {
        child.stdout.destroy();
        child.stderr.destroy();
        child.unref();
        finish(null, "SIGKILL");
      }, 1000);
    };
    for (const stream of ["stdout", "stderr"])
      child[stream].on("data", (data) => {
        if (finished) return;
        sizes[stream] += data.length;
        hashes[stream].update(data);
        if (sizes.stdout + sizes.stderr > outputLimit) stop("OUTPUT_LIMIT");
      });
    child.on("error", (error) => {
      failure = "ERROR";
      errorCode = error.code || "SPAWN_ERROR";
      finish(null, null);
    });
    child.on("close", finish);
    timer = setTimeout(() => stop("TIMEOUT"), check.timeout_ms);
  });
}

export async function verify(
  root,
  config,
  profileName = "starter",
  run = false,
  configSha = digest(JSON.stringify(config)),
) {
  validateConfig(config);
  const profile = config.profiles[profileName];
  requireThat(profile, "Unknown verification profile");
  const checks = profile.checks.map((id) =>
    config.checks.find((check) => check.id === id),
  );
  const report = {
    schema_version: 1,
    mode: run ? "run" : "plan",
    profile: profileName,
    scope: profile.scope,
    config_sha256: configSha,
    generated_at: new Date().toISOString(),
    release_authorized: false,
    manual_evidence: profile.manual_evidence.map((requirement) => ({
      requirement,
      status: "NOT_VERIFIED",
    })),
    note: "Command evidence only. Review project code before --run; this is not a sandbox or release approval.",
  };
  if (!run) return { ...report, status: "PLAN", checks, repository: null };
  const before = snapshot(root),
    results = [];
  if (before.sha)
    for (const check of checks) results.push(await executeCheck(root, check));
  else
    for (const check of checks)
      results.push({ id: check.id, phase: check.phase, status: "NOT_RUN" });
  const after = snapshot(root);
  const issues = [];
  if (!before.sha || !after.sha)
    issues.push(
      "Git revision unavailable; execute from a Git repository root with a commit",
    );
  if (before.dirty || after.dirty)
    issues.push("Dirty worktree: evidence is not a clean committed candidate");
  if (before.sha !== after.sha || before.status_sha256 !== after.status_sha256)
    issues.push(
      "Repository changed during verification; rerun on final revision",
    );
  if (report.manual_evidence.length)
    issues.push("Human/runtime evidence must be reviewed separately");
  const failed = results.some((check) =>
    ["FAIL", "ERROR", "TIMEOUT", "OUTPUT_LIMIT"].includes(check.status),
  );
  const incomplete =
    issues.length > 0 || results.some((check) => check.status !== "PASS");
  return {
    ...report,
    status: failed ? "FAIL" : incomplete ? "INCOMPLETE" : "PASS",
    checks: results,
    repository: { before, after },
    issues,
  };
}

export async function main(args = process.argv.slice(2)) {
  const opts = options(
    args,
    ["--config", "--profile", "--out"],
    ["--run", "--help"],
  );
  if (opts["--help"]) {
    console.log(
      "node scripts/verify.mjs [--config .agents/verification.json] [--profile starter|feature|release] [--run] [--out NAME.json]",
    );
    return;
  }
  const root = resolve(".");
  if (opts["--out"]) await artifactTarget(root, opts["--out"]);
  const config = await readDocument(
    root,
    opts["--config"] || ".agents/verification.json",
  );
  const report = await verify(
    root,
    config.value,
    opts["--profile"] || "starter",
    !!opts["--run"],
    config.sha256,
  );
  if (opts["--out"]) await writeArtifact(root, opts["--out"], report);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode =
    report.status === "FAIL" ? 1 : report.status === "INCOMPLETE" ? 2 : 0;
}
if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(JSON.stringify({ status: "ERROR", message: error.message }));
    process.exitCode = 1;
  });
}
