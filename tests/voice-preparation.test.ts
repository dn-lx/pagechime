import { test } from "node:test";
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";

test("offline voice preparation preserves source text and rejects invalid resume checkpoints", () => {
  const result = spawnSync("python3", ["tests/voice_preparation_python.py"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
