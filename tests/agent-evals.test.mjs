import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { digest } from "../scripts/lib/evidence.mjs";
import { newRun, score, validateSuite } from "../scripts/agent-evals.mjs";

const suite = {
  schema_version: 1,
  id: "fixture",
  version: "1.0.0",
  attempts_per_case: 3,
  cases: [
    {
      id: "safety",
      prompt: "Synthetic scoring fixture; not a real agent trial",
      safety_critical: true,
      criteria: [
        { id: "boundary", description: "Protect the boundary" },
        { id: "evidence", description: "Record evidence" },
      ],
    },
  ],
};
const hash = digest(JSON.stringify(suite));
function run() {
  return {
    ...newRun(suite, hash),
    subject_sha: "a".repeat(40),
    partner: {
      host: "synthetic-host",
      model: "synthetic-model",
      version: "fixture-1",
    },
  };
}
function trial(attempt = 1) {
  return {
    case_id: "safety",
    attempt,
    status: "completed",
    reviewer: "fixture-reviewer",
    checks: suite.cases[0].criteria.map((c) => ({
      criterion_id: c.id,
      outcome: "pass",
      evidence: ["fixture://not-a-real-benchmark"],
    })),
  };
}

test("shipped scenario suite has stable identity and safety coverage", async () => {
  const actual = JSON.parse(
    await readFile(new URL("../evals/partner-contracts.json", import.meta.url)),
  );
  validateSuite(actual);
  assert.equal(actual.cases.length, 8);
  assert.ok(actual.cases.filter((c) => c.safety_critical).length >= 5);
});
test("new result template records zero executed trials", () => {
  const result = score(suite, newRun(suite, hash), hash);
  assert.equal(result.status, "INCOMPLETE");
  assert.equal(result.counts.UNRUN, 3);
  assert.equal(result.metrics.pass_at_1.rate, null);
  assert.equal(result.evidence_authenticated, false);
  assert.equal(result.release_authorized, false);
});
test("all declared attempts must have evidence before suite passes", () => {
  const input = run();
  input.trials = [trial(1), trial(2), trial(3)];
  const result = score(suite, input, hash);
  assert.equal(result.status, "PASS");
  assert.equal(result.counts.PASS, 3);
  assert.equal(result.metrics.pass_at_1.rate, 1);
  assert.equal(result.metrics.all_k_pass.rate, 1);
});
test("passing one retry does not claim three consistent successes", () => {
  const input = run();
  input.trials = [trial(2)];
  const result = score(suite, input, hash);
  assert.equal(result.status, "INCOMPLETE");
  assert.equal(result.cases[0].pass_within_k, true);
  assert.equal(result.cases[0].pass_at_1, null);
  assert.equal(result.cases[0].all_k_pass, null);
});
test("later success never erases an observed critical failure", () => {
  const input = run();
  input.trials = [trial(1), trial(2), trial(3)];
  input.trials[0].checks[0].outcome = "fail";
  const result = score(suite, input, hash);
  assert.equal(result.status, "FAIL");
  assert.equal(result.metrics.pass_within_k.rate, 1);
  assert.equal(result.metrics.pass_at_1.rate, 0);
  assert.equal(result.metrics.all_k_pass.rate, 0);
  assert.deepEqual(result.critical_failures, ["safety"]);
});
test("missing criterion or reviewer cannot pass", () => {
  for (const modify of [
    (t) => t.checks.pop(),
    (t) => (t.checks[0].evidence = []),
    (t) => delete t.reviewer,
    (t) => (t.checks[0].outcome = "unverified"),
    (t) => (t.status = "incomplete"),
  ]) {
    const input = run();
    input.trials = [trial()];
    modify(input.trials[0]);
    assert.equal(
      score(suite, input, hash).cases[0].attempts[0].status,
      "INCOMPLETE",
    );
  }
});
test("failed invocation is still a failure with no criteria", () => {
  const input = run();
  input.trials = [
    { case_id: "safety", attempt: 1, status: "failed", checks: [] },
  ];
  assert.equal(score(suite, input, hash).status, "FAIL");
});
test("mixed suite or subject identities are rejected", () => {
  for (const change of [
    (r) => (r.suite_id = "other"),
    (r) => (r.suite_version = "2.0.0"),
    (r) => (r.suite_sha256 = "bad"),
    (r) => (r.subject_sha = "not-a-revision"),
    (r) => (r.trials[0].subject_sha = "b".repeat(40)),
  ]) {
    const input = run();
    input.trials = [trial()];
    change(input);
    assert.throws(() => score(suite, input, hash));
  }
});
test("duplicates and unknown cases/criteria are rejected", () => {
  for (const change of [
    (r) => r.trials.push(trial()),
    (r) => (r.trials[0].case_id = "other"),
    (r) => (r.trials[0].checks[0].criterion_id = "other"),
    (r) => (r.trials[0].checks[1].criterion_id = "boundary"),
  ]) {
    const input = run();
    input.trials = [trial()];
    change(input);
    assert.throws(() => score(suite, input, hash));
  }
});
test("invalid attempts, durations, outcomes and claimed-success fields are rejected", () => {
  for (const change of [
    (t) => (t.attempt = 0),
    (t) => (t.attempt = 4),
    (t) => (t.attempt = 1.5),
    (t) => (t.duration_ms = -1),
    (t) => (t.duration_ms = NaN),
    (t) => (t.status = "passed"),
    (t) => (t.passed = true),
    (t) => (t.checks[0].outcome = "maybe"),
    (t) => (t.checks[0].evidence = [""]),
  ]) {
    const input = run();
    input.trials = [trial()];
    change(input.trials[0]);
    assert.throws(() => score(suite, input, hash));
  }
});
test("unconfigured partner cannot produce scored trials", () => {
  const input = newRun(suite, hash);
  input.subject_sha = "a".repeat(40);
  input.trials = [trial()];
  assert.throws(() => score(suite, input, hash), /actual host/);
});
test("suite rejects empty, repeated or unbounded inventories", () => {
  for (const change of [
    (s) => (s.schema_version = 2),
    (s) => (s.cases = []),
    (s) => (s.attempts_per_case = 0),
    (s) => (s.attempts_per_case = 100),
    (s) => s.cases.push(s.cases[0]),
    (s) => (s.cases[0].criteria = []),
    (s) => s.cases[0].criteria.push(s.cases[0].criteria[0]),
  ]) {
    const candidate = structuredClone(suite);
    change(candidate);
    assert.throws(() => validateSuite(candidate));
  }
});
