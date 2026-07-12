@AGENTS.md

# Design system (READ BEFORE ANY UI WORK)

Kiko AI Mobile has a token-first design system rooted in Apple's HIG + "Designing Fluid Interfaces". Full rules and the natural-language → token map are in **[docs/design-system.md](docs/design-system.md)** — consult it before touching UI.

## Hard rules

- **Never hardcode design values.** Colors, radii, shadows, spring params, opacity, spacing — all come from `@/theme`. Adding a new value? Add it to `src/theme/*.ts` first, then use it.
- **Import from `@/theme`.** Not `@/constants/*`, not raw libs. `src/theme/index.ts` re-exports everything.
- **Springs for gesture-driven motion.** `Motion.*` presets are the default. `withTiming` is reserved for non-touchable elements (toasts, tooltips).
- **Translucent surfaces go through `GlassSurface`.** Combine with a `Glass.*` level. Never call `expo-glass-effect` primitives directly outside that component.
- **iOS system colors adapt automatically.** Use `IOSColors` for anything non-branded; use `BrandColors` / `BrandRole` for identity-carrying surfaces.

## When a natural-language design request comes in

1. Open `docs/design-system.md` and find the request's phrasing in the token map.
2. If no mapping exists, treat it as a documentation bug: propose a token + add the mapping.
3. Consult `.claude/skills/apple-design/SKILL.md` before designing a new interaction — it captures the "why" behind spring parameters, interruptibility, and translucent materials.
4. Cite the tokens used in commit messages / PR descriptions so reviewers can trace decisions.

## Skills available in this repo

Under `.claude/skills/` (auto-loaded per session):

- `apple-design` — foundations for gesture/motion/material choices.
- `animation-vocabulary` — shared motion vocabulary.
- `improve-animations` — audit + prioritized motion plan for existing screens.
- `review-animations` — motion review of a single diff.
- `emil-design-eng` — general design-engineering craft.
