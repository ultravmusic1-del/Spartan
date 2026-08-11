# Spartan — design conventions

Spartan is an industrial brand with two divisions: **Electricals** (lighting,
fans, pumps, cables) and **Safety** (helmets, eye/hearing protection, gloves,
footwear, fall arrest, workwear). The visual language is dark, dense and
industrial — near-black surfaces, one saturated red, heavy condensed display
type.

**This project ships tokens and styles only — there are no components.** The
Spartan source is an Astro application, not a component library, so there is
nothing compiled to render here. Build layouts yourself with plain HTML and the
CSS custom properties below; that is the whole idiom.

## Setup

No provider, no wrapper, no JavaScript. Link `styles.css` and everything below
resolves — it `@import`s the fonts, the tokens and the base layer in that order.

`<body>` is already dark (`--color-black`) with white text. Put page content in
`.wrap` to get the site's measure (`max-width: 1240px`, responsive gutter).

## The styling idiom: CSS custom properties

There are **no utility classes and no component props**. Every colour, family,
measure and easing is a `var(--*)` read off `:root`. Only two real class names
exist: `.wrap` (page container) and `.on-light` (marks a light section).

**Surfaces** — `--color-black` `#08080a` (page) · `--color-panel` `#0e0e11`
(alternating dark section) · `--color-card` `#151519` (dark card) ·
`--color-line` `#232329` (dark border) · `--color-paper` `#f6f6f7` (light
section) · `--color-paper-line` `#e4e4e7`

**Text** — `#fff` on dark · `--color-ink` on light · `--color-grey-lt` body copy
on dark · `--color-grey` muted on dark · `--color-ink-muted` muted on light

**Red** — `--color-red` `#eb2927` is the brand colour, and there are three
siblings because one red cannot clear WCAG AA everywhere. Picking the wrong one
is the single most likely mistake here, so the rules are absolute:

| Use | Token |
|---|---|
| Small red **text on a dark surface** | `--color-red-light` |
| Small red **text on a light surface** | `--color-red-deep` |
| A red **surface carrying white text** | `--color-red-fill` |
| Hover on a red surface | `--color-red-dark` |
| Large text, icons, rules, borders, decorative fills | `--color-red` |

"Large" means **≥24px, or ≥18.66px bold**. Bold alone does not make text large —
16px/800 is still normal-size text and still needs `--color-red-light` on dark.

Two rules that catch people out:

- **`--color-grey` is for dark surfaces only.** It measures 3.17:1 on
  `--color-paper` and fails AA outright. On light, muted text is
  `--color-ink-muted`.
- Brand red passes on `--color-black` (4.65:1) but **fails on `--color-panel`
  (4.48:1) and `--color-card` (4.23:1)**. Use `--color-red-light` for small red
  text on all three, so one page never shows two reds a few percent apart.

**Type** — `--font-display` (Archivo) for headings, eyebrows, buttons, numerals
and table headers; `--font-body` (Inter) for paragraphs, specs and form fields.
Both are self-hosted variable fonts covering weight 100–900. Headings default to
700 with `line-height: 1.06` and `letter-spacing: -0.02em`.

**Layout and motion** — `--wrap-max` `1240px`, `--wrap-pad` `32px` (20px under
640px), `--dur-fast` `150ms`, `--dur-base` `220ms`, `--ease-out`.

## Where the truth lives

Read `styles.css` and its three imports before styling anything —
`tokens/tokens.css` carries the measured contrast ratios as comments beside the
values they justify, `tokens/base.css` the reset and type defaults, and
`tokens/fonts.css` the `@font-face` blocks.

## Example

```html
<section style="background: var(--color-panel); padding: 64px 0;">
  <div class="wrap">
    <p style="font-family: var(--font-display); font-size: 12px; font-weight: 700;
              letter-spacing: 0.16em; text-transform: uppercase;
              color: var(--color-red-light);">
      Safety Division
    </p>

    <h2 style="margin-top: 16px; font-size: 44px; text-transform: uppercase;">
      Hand <span style="color: var(--color-red);">Protection</span>
    </h2>

    <p style="margin-top: 16px; max-width: 60ch; color: var(--color-grey-lt);">
      Eleven cut-, impact- and chemical-resistant gloves.
    </p>

    <a href="/catalogue" style="display: inline-flex; align-items: center;
       min-height: 44px; margin-top: 28px; padding: 0 24px;
       background: var(--color-red-fill); color: #fff;
       font-family: var(--font-display); font-weight: 700;
       text-transform: uppercase; letter-spacing: 0.04em;">
      Browse catalogue
    </a>
  </div>
</section>
```

Note the three reds doing three different jobs: `--color-red-light` on the small
uppercase eyebrow, `--color-red` on the 44px heading, `--color-red-fill` behind
white button text. That is the system working.
