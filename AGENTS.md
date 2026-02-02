# AGENTS — campaign-viz

Guidance for AI/automation agents working in this repository. Keep edits minimal, privacy-safe, and aligned with the existing architecture.

## Project Snapshot

- Purpose: Interactive visualization of the Karlsruhe 2026 campaign (house visits + poster placements) with timeline playback.
- Stack: Vite 7 + TypeScript (strict) + Leaflet + date-fns + Tailwind CSS v4 (via `@tailwindcss/vite`).
- Entry point: `src/main.ts` renders the UI (`components/template.ts`), wires map (`MapController`), timeline (`TimelineController`), stats, and celebrations.
- Hosting: `vite.config.ts` sets `base` to `/${GITHUB_REPOSITORY#*/}/` in production for GitHub Pages; local dev uses `/`.

## Runbook

- Install: `npm install` (Node 20+ recommended for Vite 7).
- Dev server: `npm run dev` → open http://localhost:5173.
- Build: `npm run build`; Preview: `npm run preview`.
- Lint/format: `npm run format` (write) / `npm run format:check`.
- Data transform: `npm run transform` (runs `scripts/transform-export.ts` via tsx).

## Data & Privacy

- Source data lives in `src/data/activity-files/*.json` (already blurred). If none exist, synthetic data is generated.
- Raw exports belong in `raw-exports/` (gitignored). Do **not** commit raw data. `npm run transform` reads that folder, blurs coords (30–100m), aggregates to ~100m grid, and writes `<name>-transformed.json` into `src/data/activity-files/`.
- Date range is derived from the loaded data (`getDateRange`); `START_DATE`/`END_DATE` in `src/config.ts` only seed the synthetic generator.
- Keep any new data blurred; avoid reducing blur radius unless explicitly requested.

## Architecture Map

- `src/config.ts`: Map styles, timeline constants, marker styling, celebration thresholds. Default map style id: `carto-dark`.
- `src/components/MapController.ts`: Leaflet setup, marker lifecycle, tooltip formatting, style switching (`data-map-style` buttons + `<select>`).
- `src/components/TimelineController.ts`: Slider + playback loop, keyboard shortcuts (Space, F), fullscreen/ad mode timing, activity filtering, Cem mode toggle.
- `src/components/StatsController.ts`: Final overlay stats.
- `src/components/FaceCelebration.ts`: Triggered when counts reach `FACE_TRIGGER_*`; face images auto-discovered from `public/faces/*`.
- `src/data/activities.ts`: Loads/normalizes activities, computes visibility windows, filters by date/type, blurs coords when needed.
- `src/utils/*`: DOM helpers, deterministic random, privacy blur.
- Styling: `src/style.css` (Tailwind layer + custom CSS variables, animations, responsive layout). Prefer extending here over ad-hoc styles.

## Configuration Knobs

- Map styles: edit `MAP_STYLES` in `src/config.ts`; keep `attribution` intact to satisfy tile provider terms.
- Timeline: `BASE_DAYS_PER_MS`, `UPDATE_INTERVAL_DAYS`, `RECENT_MARKER_COUNT`, `AD_MODE_DURATION_MS`.
- Visuals: marker radii/colors, `FACE_MAX_ACTIVE`, celebration trigger thresholds.
- Faces: drop new assets in `public/faces/`; filenames auto-sorted into the celebration carousel.

## Development Conventions

- Prefer `rg` for search; use `apply_patch` for targeted edits.
- Keep code TypeScript-strict; favor small, typed helpers over inline any-casting.
- Maintain privacy: never output raw coordinates or unblurred data; keep `raw-exports/` out of commits.
- UI: follow existing visual language (sand/limette/salbei palette; rounded chips; bottom menu). Avoid introducing new fonts unless justified.
- Tests are absent; validate with `npm run build` and manual smoke (map renders, timeline plays, filters work, fullscreen loop resets).

## Common Pitfalls

- Forgetting `GITHUB_REPOSITORY` in CI can break production `base`; set it when running `npm run build` for deploys.
- Adding data without blur will leak exact addresses—ensure blur or use `--no-blur` only with explicit approval.
- `MapController` caches markers; when changing marker keys/precision, update `createActivityKey` to avoid ghost markers.
- `TimelineController` uses fractional `dayOffset`; if you change `UPDATE_INTERVAL_DAYS`, ensure slider `step` matches the new granularity.
- `FaceCelebration` respects `cemMode`; altering thresholds without adjusting UI copy can confuse users.

## Quick File References

- `src/config.ts`
- `src/components/MapController.ts`
- `src/components/TimelineController.ts`
- `src/components/FaceCelebration.ts`
- `src/data/activities.ts`
- `scripts/transform-export.ts`
- `src/style.css`
- `public/faces/`, `raw-exports/` (gitignored source), `src/data/activity-files/` (bundled data)

## When in Doubt

- Ask before changing privacy behavior or deployment base paths.
- Keep edits scoped; avoid refactors that touch generated `dist/` or `node_modules/`.
- If something seems unexpectedly changed in the working tree, pause and clarify before proceeding.
