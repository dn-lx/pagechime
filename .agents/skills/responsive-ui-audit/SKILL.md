---
name: responsive-ui-audit
description: Systematically audit responsive web UI across a fixed viewport matrix using rendered-browser evidence, geometry checks, accessibility checks and targeted screenshots, with special emphasis on mobile overflow, clipping, stacking and touch usability.
---

# Responsive UI Audit

Use for a **broad responsive-quality audit**: "check the mobile view", "find responsive UI problems", "review breakpoints", or "verify the frontend before release".

For one already-known defect, start with `frontend-verification`. For a broad breakpoint sweep, use this skill **with** `frontend-verification`.

This skill finds and prioritizes defects. It does not invent a new visual direction. Load the Design Stack / Impeccable / Taste only when the user wants redesign or polish after the findings are established.

## Default viewport matrix

Unless the product defines its own matrix, test:

| Width | Intent |
| ---: | --- |
| 375 px | narrow modern phone |
| 390 px | common iPhone-class width |
| 430 px | large phone |
| 768 px | tablet portrait |
| 1024 px | tablet landscape / small desktop |
| 1440 px | ordinary desktop |

Add 320/360 only when explicitly supported or when 375 reveals a threshold problem.

Use a realistic height, but treat width as the primary responsive variable.

## Evidence rule

Source inspection is not enough. Audit the **rendered page from the same commit** being reviewed. A local server, local preview artifact, branch preview or deployed preview is acceptable; public deployment is not required.

For each material surface:
1. render the page,
2. complete the primary interaction path,
3. inspect screenshots visually,
4. inspect geometry/computed styles for ambiguous defects,
5. inspect console errors,
6. inspect failed network requests when applicable.

Never call an audit complete because screenshots were generated. They must be inspected.

## Audit order

### 1. Page-level geometry
At every target width check:
- unintended horizontal page scroll,
- elements outside the viewport,
- clipped headings/buttons/controls,
- negative-positioned decoration leaking into scroll width,
- fixed/sticky elements covering content,
- unexpected minimum widths,
- containers wider than their parent,
- viewport-height sections that hide content.

Playwright pattern:

```js
const geometry = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth
  const offenders = [...document.querySelectorAll('body *')]
    .map(el => {
      const r = el.getBoundingClientRect()
      return {
        tag: el.tagName,
        id: el.id,
        cls: typeof el.className === 'string' ? el.className : '',
        left: r.left,
        right: r.right,
        width: r.width,
      }
    })
    .filter(x => x.width > 0 && (x.left < -1 || x.right > vw + 1))
    .slice(0, 40)

  return {
    clientWidth: vw,
    scrollWidth: document.documentElement.scrollWidth,
    offenders,
  }
})

expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1)
```

Ignore intentionally off-canvas elements only after proving they do not create user-visible scroll or obstruction.

### 2. Header and navigation
Check logo size, collapse threshold, hamburger visibility and tap target, language/account/action controls, mobile menu open/close behavior, sticky-header height, and anchor/dialog overlap.

### 3. Typography and hierarchy
Check hero wrapping, line-height clipping, body readability, helper text, heading scale, long German/English strings, and CTA wrapping. Do not solve mobile typography by making everything tiny.

### 4. Sections, grids and cards
Check sensible grid collapse, content order, excessive empty height, desktop-sized mobile padding, absolute decoration collisions, card-action visibility and alignment consistency.

### 5. Forms and calculator/product UI
Check input width, native selects, two-column collapse, suffix/prefix visibility, validation states, checkbox/radio/toggle targets, sticky result behavior, summary prominence and focus states.

### 6. Touch usability
For primary mobile controls, target a practical hit area around **44×44 CSS px**. Inline links may be smaller if spacing prevents accidental activation.

### 7. Images and media
Check object-fit/cropping, logo distortion, media-induced width, and whether decorative media should be reduced on mobile.

### 8. Motion and interaction states
Check reveal content remains visible, transforms do not clip, hover-only affordances work on touch, reduced motion is respected, and menus/modals/accordions remain closable.

### 9. Accessibility and contrast
When available, run `@axe-core/playwright` on representative desktop and mobile states. Inspect contrast, focus visibility, headings, labels, accessible names, landmarks, dialog semantics and keyboard access.

### 10. Runtime health
Inspect console errors, failed relevant requests, hydration/runtime warnings, broken assets and exceptions after responsive interactions. Use Lighthouse mobile when performance/layout stability is in scope.

## Screenshot strategy

Keep evidence purposeful:
- full-page or key-section screenshot at 390 px,
- 430 px only where behavior differs,
- one tablet screenshot where layout changes,
- one desktop screenshot at 1440 px.

For calculators/forms, capture the form-to-result transition.

## Defect severity

- **P0 — blocking:** page or primary task unusable.
- **P1 — major:** serious overflow/overlap, hidden primary CTA, broken menu/form, unreadable core content.
- **P2 — moderate:** hierarchy, spacing, wrapping, alignment or touch-target defect that materially reduces quality.
- **P3 — polish:** minor rhythm, consistency or refinement issue.

Do not inflate severity for subjective preference alone.

## Audit report format

For every finding record:
- severity,
- viewport,
- page/surface,
- exact element/selector when known,
- what is wrong,
- evidence,
- likely root cause,
- proposed fix.

Example:

```md
P1 · 375 px · Calculator · .result-card
The sticky result panel overlaps the last form control.
Evidence: result top=642px while control bottom=701px.
Likely cause: desktop sticky positioning survives the mobile breakpoint.
Fix: set position:relative; top:auto below <=900px and verify 375/390/430.
```

## Repair loop

Fix structural/high-severity issues first:
1. reproduce at failing viewport,
2. identify root layout/token/component cause,
3. make the smallest coherent fix,
4. rerender the same viewport,
5. verify the defect is gone,
6. check one adjacent breakpoint,
7. after structural fixes, rerun the full matrix.

Do not compensate for a broken container with unrelated pixel nudges.

## Design-quality pass

After responsive structure is clean, review hierarchy, spacing rhythm, information density, CTA priority, visual balance, mobile simplification and design-system consistency. If this changes visual direction, explicitly switch to the project design workflow.

## Companion skills

- `frontend-verification` — rendered runtime owner; pair for material browser verification.
- `accessibility-visual-regression` — axe checks / stable screenshots.
- `performance-budget` — rendering/assets/network performance.
- Design Stack / Impeccable / Taste — redesign/polish only after findings are established.

## Completion gate

A responsive audit is complete only when:
- the required viewport matrix was exercised or documented as unavailable,
- no unintended horizontal scroll remains,
- primary navigation and task flows work on mobile,
- major clipping/overlap/tap-target defects are resolved or recorded,
- representative screenshots were visually inspected,
- console/runtime failures were reviewed,
- remaining findings are explicitly listed with severity.

Do not claim responsiveness from CSS media queries alone.
