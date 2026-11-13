# Upstream provenance — coding-partner reliability

Reviewed on 2026-10-07. This is a curated adaptation, not a full ECC installation, dependency or endorsement. The starter's AGENTS.md, policy and accepted requirements remain authoritative.

## Reference snapshots

| Source | Pinned revision | Use |
| --- | --- | --- |
| WorldFlowAI/everything-claude-code, the user-supplied reference | 432485ba6b92c14fb357276a98957f348bcff9ee | Workflow ideas and comparison with the WorldFlowAI setup guide; no mirror hooks or installer executed |
| affaan-m/ECC, the official source identified by the reference | ef648e01899ba3e8dc6371642deaaf64b4477775 | Licensed verification/evaluation concepts and specialist/learning patterns |

Reference source: https://github.com/WorldFlowAI/everything-claude-code/tree/432485ba6b92c14fb357276a98957f348bcff9ee

Licensed upstream: https://github.com/affaan-m/ECC/tree/ef648e01899ba3e8dc6371642deaaf64b4477775

The supplied snapshot's README and plugin metadata identify Affaan Mustafa's upstream. This adaptation retains the MIT notice from the official source in [ECC-LICENSE.txt](third-party/ECC-LICENSE.txt). That notice covers the upstream material; it does not relicense unrelated starter files or imply that every third-party mirror addition has been independently licensed.

## Adopted and deliberately changed

- Verification-loop concepts: named phases and evidence reporting, reimplemented as an opt-in argv runner that preserves failures, detects stale/dirty candidates and keeps manual/runtime evidence incomplete.
- Eval-harness concepts: capability/regression criteria and first-attempt / within-k / all-k outcomes, reimplemented as a versioned evidence scorer without automatic model execution or fabricated benchmarks.
- Specialist review: focused code-path, silent-failure, test-adequacy and database-boundary prompts adapted to existing capability-based routing.
- Continuous learning: proposal/review/promotion into existing project-owned knowledge, not automatic session transcript retention.

Relevant upstream paths include skills/verification-loop/SKILL.md, skills/eval-harness/SKILL.md, agents/ and skills/continuous-learning/. The new runner, scorer, generator and tests are project-specific implementations rather than copied upstream executable hooks.

Not adopted: global config overwrites, blanket permission grants, tmux-only assumptions, automatic MCP enablement, automatic memory promotion, hard-coded provider winners, mandatory global coverage percentages, duplicate orchestrators or remote installers. Shell snippets that truncate command output are not copied into the runner.

## Host format references

Checked the official documentation for the affected formats, not all features of each CLI:

- Claude project skill discovery and skill frontmatter: https://code.claude.com/docs/en/skills
- Gemini canonical skill discovery: https://geminicli.com/docs/cli/skills/
- Gemini project command TOML and namespace rules: https://geminicli.com/docs/cli/custom-commands/

Claude/Gemini runtime activation must be tested on an authenticated machine. File validation and generated adapter parity do not establish actual host behavior. No benchmark winners or current model-performance percentages are inferred from upstream marketing.

## Update procedure

Review a new upstream revision as a diff. Identify the concrete benefit, licensing and executable trust boundary; adapt only needed changes, regenerate adapters and run negative-path tests. Record the new source pin here. Never auto-pull upstream instructions/hooks into every future project.


## Agent Project Starter — shared memory and honest checks

Reviewed on 2026-11-13. Reference: [yuanzd123/agent-project-starter](https://github.com/yuanzd123/agent-project-starter/tree/d08cc420027c59c3982a3f1a2cc1381f96f0891d), pinned at `d08cc420027c59c3982a3f1a2cc1381f96f0891d` for this review. Its MIT license applies to upstream files; this Pagechime adaptation is guidance and workflow design, not a copied toolkit or claim that upstream license covers unrelated project files.

Adopted ideas: one current snapshot separate from stable memory, typed and source-linked claims, scoped lessons with review/expiry, honest separation of implementation/check/deploy/use, and explicit failure when evidence is missing. Adapted to Pagechime's existing `PROJECT-MEMORY.md`, `CURRENT-HANDOFF.md`, `memory-context`, and `reviewed-learning` conventions. No upstream scripts, hooks, prompts, or automation were installed. No agent was granted new permissions.

Revisit this reference only when a concrete improvement is needed; compare a pinned upstream diff, inspect license and executable trust boundaries, adapt the smallest useful part, and update this provenance note. Never automatically import upstream instructions.
