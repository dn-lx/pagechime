---
name: release-workflow
description: Enforce feature/fix/chore → develop → main release flow.
---

# Release Workflow

## Non-negotiable production rule

`main` is production/release.

The only branch allowed to merge into `main` is this repository's `develop` branch.

```text
feature/* or fix/* or chore/*
             ↓
           develop
             ↓
       checks + review
             ↓
      develop → main PR
             ↓
     production-approved
             ↓
            main
```

## Development changes

1. Start from current `develop`.
2. Create focused feature/fix/chore branch.
3. Implement smallest complete change.
4. Run relevant verification.
5. Open PR into `develop`.
6. Review final diff/checks.
7. Merge only after checks pass.

## Production release

Require:
- base = `main`,
- head = same-repo `develop`,
- `production-approved` label as the repository's supplemental release gate,
- required checks passed,
- release diff reviewed,
- migrations/secrets/external-service/deployment changes explicitly reviewed,
- runtime/deployed-revision verification and rollback/containment plan defined when the project has a production runtime; see `docs/OPERATIONS-RECOVERY.md`.

The label check alone cannot prove that a human made the approval decision. Configure branch/ruleset protection or an equivalent protected deployment approval so production remains genuinely human-controlled; do not let an automation agent self-satisfy the intended human gate.

Prefer a normal merge commit for develop→main when preserving branch ancestry is useful.

## Forbidden

Never:
- merge feature/fix/chore directly to main,
- push implementation directly to main,
- force-push main,
- cherry-pick around release policy,
- deploy a feature branch as production to bypass Git,
- weaken release guards to force a release.

## Emergency fixes

Emergency does not bypass the develop-only rule. Stabilize develop, verify the fix, then release develop→main.

## Current Pagechime development phase

The owner explicitly requires implementation directly on `develop`, with no promotion to `main` until a later instruction. When `.agents/project-policy.json` sets `continuity.direct_integration_work` to true, keep task state on the integration branch with a null PR; do not create a feature branch or release PR just to satisfy the generic examples below. This exception does not authorize changes to the production branch.
