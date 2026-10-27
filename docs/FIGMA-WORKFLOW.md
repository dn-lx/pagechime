# Figma Workflow Contract

Figma is an optional design workspace and handoff layer, not the product or runtime source of truth.

## Authority
1. Accepted requirements and product/brand constraints define intended behavior.
2. Approved design tokens/components define reusable visual rules.
3. Figma may hold the approved visual specification.
4. Production code and runtime evidence define implemented truth.

## When to use Figma
Use it for substantial redesigns, new multi-section surfaces, design-system/component work, or when human visual approval before implementation reduces rework. Skip it for tiny copy, spacing, or isolated bug fixes.

## Required workflow
1. Inspect current code, brand assets, design tokens/components and real states.
2. Capture baseline desktop/mobile states when redesigning an existing product.
3. Establish visual acceptance criteria and a token contract.
4. Inspect existing Figma libraries/components/variables/styles before creating new ones.
5. Build editable semantic layers with components, variables and Auto Layout. A flattened full-UI screenshot is reference only, never the deliverable.
6. Review and approve the visual direction.
7. Implement using the same token/component semantics.
8. Compare implementation against approved Figma states.
9. Run frontend verification, accessibility/visual regression and performance checks.

## Token mapping
Map semantic color, typography, spacing, radius, container/breakpoint and motion tokens between Figma and code. Avoid parallel unnamed values.

## Round trips
Both design → Figma → code and code → Figma → refinement → code are valid.

## Evidence
For material work retain a compact design-review packet: brief/acceptance criteria, relevant Figma reference, token changes, desktop/mobile evidence, accessibility result, performance result and known compromises.
