# Pagechime visual system

The accepted product is a personal reading app, not a marketing landing page. This product brief overrides the upstream design generator's marketing-section suggestions.

- Direction: a quiet editorial reading room; warm paper, olive green, generous space, a small terracotta book-cover accent.
- Tokens: paper #fffefb, canvas #f5f3ec, ink #292e24, secondary text #686e60, olive #65704f, soft olive #e9eddf, line #dfdfd3. Dark theme uses #242920 canvas, #2d3329 paper and #eceee4 text.
- Typography: Newsreader for reading/headlines, DM Sans for navigation/controls. No remote font calls at runtime. Text 19–26px, line-height 1.8, measure about 60 characters.
- Layout: library sidebar, asymmetric welcome/featured-book composition; focused reader with narrow paper page. At 768px and below use one column and an accessible drawer, leaving room for the persistent player and safe-area insets.
- Motion: 180–300ms opacity/transform; shared cover transition and short list staggers. Motion React only in isolated client components. Honour prefers-reduced-motion and keep frequent reading actions immediate. No decorative perpetual movement beside reading text.
- Controls: 44px targets, named icon buttons, visible keyboard focus, native dialog semantics, clear errors and disabled/loading states. No colour-only status.
- Evidence: desktop 1440×1000, mobile 390×844, night theme, import modal, PDF view and reduced-motion checks. Initial application JS budget 300KB gzip excluding lazy PDF engine and immutable media.
- References: Taste Skill revision 37c8c376b92ebc02456f7c70776b514fddda88e1; UI/UX Pro Max revision d14efff8ed1faa4187f004f79926f428c8074ec7. Read as guidance, no third-party installer hooks enabled.
