---
name: pagechime
description: Project-specific durable guidance for Pagechime · Read & Listen.
---

# Pagechime · Read & Listen

## Purpose
An installable personal library for reading book pages while listening to synchronized narration.

## Source of truth
- Read `AGENTS.md` first.
- Use `docs/PROJECT-MEMORY.md` for durable architecture, commands and boundaries.
- Use `docs/CURRENT-HANDOFF.md` for unfinished task state.
- Use `docs/REQUIREMENTS.md` for accepted requirements.

## Branch flow
- Integration: `develop`
- Production: `main`
- Ordinary work: temporary feature/fix/chore branch → `develop`
- Release: `develop` → `main` only after required checks and explicit approval.

## Project rule
Do not invent missing architecture, credentials, external-system identity or production state. Verify against current source/runtime/tool evidence.
