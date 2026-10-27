---
name: verification-loop
description: Produce revision-bound verification evidence without confusing passing commands with completed acceptance or deployment.
---

# Verification Loop

Use `quality-gates` to select risk and required checks first. This skill owns executing and reporting the selected checks, not release authorization. See `docs/AGENT-RELIABILITY.md` for the runner contract.

1. Reconcile the task, accepted outcome and current branch. Trace active code paths before choosing checks.
2. Inspect `.agents/verification.json`. Run `node scripts/verify.mjs --profile starter` to preview starter checks without executing them. Application changes use the feature profile; releases use release. Never substitute a starter-tooling pass for application evidence.
3. Configure the real build, type, lint, test, security and browser commands as argv arrays. Null means unconfigured. For a genuinely inapplicable phase, document the reason and review the profile change; do not replace it with an echo-success command.
4. Review commands and their environment before adding `--run`. Commands are trusted project code, can have side effects, and are NOT sandboxed. Obtain separate authorization for external writes. No global install, permission bypass, destructive cleanup or production action is implied.
5. Run from a clean committed repository root; retain the JSON report and CI run reference. Exit 1 is failure/error; exit 2 is incomplete; plan output is not test execution.
6. Add actual acceptance, independent review and runtime/browser evidence as required. These stay NOT_VERIFIED in the command report; the runner cannot attest them. A source change, sent-mail event or successful merge alone cannot prove rendered behavior, inbox receipt or a published revision.
7. Inspect the final diff and evidence against the final SHA. After another commit, rerun the gate. Do not hide failing checks with pipes, retries, weaker assertions or optimistic summaries.

Reports must state scope, tested SHA, dirty-worktree status, exact check outcomes, remaining evidence and rollback concerns. Never claim release approval from this tool.

Workflow concepts adapted from ECC; see `docs/UPSTREAM-PROVENANCE.md`.
