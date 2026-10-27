# Design System Contract

Material frontend work should make visual decisions explicit and reusable.

Record only tokens the product needs:
- semantic foreground/surface/border/accent/status colors;
- typography families, weights, sizes, line heights and roles;
- spacing scale and layout/container rules;
- radii and elevation;
- breakpoints/responsive behavior;
- motion duration/easing/spring presets and reduced-motion behavior.

## Component-state contract
For relevant reusable components verify normal, hover, focus, disabled, loading, error, empty/open/selected states and realistic long/localized content.

## Responsive contract
Define the smallest meaningful viewport matrix. For a material web redesign, verify at least one ordinary desktop and one narrow mobile viewport.

## Performance
Fonts, images, animation/runtime JavaScript and large assets must be checked against the project's performance budget.
