# Coding-partner reliability

This is an optional, executable layer over the existing provider-neutral workflow. It does not replace task continuity, execution routing, quality gates, security review or release approval. Node.js 22 and Git are used; there are no new package dependencies, background services or automatic upstream installers.

## Verification runner

From the repository root:

```sh
node scripts/verify.mjs --profile starter
node scripts/verify.mjs --profile starter --run --out starter-checks.json
```

The first command only validates and prints the plan. It does not spawn checks or Git commands. The second explicitly runs trusted, reviewed commands from `.agents/verification.json`. Reports are written exclusively under the ignored .agent-artifacts directory with a new filename; existing artifacts are never overwritten. Use a different filename for each run.

The starter profile verifies starter tooling, documentation, versioning, adapters and the Node test suite. It is NOT application verification. In a generated project, configure feature/release commands, keep Project Memory and CI aligned, and remove a genuinely inapplicable phase only with documented review. A null command stays UNCONFIGURED. There is no fake echo-success fallback or universal coverage percentage.

```sh
node scripts/verify.mjs --profile feature
node scripts/verify.mjs --profile release --run --out release-candidate.json
```

| Status | Meaning | Exit |
| --- | --- | --- |
| PLAN | Configuration preview; nothing executed | 0 |
| PASS | All declared command checks passed on a clean, unchanged Git candidate with no manual requirements in that profile | 0 |
| FAIL / ERROR | A check failed, could not launch, timed out, exceeded output limit, or configuration was invalid | 1 |
| INCOMPLETE | Unconfigured/unrun checks, unavailable Git identity, dirty/changed worktree, or outstanding human/runtime evidence | 2 |

Every run records before/after SHA, dirty state, config digest, timings and individual check outcomes. Stdout/stderr are counted and hashed, not copied into the report. Keep secrets out of command arguments and inspect logs locally through the project's normal tools when debugging. Reports are not a cryptographic attestation: a malicious project command can tamper with its own workspace. Never run an untrusted repository merely to inspect it.

Commands execute as argv with shell disabled, one at a time, with a timeout and a combined 1 MiB output limit. Descendant cleanup is best effort, not OS containment. Commands inherit the invoking environment; local tests can still contact real systems if misconfigured. Use isolated fixtures/credentials and obtain specific approval for external writes. On Windows prefer Node executables or explicit project launchers; there is no implicit interpretation of .cmd files or shell pipelines.

The manual_evidence array is an honest checklist, not an input for a model to self-approve. Its items remain NOT_VERIFIED in the command report. Attach actual acceptance, browser, independent-review and runtime/deployment evidence to the PR. The runner never authorizes a release. A code merge, passing tests or HTTP response cannot by itself prove that a public domain serves the new version or an email reached an inbox.

## Agent evaluations

The versioned suite `evals/partner-contracts.json` contains eight scenarios and three planned attempts per scenario: bootstrap discovery, active UI paths, silent email failures, verification integrity, release evidence, shared-backend safety, task continuity and reviewed learning.

These are evaluation specifications, not pre-executed benchmarks. The scorer never launches Claude, Gemini or another model and never writes to external systems. Use the existing local router or an explicitly authorized host session with disposable fixtures. Record the actual model/host version. Freeze fixture state and subject SHA, reset each trial to the same starting point, and use an independent grader for outcomes.

Create a result skeleton with no fabricated observations:

```sh
node scripts/agent-evals.mjs --init --out partner-run.json
```

Fill subject_sha and actual partner metadata. Add one trial record per case/attempt. A trial has case_id, attempt (1-3), status (completed/failed/incomplete), reviewer identity, optional duration_ms, and checks. Each check contains criterion_id, outcome (pass/fail/unverified), and an array of source/CI/artifact references. For example, this is a STRUCTURE EXAMPLE, not a benchmark result:

```json
{
  "case_id": "verification-integrity",
  "attempt": 1,
  "status": "incomplete",
  "reviewer": "",
  "checks": [
    { "criterion_id": "exit-status", "outcome": "unverified", "evidence": [] }
  ]
}
```

Keep the complete generated top-level record and its suite digest. Then score it:

```sh
node scripts/agent-evals.mjs --results .agent-artifacts/partner-run.json --out partner-score.json
```

| Measure | Interpretation |
| --- | --- |
| pass_at_1 | Observed first-attempt success |
| pass_within_k | At least one observed success within the declared attempts |
| all_k_pass | Every declared attempt passed; stronger consistency evidence |

These are empirical scenario outcomes, not statistically estimated population success probabilities. Missing trials are UNRUN; missing criteria, evidence or reviewer are INCOMPLETE. Unknown identities, duplicate attempts, mixed suite versions/digests and undeclared criteria are rejected. Rates with unknown case outcomes remain null, with explicit planned/observed counts. A successful later attempt never erases a failed safety trial.

Evidence references and reviewer identities are structurally checked, not authenticated or fetched. Inspect the real artifacts before using results to change routing. Do not compare partners on different suites, fixtures or revisions as though they were equivalent. Record repair effort and latency alongside quality; never optimize away a safety failure.

## Claude and Gemini entry points

Claude uses the existing generated .claude discovery adapters to read canonical `.agents/skills/` procedures. Gemini discovers the canonical skills directly and also receives six prompt-only project shortcuts in .gemini/commands/aps.

| Task | Claude Code | Gemini CLI |
| --- | --- | --- |
| Plan | /implementation-planning | /aps:plan |
| Verify | /verification-loop | /aps:verify |
| Evaluate | /agent-evaluation | /aps:eval |
| Focused review | /specialist-review | /aps:review |
| Propose learning | /reviewed-learning | /aps:learn |
| Continue/handoff | /task-continuity | /aps:handoff |

Shortcuts reference shared procedures; they contain no shell/file injection, model selection, credential values or permission grants. Arguments are task input, not overrides of repository policy. Avoid loading the full upstream ECC plugin alongside duplicate manually copied rules/commands.

After changing canonical skill inventory or shortcut generation:

```sh
node scripts/sync-claude-skills.mjs --write
node scripts/sync-partner-commands.mjs --write
node scripts/sync-claude-skills.mjs
node scripts/sync-partner-commands.mjs
```

Generation refuses custom/unmapped files and symlinked adapter destinations; it never deletes user customizations. Only --write writes adapters. See `docs/CLAUDE-GEMINI-SETUP.md` for actual host discovery and acceptance checks. Static CI proves files/format consistency, not login, host activation or model capability.

## Reviewed learning and specialist review

The specialist-review skill provides code-path, silent-failure, test-adequacy and database-boundary lenses. Choose one relevant lens; do not fan out all specialists. Preserve one writer and use a fresh capable reviewer for sensitive work.

The reviewed-learning skill proposes a minimal source-linked change to an existing test/skill/memory/ADR. Use `docs/templates/LEARNING-PROPOSAL-TEMPLATE.md`. No session-end hook turns raw transcripts into trusted instructions. Failed tests, approval bypasses and hidden errors must never be learned as recommended practice.

## Verification scope and rollback

The regression suite tests execution failures, timeouts, output bounds, literal argv, dirty/revised candidates, malformed inputs, duplicate/missing trials, false-pass prevention and adapter drift/overwrite protection. Synthetic fixtures test the tools; they are not evidence that any coding model passed the eight scenarios.

Rollback is reverting the enhancement PR and any consuming-project configuration changes. There are no database migrations or global installations. Do not reset or delete unrelated host configuration. Source pins and license attribution are in `docs/UPSTREAM-PROVENANCE.md`.
