---
name: memory-context
description: Keep PageChime agent context small, current, source-linked, and safe to resume.
---

# Memory and Context

Read `docs/MEMORY-CONTEXT-POLICY.md` and follow the canonical source-of-truth order in `AGENTS.md`.

## Start with a bounded packet

For a resumed or broad task, read Project Memory and Current Handoff, then verify the active branch/ref, working diff, and relevant repository state. Treat a handoff as a lead to investigate, not proof that a branch, deployment, credential, test, or task still exists. For current Me+ requirements, retrieve the registered canonical specification and latest relevant checkpoint through the configured router when available; if unavailable, record that limitation and verify repo evidence directly. Do not substitute chat recall for canonical state.

Classify each retrieved statement as one of:
- **Fact** — directly observed in current source, tool output, or test evidence.
- **Preference** — explicit owner instruction; retain its scope and date when it can change.
- **Decision** — accepted trade-off; link the decision record or source.
- **Hypothesis** — unverified explanation; do not repeat as fact.
- **Open loop** — unfinished work with owner, blocker, and next action.

Select only the directly relevant skill(s), exact source files, requirements, and checks. Use exact search/Graphify before broad reads. Search results locate candidates; fetch the candidate from the active ref/SHA before relying on it. Avoid resending unchanged files and full transcripts. Use `node scripts/context-packet.mjs <files...>` when constructing a broad packet.

## Write-back after material work

Write the smallest update that lets a fresh session continue correctly:
1. Record outcome and status separately for implemented, verified, deployed, enabled, and user-accepted.
2. Cite the active branch and commit SHA plus the exact files, checks, external artifacts, and evidence actually observed.
3. Keep durable architecture/policy in Project Memory or an accepted decision record; keep active task, blocker, and next step in Current Handoff; keep repeatable procedures in the smallest existing skill.
4. Record a lesson only after reproducing or independently confirming it. Include scope, evidence, invalidation/review condition, and a specific action; use `reviewed-learning`. Do not retain raw conversation, private book text/audio, access URLs, credentials, or personal data in Git.
5. Remove completed items from the active handoff and replace superseded claims instead of appending another competing “current” paragraph.

If an external memory/checkpoint service is unavailable, say so in the handoff and use repo-owned sources; never imply that a write succeeded. Do not make generated memory more authoritative than source, accepted requirements, tests, or verified external state.

## Freshness and confidence

Attach claims to files, commits, tests, or dated tool evidence where practical. Revalidate volatile claims (runtime, provider availability, model versions, account permissions, branch/deploy state, prices and quotas) at the point of use. Mark an inference as an inference. When the source changed, the record is past its review date, or contrary evidence appears, stop using that memory until it is reconciled. Retire stale advice with a reason; do not silently extend its review date.

## Safety and bounded automation

Never let a memory claim grant access or authorize a production write. Re-check the live target and current owner instruction before external mutations. For automated retries, set a small bound, detect repeated identical failures, and stop/escalate rather than looping. Do not report a check or artifact as successful unless its output was observed.
