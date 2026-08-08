# Spartan — catalogue site

A catalogue and lead-generation site for an industrial brand with two divisions
(Electricals, Safety). **72 products across 15 categories.** Not e-commerce: no
prices, no cart, no checkout, no accounts. The conversion mechanism is a
multi-product enquiry basket that submits one RFQ.

Astro 7 · TypeScript strict · Tailwind 4 · Preact islands · nanostores · Vercel.

## Read these

- `handoff.md` — the full history, the measured decisions, and every trap that
  fails silently. Read it before changing anything you have not touched before.
- `README.md` — setup, scripts, architecture, launch checklist.
- `BACKLOG.md` — the current work queue.
- `docs/CONTENT-EDITING.md` — maintaining the catalogue without being a developer.

## Four rules

**1. Never invent product data.** No specification, certification, rating,
dimension or description unless you can name its source. Every value traces to
the client's brochure PDF, which is **not in this repo and not on this machine**
— so in practice a new product fact cannot be sourced at all. Missing data stays
missing and gets an honest empty state. This is safety equipment: a fabricated
protection rating is a hazard, not a cosmetic defect.

**2. Never report an enquiry as sent when it was not.** `/api/enquiry` returns
`delivered: false` when credentials are absent, and the UI must respect it.

**3. The admin seam holds.** No page or component may import from `src/data/*`
(except `site.json`) or call `getCollection`. Everything goes through
`src/lib/catalog.ts`. This is what makes the future CMS a one-module change.

**4. Colour is measured, not chosen.** Small red text on dark uses
`--color-red-light`; red surfaces under white text use `--color-red-fill`; small
red text on light uses `--color-red-deep`. Large means ≥24px or ≥18.66px bold —
bold alone does not make text large. Measured ratios for every pair are in
`handoff.md` §3. Do not reason about contrast from memory.

## Verify

```bash
npm run verify            # typecheck, unit tests, invariants, build, output sweeps
npm run verify -- --full  # ... and the Playwright e2e suite
```

`npm run verify` is the gate. It enforces the admin seam, the catalogue's shape,
and that no price or rating ever reaches structured data. **Never weaken a gate
to make it pass.**

Stop the dev server before any e2e run — Playwright attaches to whatever is
already on :4321 instead of building, which produces confident, unrelated
failures.

**Never run `npm audit fix --force`.** The 3 high findings are one chain with no
upstream fix; npm's offered fix reintroduces 8 XSS advisories.

## Development

```bash
npm run dev       # astro dev
npm run build     # -> dist/client/ + .vercel/output/
npm run preview   # tests/preview-server.mjs, NOT astro preview
```

Static pages build to `dist/client/`, not `dist/` — the one SSR route
(`/api/enquiry`) puts the Vercel adapter into hybrid mode.

## Improvement loop

`/improve` runs one backlog item end to end and commits it to
`agent/improvements`. See `.claude/commands/improve.md`.
