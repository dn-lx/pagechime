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
