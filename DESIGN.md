# Typing Trainer

> Category: Education & Productivity
> Focused typing practice product. Kinetic, precise, keyboard-first — never generic SaaS chrome.

## Visual Theme & Atmosphere
A practice room, not a dashboard. Dark ink on warm paper with one electric accent for speed and accuracy feedback. Motion should feel like key travel: short, tactile, decisive.

## Color Palette & Roles
- **Background:** `#F3EDE3` — warm paper
- **Foreground:** `#1A1814` — near-ink
- **Accent:** `#0F7A5A` — deep teal for primary CTAs and “correct” feedback
- **Muted:** `#6E665C` — secondary labels, hints
- **Border:** `#D9D0C3`
- **Surface:** `#FFF9F1` — panels, active practice area
- **Success:** `#0F7A5A`, **Warn:** `#C47A12`, **Danger:** `#B42318`
Never invent hex outside this palette. Never default to purple, indigo glow, or cool gray SaaS skins.

## Typography Rules
- **Display / brand:** `'Fraunces', Georgia, serif`, weight 600–700
- **UI / body:** `'IBM Plex Sans', 'Segoe UI', sans-serif`, weight 400–500
- **Mono / typing stream:** `'IBM Plex Mono', ui-monospace, monospace`, weight 400–500
- Scale (px): 12 · 14 · 16 · 18 · 24 · 36 · 56
- Line-height: 1.5 body, 1.15 display
- Letter-spacing: -0.02em on display ≥36px; +0.02em on mono practice text

## Component Stylings
- **Buttons:** 6px radius, firm padding. Primary = teal fill, cream label. Secondary = 1px border on paper, ink label.
- **Practice stage:** full-bleed surface, not a floating card. Large mono text, generous tracking.
- **Inputs:** 1px border, 6px radius, teal focus ring at 2px / 20% opacity.
- **Stats:** inline typographic figures — not stat-card grids in the first viewport.

## Layout Principles
- One composition per viewport. Brand name is hero-level; no competing headline stack.
- First viewport budget: brand, one line of intent, one CTA group, one dominant practice visual.
- No cards in the hero. Cards only when they contain a real interaction.
- Max content width 1120px; practice stream can go wider for immersion.
- Section spacing: 72px desktop, 48px tablet, 32px phone.

## Depth & Elevation
- Default: flat paper.
- Raised only for menus / modal focus: soft 0 8px 24px ink at 8% opacity.
- No multi-layer shadows, no glassmorphism, no glow blobs.

## Motion
- Key-correct: 120ms opacity/translateY settle.
- Key-error: 180ms horizontal shake, then settle.
- Route / panel enter: 240ms fade + 8px rise.
Ship at least 2–3 intentional motions; never ambient particle noise.

## Do's and Don'ts
- ✅ Brand first. If you remove the nav and the page could belong to another product, branding is too weak.
- ✅ Keyboard realism: caret, WPM, accuracy as typographic signals.
- ✅ Verify mobile and desktop before finishing.
- ❌ No purple-on-white themes, cream+terracotta clichés, or broadsheet newspaper layouts.
- ❌ No hero overlays, floating badges, pill clusters, or stat strips in the first viewport.
- ❌ No Inter / Roboto / Arial as the expressive display face.

## Responsive Behavior
- **Desktop ≥ 1024px:** practice stage dominant; side chrome minimal.
- **Tablet 640–1023px:** stack chrome above stage; keep mono readable ≥16px.
- **Phone < 640px:** brand + CTA + stage only; defer secondary stats below the fold.

## Agent Prompt Guide
- Always read this file and `design-systems/typing-trainer/tokens.css` before generating UI.
- Prefer the `frontend-design` skill for production UI and `taste-skill` when visual direction is weak.
- Output real HTML/CSS (or the repo’s framework) with CSS variables from `tokens.css`, not invented tokens.
- For Open Design daemon workflows, attach design system id `typing-trainer` and skill `frontend-design`.
