---
name: reviewed-learning
description: Turn verified recurring engineering observations into reviewable learning proposals rather than automatic trusted instructions.
---

# Reviewed Learning

Use after a reproducible debugging lesson or repeated correction. Existing source/tests, accepted requirements and repository policy remain authoritative. See `docs/MEMORY-CONTEXT-POLICY.md`.

1. Capture the observation, reproduction, source revision, affected scope and counterexamples. Do not retain private reasoning or full transcripts.
2. Reject lessons that bypass permissions, skip failing tests, hide errors or universalize a one-off workaround.
3. Choose one durable destination: regression test for behavior, existing skill for repeated procedure, Project Memory for a stable fact, or ADR for an architectural decision. Do not create a parallel memory system.
4. Propose the change using `docs/templates/LEARNING-PROPOSAL-TEMPLATE.md` in the PR or task's existing evidence record. The initial state is proposed, not approved.
5. Obtain review appropriate to risk; sensitive rules require independent review. Record accept/reject/revise, reviewer, source links and scope. No hook automatically approves or writes a learned skill.
6. Promote only the accepted minimal change through the normal branch/PR workflow. Attach a regression check when useful and define when the lesson becomes stale.

Nothing here installs session hooks, reads other projects' memory or changes user-global settings. Optional host memory is not repository policy.

Workflow concepts adapted from ECC; see `docs/UPSTREAM-PROVENANCE.md`.
