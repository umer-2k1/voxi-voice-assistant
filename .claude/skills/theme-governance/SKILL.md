---
name: theme-governance
description: Enforces UI theme consistency with the project palette, typography, spacing, and visual states. Use when creating or updating frontend UI components, pages, design tokens, or styling behavior.
disable-model-invocation: true
---

# Theme Governance

## Goal

Keep the UI aligned with the product visual language defined in `REQUIREMENT.md` and `design-theme.png`.

## Required Tokens

- Primary: `#1E3A8A`
- Accent: `#3B82F6`
- Cyan highlight: `#06B6D4`
- Dark background: `#0F172A`
- Card surface: `#1E293B`
- Border: `#334155`
- Text primary: `#F1F5F9`
- Text secondary: `#94A3B8`

## Rules

1. Prefer shared UI primitives in `frontend/src/components/ui`.
2. Use existing CSS variables and Tailwind utilities before adding custom CSS.
3. Keep hover/active/focus states visibly distinct and accessible.
4. Maintain spacing scale in 4px increments.
5. Keep typography hierarchy clear:
   - page title > section title > body > metadata

## Validation Checklist

- [ ] New UI uses existing tokens or mapped equivalents.
- [ ] Card/button/input styles remain consistent with app shell.
- [ ] Dark-mode readability is preserved.
- [ ] No ad-hoc, one-off styling without documented reason.
