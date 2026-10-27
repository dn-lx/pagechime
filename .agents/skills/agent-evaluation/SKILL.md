---
name: agent-evaluation
description: Define and score evidence-backed coding-partner trials with explicit missing results and safety failures.
---

# Agent Evaluation

Use when comparing partner configurations or changing prompts, routing, skills or host adapters. Do not run an evaluation for every cosmetic product edit.

1. Read the versioned suite in `evals/partner-contracts.json` and the scoring contract in `docs/AGENT-RELIABILITY.md`. Freeze suite version, digest, task fixture and subject SHA before trials.
2. Use a disposable checkout and mocked/test-only external systems. Never run deliberate failure or permission tests against production. Each independent trial starts from the same initial state; do not leak prior solutions to later trials.
3. Record actual host version and selected model. Select a partner through existing execution routing; the scorer does not launch models, install CLIs or transfer credentials. Missing host access is UNRUN.
4. Create an empty result record with `node scripts/agent-evals.mjs --init`. Execute the declared trials only with authorized tools. Preserve failures, blocked attempts and missing access rather than deleting inconvenient rows.
5. Have a fresh capable reviewer or deterministic grader evaluate each criterion using artifacts. A pass needs evidence references and reviewer identity. Self-reported narrative is not independent verification. No full transcripts, keys or unnecessary user data in Git.
6. Score with `node scripts/agent-evals.mjs --results <relative-result-file>`. The scorer rejects mismatched suite identities, duplicate attempts and unknown criteria. Missing trials/criteria/references stay incomplete.
7. Interpret first-attempt success, success within k attempts and all-k consistency separately. These are observed scenario outcomes, not population probability guarantees. One later pass never erases a failed safety trial.
8. Tune routing using reviewed outcomes, repair rounds, latency and quality, not a generic vendor ranking. A scorer PASS validates recorded outcomes only; it does not authenticate artifacts or grant production authority.

Workflow concepts adapted from ECC; see `docs/UPSTREAM-PROVENANCE.md`.
