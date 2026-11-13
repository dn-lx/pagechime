---
name: pagechime
description: Project-specific durable guidance for Pagechime · Read & Listen.
---

# Pagechime · Read & Listen

## Purpose
An installable personal library for reading book pages while listening to synchronized narration.

## Source of truth
- Read `AGENTS.md` first.
- Use `docs/PROJECT-MEMORY.md` for durable architecture, commands, privacy boundaries, and authoritative paths.
- Use `docs/CURRENT-HANDOFF.md` only for active work; verify its branch, commit, and external state before resuming.
- Use `docs/REQUIREMENTS.md` for accepted product requirements.
- Load `audiobook-production` for source ingestion, narration, alignment, or book exports.
- Load `memory-context` for context retrieval, session recovery, or durable write-back.

## Branch flow
- Integration: `develop`
- Production: `main`
- Follow current `.agents/project-policy.json` and `AGENTS.md`; owner-directed direct integration on `develop` overrides generic temporary-branch examples while that policy is active.
- Production promotion or a production write requires explicit owner approval.

## Evidence and privacy
Do not invent missing architecture, credentials, external-system identity, production state, model output, voice quality, alignment accuracy, or user acceptance. Verify against current source/runtime/tool evidence. Keep private books, recordings, and personal Drive links outside Git.
