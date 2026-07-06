# Project Rules

## Documentation

Whenever you make a significant change:

- Update the relevant file in `/docs/context/`.
- Never overwrite unrelated documentation.
- Create new documentation files if a new subsystem is introduced.
- Keep documentation concise but complete.

## Changelog

After every completed task:

- Add an entry to `/docs/changelog/YYYY-MM-DD.md`
- Include:
  - What changed
  - Why it changed
  - Files modified
  - Breaking changes (if any)

## Architecture

If architecture changes:

- Update `/docs/context/architecture.md`
- Update diagrams if necessary.

## Features

Whenever a feature is added:

- Create or update `/docs/features/<feature>.md`
- Include:
  - Overview
  - Flow
  - APIs
  - Database changes
  - Future improvements

## Decisions

Whenever a technical decision is made:

Update `/docs/context/decisions.md`

Include:

- Decision
- Reason
- Alternatives considered
- Tradeoffs

## Never

- Delete documentation unless explicitly instructed.
- Leave documentation outdated.
- Put unrelated information into the same document.docs/

context/
    product.md
    vision.md
    architecture.md
    coding-standards.md
    tech-stack.md
    dependencies.md
    database.md
    api.md
    ui-design.md

features/
    auth.md
    dashboard.md
    users.md
    notifications.md
    analytics.md

decisions/
    ADR-001-auth.md
    ADR-002-db.md
    ADR-003-theme.md

tasks/
    todo.md
    in-progress.md
    completed.md

bugs/
    known-issues.md
    fixed.md

changelog/



