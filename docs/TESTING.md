# Testing

## How to run

```bash
npm run check      # typecheck + lint + unit tests + production build
npm run test:e2e   # Playwright at 4 viewports + axe accessibility
```

Viewports: iPhone SE (375×667), Pixel 7 (412×915), tablet 768×1024, desktop 1280×800.

## Layers

| Layer         | Tool                      | Covers                                                                                |
| ------------- | ------------------------- | ------------------------------------------------------------------------------------- |
| Unit          | Vitest + Testing Library  | Component behaviour, pure logic                                                       |
| Database      | pgTAP (from stage 2)      | RLS policies and RPCs as owner / partner / outsider / anon                            |
| End-to-end    | Playwright                | Real user journeys; two isolated browser contexts for two-person flows (from stage 3) |
| Accessibility | axe via Playwright        | WCAG 2.1 AA; serious or critical violations fail the build                            |
| Performance   | Lighthouse (from stage 7) | Mobile perf ≥ 90, a11y ≥ 95 targets                                                   |

## Verified so far — 2026-11-04 (stage 0–1)

Environment: Linux sandbox, Node 22, headless Chrome (system), production build served by `vite preview`.

- `npm run check`: pass (9 unit tests).
- Playwright: **32/32 pass** across 4 viewports:
  - `/`, `/styleguide`, unknown route render with no console errors and no horizontal overflow.
  - No serious/critical axe violations (includes colour contrast) on all three pages.
  - Every button on the style guide is at least 44×44 px.
  - Dialog opens, closes on Escape, and returns focus to its trigger.
- Visual review of screenshots at 360, 390, 768 and 1280 px.

Not yet verified: real iPhone Safari / Android Chrome hardware, slow-network behaviour (no networked features yet), Lighthouse scores.
