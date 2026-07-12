# Kiko AI Mobile — Design System

Kiko AI's visual language is grounded in Apple's Human Interface Guidelines and the "Designing Fluid Interfaces" (WWDC 2018) principles, translated for React Native + Expo SDK 56 (Liquid Glass, `PlatformColor`, Reanimated 4 springs).

**Purpose**: When someone (person or AI agent) is asked in natural language to "build a login card" or "make the header feel snappy", they should be able to map the request to tokens defined here without guessing. Hardcoding a color, a duration, or a shadow is a design bug.

---

## Core rules

1. **Never hardcode.** If a value looks like `#...`, `600ms`, `borderRadius: 12`, or `shadowOpacity: 0.1`, it should come from `@/theme`. If the token doesn't exist yet, add it here first.
2. **Import from `@/theme`, not `@/constants/*` or raw libs.** `@/theme/index.ts` re-exports everything. One path, one place to look.
3. **iOS-first tokens adapt automatically.** `IOSColors` uses `PlatformColor` under the hood, so dark mode, increased contrast, and reduced transparency inherit from the OS. Never rewrite that logic in a component.
4. **Springs, not timing curves, for anything gesture-driven.** `withTiming` is only for non-touchable elements (toasts, tooltips). Everything else uses `Motion.*` presets from `@/theme`.
5. **Consult the `apple-design` skill before designing new interactions.** Location: `.claude/skills/apple-design/SKILL.md`. It captures the "why" behind spring parameters, interruptibility, direct manipulation, and translucent materials.

---

## Natural-language → token map

When a request comes in, the agent (or a human) picks tokens as follows.

### Motion / animation

| Natural language | Token |
|---|---|
| "slide it in", "make it move" | `Motion.move` |
| "snappy tap feedback", "quick chip animation" | `Motion.snappy` |
| "bottom sheet feel", "drawer", "swipe to dismiss" | `Motion.drawer` |
| "rotate it in" | `Motion.rotation` |
| "gentle atmospheric shift", "header collapse" | `Motion.gentle` |
| "celebrate", "confetti", "success pop" | `Motion.bouncy` |
| "instant tactile feedback" (non-spring) | `Duration.instant` (100ms) |
| "fade in / out cross-screen" (non-spring) | `Duration.slow` with `Easing.standard` |

### Corner radius

| Natural language | Token |
|---|---|
| "pill", "chip", "capsule" | `Radius.pill` or `RadiusRole.chip` |
| "button" | `RadiusRole.button` (md) |
| "text field", "input" | `RadiusRole.field` (md) |
| "image tile", "avatar square" | `RadiusRole.image` (lg) |
| "card", "content container" | `RadiusRole.card` (xl) |
| "bottom sheet", "modal" | `RadiusRole.sheet` (xxl, top corners) |

### Elevation / shadow

| Natural language | Token |
|---|---|
| "flat on background" | `Elevation.flat` |
| "just a hint of lift", "pill on content" | `Elevation.raised` |
| "floating input", "composer bar" | `Elevation.lifted` |
| "card standing out on busy screen" | `Elevation.floating` |
| "modal", "sheet from bottom" | `Elevation.overlay` |

### Glass / translucent surfaces

Any translucent surface goes through `GlassSurface` (`@/components/glass-surface`). Pick a level via `Glass.*` and spread into the component.

| Natural language | Token |
|---|---|
| "chip / pill on scrollable content" | `Glass.chip` |
| "floating composer / search bar" | `Glass.composer` |
| "pill floating over a gradient" | `Glass.bareOnColor` |
| "caption over a photo", "spotlight badge" | `Glass.clear` |

Example:

```tsx
import { GlassSurface } from '@/components/glass-surface';
import { Glass } from '@/theme';

<GlassSurface {...Glass.composer} style={styles.searchBar}>
  <TextInput ... />
</GlassSurface>
```

### Colors

Two families:

- **`IOSColors`** — HIG system tokens. Labels, backgrounds, separators, fills. **Use these for anything not overtly branded.** They adapt to dark mode + accessibility automatically.
- **`BrandColors` / `BrandRole` / `BrandGradient`** — Kiko AI's peach identity. Use for CTAs, badges, marketing surfaces, celebratory moments. Not adapted automatically — if it needs to look right in dark mode, wrap in theme-aware logic.

| Natural language | Token |
|---|---|
| "primary text", "body label" | `IOSColors.label` |
| "secondary text", "subtitle" | `IOSColors.secondaryLabel` |
| "placeholder in input" | `IOSColors.placeholderText` |
| "system blue button" | `IOSColors.systemBlue` |
| "background of the screen" | `IOSColors.systemBackground` |
| "row separator", "hairline" | `IOSColors.separator` |
| "brand-y peach CTA" | `BrandRole.primary` |
| "soft brand tint background" | `BrandRole.soft` |
| "login marquee gradient" | `BrandGradient.loginMarquee` |

### Typography

Use `IOSText` presets (HIG scale, iOS 17). Do not invent font sizes.

| Natural language | Preset |
|---|---|
| "big hero title" | `IOSText.largeTitle` |
| "screen title" | `IOSText.title1` |
| "section header" | `IOSText.title2` / `IOSText.title3` |
| "emphasized inline label" | `IOSText.headline` |
| "body copy" | `IOSText.body` |
| "small caption" | `IOSText.caption1` |

Font families come from `IOSFont` (`sans`, `rounded`, `serif`, `mono`). Prefer `rounded` for friendlier surfaces (empty states, brand moments), `sans` for the rest.

### Opacity / dimming

| Natural language | Token |
|---|---|
| "disabled label", "ghosted" | `Opacity.faint` |
| "secondary content" | `Opacity.muted` |
| "backdrop behind bottom sheet" | `Scrim.standard` |
| "full-screen modal scrim" | `Scrim.heavy` |

### Haptics

Not visual, but part of the feel. Use `Haptic.*` (`@/theme` re-exports it) — never call `Haptics.*` directly.

| Natural language | Method |
|---|---|
| "tick", "chip selection" | `Haptic.selection()` |
| "secondary tap" | `Haptic.light()` |
| "primary tap", "Send button" | `Haptic.medium()` |
| "yay, it worked" | `Haptic.success()` |
| "warn but not fail" | `Haptic.warning()` |
| "error, permission denied" | `Haptic.error()` |

---

## Anti-patterns (design bugs)

- `borderRadius: 16` — use `Radius.lg` or `RadiusRole.card`.
- `color: '#007AFF'` — use `IOSColors.systemBlue`.
- `withTiming(0, { duration: 300 })` on a draggable element — use `withSpring(0, Motion.drawer)`.
- `Animated.timing` with hardcoded `easing: Easing.out(...)` — pick a Motion preset.
- Setting `blur` / `backdropFilter` manually — use `GlassSurface` + a `Glass.*` level.
- Copy-pasting the peach hex from login.tsx — import `BrandGradient.loginMarquee`.
- Writing `opacity: 0.5` — use `Opacity.muted`.

---

## Extending the system

1. Add the new token to the right `src/theme/*.ts` file. Match the naming convention (semantic, not metric).
2. Export it from `src/theme/index.ts`.
3. Add a row to the natural-language table above.
4. Update `CLAUDE.md` if the extension changes a rule.

If a token exists but the natural-language mapping is unclear, that's a documentation bug — add the mapping so future work doesn't guess again.

---

## Skills used with this system

Under `.claude/skills/`:

- `apple-design` — the *why* behind every motion + material choice. Always consult before designing a new interaction.
- `animation-vocabulary` — shared vocabulary for describing motion (used when reviewing animations).
- `improve-animations` — audit → prioritized plan for an existing screen's motion.
- `review-animations` — targeted review of a single diff.
- `emil-design-eng` — general design-engineering craft (spacing rhythm, hover states, etc.).

The skills are auto-loaded per Claude Code session — no manual invocation needed. When editing UI they will surface relevant principles.
