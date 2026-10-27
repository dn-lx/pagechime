# Test-adequacy review

Map each accepted behavior and security invariant to a test or explicit manual check. Confirm tests execute the active implementation, not a mock of the behavior they claim to prove. Include denied/error/partial-success paths and realistic viewport or environment boundaries where relevant.

Inspect runner exit codes, skipped cases, retries, stale snapshots, assertions that only match source text and CI workflows that do no meaningful work. A fixture test for an agent tool is not an actual model evaluation. Preserve failing evidence and tie results to the final reviewed revision.
