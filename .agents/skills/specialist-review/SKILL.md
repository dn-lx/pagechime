---
name: specialist-review
description: Select one focused code-path, silent-failure, test-adequacy or database review lens for a material change.
---

# Specialist Review

Keep existing Planner / Executor / Independent Reviewer routing. This skill is a focused checklist library, not another orchestrator. Do not launch every specialist by default.

Use `REVIEW.md`, `quality-gates` and `security-boundary-review` where relevant. Supply the reviewer with the requirement, complete diff, final SHA, relevant source and deterministic results using `docs/templates/REVIEW-PACKET-TEMPLATE.md`; not the implementer's full transcript.

Choose only the needed lens:
- Unfamiliar paths or competing implementations: read `references/code-path.md` in this skill directory.
- Partial success, swallowed errors or background operations: read `references/silent-failure.md`.
- Tests that may pass without protecting behavior: read `references/test-adequacy.md`.
- Database, Supabase/RLS, tenant or shared-environment changes: read `references/database-boundary.md`.

The reviewer starts read-only. Record each finding with severity, exact file/line, reproduction or counterexample, consequence and minimal correction. Distinguish observed defects from questions. No evidence means unverified, not approved.

For sensitive changes, the sole author must not be the sole approver. Record actual reviewer identity/session and artifacts; do not claim a fresh review that did not occur. If an independent reviewer is unavailable, leave the review requirement open. Fixes return to the owning writer, then rerun affected checks on the final SHA.

Workflow concepts adapted from ECC; see `docs/UPSTREAM-PROVENANCE.md`.
