# EPS-TOPIK — Flat Editorial V7

## Basis
This implementation follows the supplied Full UI & UX Design Brief: design principles, visual direction, tokens, screen inventory, user flows, reusable component states, system states, responsive behavior, and accessibility.

## Visual direction
Flat editorial educational UI inspired by the supplied reference: solid color fields, large typography, generous whitespace, minimal borders, no glassmorphism, no decorative glow, no large gradients, and no heavy shadows.

## Global changes
- Desktop: fixed flat navigation rail.
- Mobile: flat top header + flat bottom navigation.
- All screens share one spacing, type, color, border, radius, and button system.
- Inline SVG icons replace decorative emoji/icons in interactive UI.
- Cards use borders and solid surfaces rather than floating effects.
- Quiz, flashcard, vocabulary, chapter, statistics, result, modal, toast, and system states use the same visual language.
- Responsive behavior is defined for desktop, tablet, and mobile.
- Focus-visible states and semantic controls are retained.

## Preserved product behavior
- 2,355 vocabulary entries
- Bab 1–30
- `vocabulary.json` and `chapters.json` unchanged
- Quiz logic, flashcards, audio, progress, XP, statistics, backup/restore, localStorage, and PWA behavior retained.

## Validation
- JavaScript syntax checked with Node.
- JSON data parsed successfully.
- ZIP integrity checked after packaging.
- Full browser E2E could not be completed in the build environment because Chromium headless timed out; this is not represented as a passing browser test.
