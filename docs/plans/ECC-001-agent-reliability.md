# ECC-001 — Evidence-based coding partners

Status: implementation independently reviewed; review corrections and release preparation require final candidate checks. Actual merge/release state is recorded in PR #45 and PR #44.

## Accepted outcome

Improve Agent Project Starter for future Claude Code and Gemini CLI coding partners using the verification, evaluation, specialist-review and learning ideas identified in Everything Claude Code. Keep AGENTS.md and .agents/project-policy.json authoritative, existing progressive skill loading, current dev/prod workflow, and all existing starter capabilities. On 2026-10-07 the project owner additionally approved merging the upgrade into dev and prod through the normal release workflow.

## Current evidence

The task started from dev baseline 4d7b2171d78600fd8df3bdfb2b9fc39a059d6e9f. Existing risk-based quality gates, context budgets, task continuity, local routing, canonical skills and host discovery remain intact. No vendor-specific framework replaced them. Release PR #44 is reused for the newly approved 0.2.0 promotion; its older 0.1.3 description has been superseded.

## Implementation acceptance

- [x] A real dependency-free verification runner produces machine-readable evidence, preserves command failures/timeouts, and never executes commands merely to preview the plan.
- [x] Missing application checks and missing human/runtime evidence cannot become a false release pass; reports bind to the tested revision and identify dirty worktrees.
- [x] A versioned agent-evaluation suite and scorer distinguish unrun, failed, incomplete and completed trials; no fabricated agent benchmark results.
- [x] Focused specialist reviews cover code paths, silent failures, test adequacy and database boundaries without automatic multi-agent fan-out.
- [x] Claude discovery adapters and Gemini project commands resolve to shared procedures, not duplicated policies or vendor-model defaults.
- [x] Learning remains proposal/review based; no automatic transcript retention or promotion into trusted instructions.
- [x] Upstream provenance and attribution are recorded; no remote installer, global config overwrite, production write or blanket permission grant in the implementation.
- [x] New negative-path tests and existing repository CI run; actual host activation is reported separately from static adapter validation.

## Verification and review

Historical implementation evidence: 43 focused local tests passed on Node 22/Linux and all six Gemini command files parsed as TOML. Repository CI at d2ad68e240a3dc9673956ff411a5d46ef8adeb5a passed Agent stack validation, Version validation, Security checks and Agent reliability (Linux and Windows). This is historical evidence, not validation of later edits.

CodeRabbit independently reviewed the complete change at that head on 2026-10-07 and reported three minor findings: action pinning, a stale VERSION note and CLI path-alias handling. Release corrections pin the new workflow's actions to official commit SHAs, disable checkout credential persistence, correct the version record and use shared filesystem-identity entrypoint detection. A local reproduction demonstrated the old guard's silent exit through a symlink. New regression tests cover direct/relative/aliased invocation and import-only behavior for all three affected CLIs on Linux/Windows.

The latest PR #45 checks remain authoritative for its final head/merge candidate. Earlier green results do not cover subsequent edits. Actual authenticated Claude/Gemini activation and model benchmark trials remain unverified. Record review disposition and final CI in the PR without another source edit solely to embed its own SHA.

## Delivery

Pinned references and licenses are in `docs/UPSTREAM-PROVENANCE.md`. The executable workflow and commands are in `docs/AGENT-RELIABILITY.md`. Four canonical skills, four Claude adapters, six Gemini commands, focused review references, tests and CI are committed. VERSION is set to 0.2.0 and the changelog has dated minor-release notes. Tags and prod remain unchanged until the approved release steps actually complete.

## Boundaries and rollback

Implementation writes are limited to this starter task branch/PR; the owner has explicitly authorized subsequent feature-to-dev and dev-to-prod merges. No FrankiFlow application, Supabase, hosting configuration, external messages or global host setup changes are included. Verification commands are trusted project code, not a sandbox; execution requires an explicit opt-in. Eval scoring validates submitted evidence structure, not the truth of a model's self-report. Rollback is a reviewed revert through dev-to-prod; no data migrations or global installations are involved.
