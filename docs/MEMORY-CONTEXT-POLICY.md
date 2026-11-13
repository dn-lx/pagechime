# Memory and Context Policy

The goal is high-quality agent work without repeatedly paying the context cost of rediscovering the project.

## Three sources with separate jobs

- **Project Memory** (`docs/PROJECT-MEMORY.md`): stable project identity, architecture, invariants, privacy/security boundaries, commands, and links to authoritative sources.
- **Current Handoff** (`docs/CURRENT-HANDOFF.md`): active work only—branch/ref, status, evidence, blocker, and next safe action. Remove completed work and replace stale claims.
- **Skills and decisions**: repeatable procedures belong in the smallest relevant skill; accepted trade-offs belong in the decision/ADR record. Git history and verified tests are episodic evidence, not a second transcript archive.

Do not create a parallel memory system or copy the starter toolkit wholesale. Use the repository's existing project memory, handoff, reviewed-learning workflow, and requirements.

## Progressive context loading

Startup context should be limited to the canonical working agreement, compact Project Memory, and relevant active Handoff. Do not automatically load platform workflows, MCP policy, every skill, or every superpower.

After startup:
1. classify the task and its risk,
2. select one primary specialist skill or the smallest directly relevant set,
3. inspect current Git status/diff/history and verify the active ref,
4. use exact search or Graphify before broad reads; re-fetch candidate files from the active branch/SHA when indexes are not ref-scoped,
5. open only relevant source, requirements, and checks,
6. broaden only when evidence requires it.

For current Me+ requirements, use the configured specification router and retrieve only relevant canonical specifications, current state, and latest relevant checkpoint. If that route is unavailable, state the limitation and validate against the repository; do not silently treat chat history as canonical. Use `scripts/context-packet.mjs` for a broad task packet; its estimate is a routing aid, not permission to omit evidence.

## Evidence and confidence

Label knowledge by what it is: observed fact, explicit preference, accepted decision, hypothesis, or open loop. Keep scope and source with claims that can change. Source code, accepted requirements, current external state, and observed checks outrank generated memory. Memory is navigation and continuity support, never authorization.

Keep implementation, test, deployment, enablement, and user acceptance as separate statuses. A notebook existing does not prove a model ran; an audio file existing does not prove it was listened to, aligned, saved to Drive, or imported by the reader.

Revalidate volatile claims at use time: branch/deploy state, account access, provider rules, runtimes, quotas, model versions, prices, and current API behavior. Mark inferences explicitly. If evidence is missing or conflicts with memory, pause the claim and reconcile it.

## Write-back and freshness

After material work, write the smallest actionable update:
- stable architecture/invariant → Project Memory or accepted ADR,
- active task/blocker/next step → Current Handoff,
- repeatable workflow → existing specialist skill,
- reproducible recurring mistake → reviewed-learning proposal.

Cite paths, commit SHA, test output, and sanitized external evidence where practical. Preserve a dated review or invalidation condition for advice that depends on a version, provider, runtime, or account setting. Re-review before reuse when its scope changes or evidence expires. Retire stale advice with a reason; never silently renew it.

Never store secrets, private book text/audio, personal recordings, signed URLs, credentials, or raw user transcripts in repository memory. Keep private artifacts in authorized private storage. Do not let stored preference or history authorize external writes.

## Context budget

Avoid whole-repository dumps, generated/dependency folders, binary assets unless needed, repeated documentation, and full prior transcripts. Prefer a compact memory, one task packet, relevant source, current diff, failing evidence, and project rules.

For visual bugs, start with the screenshot/reproduction, affected component/styles, and `frontend-verification`; expand only if the defect indicates a broader cause.

## Bounded automation and review

For automated agent loops, cap repairs, fingerprint repeated failures, and stop/escalate on repeated failure. Do not ask multiple models to rediscover identical context.

Independent reviewers normally need the original requirement, final diff, relevant source, project rules, and deterministic check results—not the full implementer transcript.

Optional compression or external memory services remain subordinate to repository evidence. Before adopting an external memory service, document data, retention, privacy, freshness, export, and fallback. Never rely on it for authorization or factual truth.
