# Database-boundary review

Identify the actual database/project/environment, actor, protected operation and enforcing authorization boundary. A development frontend does not imply a development database. Public keys and UI restrictions do not confer privileged access.

Review RLS/tenant ownership, public-vs-secret config, migrations/backfills, locking, rollback compatibility, idempotency and generated IDs. Verify both permitted and denied access in an isolated test environment. Use harmless reads first; require explicit scope/approval for external writes. Never weaken RLS or expose service credentials to make tests pass.
