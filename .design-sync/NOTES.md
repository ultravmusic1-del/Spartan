# design-sync notes

First sync: 2026-08-09. Project **Spartan Design Tokens**
(`63cd21be-7d40-463b-8443-c5803a84575b`), pinned in `config.json`.

## Read this before changing scope

**This repo is an Astro application, not a component library.** The sync is
deliberately `"scope": "tokens-only"` and the converter (`package-build.mjs`)
was never run — it has nothing to bundle. Established by inspection:

- `package.json` declares no `main`, `module`, `exports` or `files`.
- `dist/` is `dist/client/` — 97 built HTML pages, not compiled components.
- **26 of 32 components are `.astro`.** They compile to Astro's own server
  renderer and cannot load as React components in a design runtime. This is a
  format incompatibility; no config or escape hatch changes it.
- The other 6 are Preact islands (`compat: false`) bound to the `enquiry`
  nanostore and `/api/enquiry` — application behaviour, not design language.

Reimplementing them as React was considered and rejected: the base skill's core
principle is "ship what the customer already built, never a reimplementation",
and a reimplementation would drift from the live site invisibly.

**Shipping components would require extracting a real component library from the
site first** — a separate project with its own build, not a config change.

## How the layout was produced

Off-script, per base SKILL.md §2 ("produce the layout by whatever means the repo
allows"). Hand-assembled into `ds-bundle/`, then gated with the real validator.

- `_ds_bundle.js` is a valid IIFE with the required first-line `@ds-bundle`
  header and **exports nothing** — `window.SpartanDS = {}`. `componentCount: 0`
  is a first-class case in `package-validate.mjs` (its line 96 comment names
  "tokens-only sync" explicitly), so this is supported, not a workaround.
- `_ds_sync.json` was generated with the skill's own `lib/sync-hashes.mjs`
  (`styleShaFor`/`auxShaFor`/`scriptsShaFor`) rather than invented, so a future
  re-sync can diff the styling surface honestly.
- `tokens/base.css` is derived from `src/styles/global.css` **minus** three
  things that do not travel: `@import 'tailwindcss'`, `@import './enquiry.css'`
  (app-specific islands), and the `@theme inline` block (a Tailwind v4 directive
  that is meaningless outside it). If `global.css` changes, re-derive it.

## Traps hit — do not rediscover these

**`fonts.css` needs `../fonts/`, not `./fonts/`.** It lives in `tokens/`, and CSS
`url()` resolves relative to the stylesheet, not the bundle root. `./fonts/`
silently resolves to `tokens/fonts/` and every glyph falls back to system-ui.
The staging step rewrites the site's absolute `/fonts/` with `sed`.

**`package-validate.mjs` takes the out-dir POSITIONALLY**, not as `--out`.
`node package-validate.mjs ./ds-bundle` — `--out ./ds-bundle` prints usage and
exits 1.

**`[RENDER_SKIPPED]` is expected here and needs `--no-render-check`.** The
validator refuses to skip its render check silently, but bare `playwright` is not
importable from the skill's location (this repo has `@playwright/test`). With
zero components there are also zero `.html` preview cards, so the check has
nothing to render — the warning is vacuous, not suppressed. Confirmed by
`find ds-bundle -name '*.html' | wc -l` → 0.

## Re-sync risks (watch-list)

1. **`src/styles/tokens.css` is the source of truth and carries its measured
   contrast ratios as comments.** If a value changes, the ratio comment beside
   it, `guidelines/contrast.md` and `.design-sync/conventions.md` all go stale
   together. Re-run the validation pass in the base skill's conventions step —
   it greps every token and hex claimed in the header against the built CSS.
2. **`conventions.md` hard-codes 7 hex values.** They were verified against the
   build at sync time. Re-verify rather than trust them.
3. If `.astro` components are ever ported to a real framework package, revisit
   `"scope"` — but only with a genuine build to bundle.

## What is NOT uploaded, and why

`ds-bundle/` is a build artifact and is gitignored. The durable inputs are
`config.json`, `conventions.md` and this file. `.ds-build-meta.json` stays local
by the skill's stays-local rule (dot-prefixed root entries).
