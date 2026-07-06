---
name: folder-structure-governance
description: Keeps repository structure modular and predictable by enforcing feature-first organization and clear ownership boundaries. Use when creating files, moving modules, or introducing new domains.
disable-model-invocation: true
---

# Folder Structure Governance

## Goal

Ensure contributors can locate code quickly and extend features without breaking project organization.

## Required Structure

- `frontend/`
  - `src/components/` for reusable UI and shared layout pieces
  - `src/features/<feature-name>/` for domain-specific UI, data, and local types
  - `src/lib/` for cross-feature utilities
- `backend/`
  - `src/` for API server, services, and data access
- `docs/`
  - status tracking and implementation references
- `.cursor/skills/`
  - one skill per concern with isolated purpose

## Rules

1. New feature logic should live in `frontend/src/features/<feature-name>/`.
2. Avoid placing domain logic in generic `components/` unless shared by 2+ features.
3. Keep documentation changes in `docs/` in sync with implementation changes.
4. Do not mix frontend build config with backend runtime config.
5. Keep file names descriptive and domain-specific.

## Validation Checklist

- [ ] New files are placed in the correct domain folder.
- [ ] Shared vs feature-specific code is clearly separated.
- [ ] Docs reflect new architecture or workflow changes.
- [ ] Skill files stay single-purpose and non-overlapping.
