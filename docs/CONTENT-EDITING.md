# Editing the Spartan catalogue

> **Since 2026-08-23 there is a screen for this: sign in and go to `/admin/catalogue`.**
>
> It lists every product and category, validates a change against the same rules
> the build uses, and records who changed what. **Use it in preference to this
> guide.** It cannot do everything — images, slugs and EN 388 ratings are not
> editable there, and creating a new product is not built yet — so the file
> route below is still the answer for those.
>
> **Read the rules in this guide either way.** They are about the data, not about
> the format, and every one of them applies to the admin screen too.
>
> **And know which source the site is actually reading.** Production has rendered
> the catalogue from **Postgres** since 2026-08-19, so an edit to the JSON files
> below changes nothing on the live site on its own — the JSON is the offline
> fallback (`CATALOGUE_SOURCE=json`) and the seed the database was built from.
> Getting a file edit into production means reseeding the database from it, which
> is a developer's job. An edit made at `/admin/catalogue` needs only a build,
> which the Publish button requests.

This guide is for whoever maintains the product catalogue in the files. You do not need to be a developer, but you do need to edit JSON files carefully.

Four files in `src/data/`:

| File | What is in it |
|---|---|
| `products.json` | All 94 products |
| `categories.json` | All 15 categories |
| `divisions.json` | The two divisions (Electricals, Safety). You will almost never touch this. |
| `site.json` | Phone, email, address, industries. Not catalogue content. |

Product photographs live in `src/assets/products/`.

---

## Before you start

**Five rules. Read them before you touch anything.** Each is explained in full further down, but if you only remember five things, remember these.

1. **Never invent a specification, rating or certification.** If the brochure does not print it, leave the field out. Absent is correct.
2. **A slug is a permanent URL.** Changing one breaks every existing link and throws away that page's search ranking.
3. **`heroProductSlug` must name a product that actually exists**, spelled exactly.
4. **Never upscale a product photo** beyond about 2× the size it came in at.
5. **In EN 388 ratings, `X` and `0` mean different things.** Never swap one for the other.

### How JSON works, in one minute

- Text goes in `"double quotes"`. Numbers do not.
- Items in a list are separated by commas. **The last item in a list gets no comma.** This is the single most common way to break the file.
- `null` means "deliberately nothing". It is not in quotes.
- Curly braces `{ }` hold one record. Square brackets `[ ]` hold a list of them.

**Your safety net has two halves, and you need both.**

- `npm run build` refuses to complete if a record is malformed or missing a required field. You get an error naming the file and the field rather than a broken website.
- `npm run test` checks the *values*: that slugs are unique, that every `heroProductSlug` names a real product, that the counts still add up, that the EN 388 values are what they should be.

Neither catches an invented specification or a plausible-but-wrong value. That is what this guide is for.

**Run both after every edit.** The build alone is not enough — a typo'd `heroProductSlug` builds perfectly happily.

---

## Adding a product

Open `src/data/products.json` and add a record. Here is a real one, complete:

```json
{
  "slug": "grip-guard-gp5",
  "name": "Grip Guard GP5",
  "variantLabel": null,
  "categoryId": "hand",
  "images": ["p16-grip-guard-gp5.png"],
  "specs": [
    { "label": "Liner", "value": "HPPE, Steel, Polyester, Spandex" },
    { "label": "Coating", "value": "PU coating" },
    { "label": "Color", "value": "Grey | Grey + Sizes: 7-12" },
    { "label": "Cuff Style", "value": "Knit wrist" }
  ],
  "status": "published",
  "source": { "doc": "brochure", "page": 16 },
  "order": 3,
  "en388": {
    "abrasion": "4",
    "bladeCut": "X",
    "tear": "4",
    "puncture": "3",
    "tdmCut": "D"
  }
}
```

Field by field:

| Field | Required | What to put |
|---|---|---|
| `slug` | yes | The product's web address. Lowercase, words joined by hyphens, no spaces or accents. This becomes `/products/grip-guard-gp5`. **See the slug rules below — this is permanent.** |
| `name` | yes | The product name exactly as the brochure prints it. |
| `variantLabel` | yes | `null` for most products. Where two products share a name, this is the short phrase that tells them apart — e.g. `"NRR 25dB"`. The site appends it automatically wherever the name is shown. |
| `categoryId` | yes | The `id` of the category it belongs to, from `categories.json`. Not the name, not the slug — the `id`. Getting this wrong puts the product in the wrong category, or in none at all, without any error. |
| `images` | yes | A list of filenames in `src/assets/products/`. At least one. Only the first is currently displayed. |
| `specs` | yes | A list of `{ "label", "value" }` pairs. Use `"label": null` for a feature bullet that has no "Label:" prefix. An empty list `[]` is allowed and simply shows no spec table. |
| `status` | no | `"published"` or `"draft"`. Defaults to `"published"`. A draft is excluded from every page, count and sitemap, so it is the safe way to stage a product that is not ready. |
| `source` | yes | Where the data came from: `{ "doc": ..., "page": ... }`. This is provenance — it is how anyone later can check a value against the source. Use `"doc": "brochure"` for the original product brochure, or the datasheet PDF's **filename exactly as it is** (e.g. `"SPARTAN - HIGHBAY.pdf"`) for a product taken from one of the per-family catalogues. `page` is the page within *that* document. It was a bare `sourcePage` number while the brochure was the only source; it is an object now because it no longer is. |
| `order` | yes | Position within its own category, low numbers first. **Ordering is per-category**, so it is normal and correct for a `1` to appear in several categories. |
| `en388` | no | **Leave this out entirely unless the brochure prints a rating.** See the EN 388 section. |

### After adding a product

- Put its photograph in `src/assets/products/` first, and use the exact filename in `images`. If the file is missing, the build prints a warning naming the product and the page renders with no image.
- Product counts, the category grid, related products, the sitemap and search all update by themselves. There is no list to add it to anywhere else.

---

## Adding a category

Open `src/data/categories.json`:

```json
{
  "id": "lighting",
  "slug": "lighting",
  "name": "Lighting",
  "divisionId": "electricals",
  "description": "Interior, industrial and outdoor LED — bulbs, panels, tubes, floodlights, highbays and solar.",
  "heroProductSlug": "slim-led-panels",
  "status": "active",
  "order": 1
}
```

| Field | What to put |
|---|---|
| `id` | The short internal name. This is what products reference in their `categoryId`. Keep it short and lowercase. |
| `slug` | The web address — `/catalogue/lighting`. It may differ from the `id` (the `accessories` category has slug `electrical-accessories`). **Permanent — see below.** |
| `name` | The display name. |
| `divisionId` | `"electricals"` or `"safety"`. |
| `description` | One sentence. It appears under the heading on the category page and on the category tile. |
| `heroProductSlug` | The slug of the product whose photo represents this category on the catalogue grid. **Must be a real product slug.** |
| `status` | `"active"` or `"expanding"`. |
| `order` | Position in the catalogue. **Unlike products, category `order` is globally unique — 1 to 15.** Do not reuse a number; renumber the others instead. |

The category page, its tile, its breadcrumbs, its entry in the filter and its sitemap entry are all generated. You add the record and nothing else.

### Marking a category as expanding

An expanding category is one with no products yet. It gets a real page with an honest message and an enquiry call-to-action, rather than being hidden or filled with placeholders.

To mark one:

```json
"heroProductSlug": null,
"status": "expanding"
```

and write the `description` as the message the visitor should read, because on an expanding category the description **is** the message:

> "Our electrical accessories range is expanding. Contact us for current availability and lead times."

Two categories are set up this way today — Electrical Accessories and Spill Control.

**To un-expand a category:** add its products, change `status` to `"active"`, set `heroProductSlug` to one of them, and rewrite the `description` as an ordinary description of the range. All four, or the page will be inconsistent.

---

## The rules that will bite

### 1. `heroProductSlug` must name a real product

It has to match a `slug` in `products.json` exactly — same spelling, same hyphens, all lowercase.

**The build will not catch this.** `npm run build` completes without an error or a warning, and the category tile simply renders with a blank space where the photograph should be — easy not to notice until someone else does.

`npm run test` *does* catch it: there is a test asserting that every `heroProductSlug` names a real product. So **run the tests, not only the build**, whenever you touch this field.

Copy and paste the slug from `products.json`. Do not retype it.

Two more things to know:

- The product you point at must not be a `"draft"`, or the tile is blank for the same reason.
- Choose the photo that reads well **small** — the tile shows it at about 92px. Body Protection deliberately uses `nonwoven-disposable-coverall` rather than one of the safety vests, because the vests' images contain a dark comparison panel that reads as a black rectangle at that size.

### 2. Slugs are permanent URLs

A slug is not a label. It is the page's address on the internet:

```
slug "grip-guard-gp5"  →  https://<domain>/products/grip-guard-gp5
```

Changing a slug does three things at once, all bad:

1. **Every existing link to that page breaks** — links in emails, in a customer's bookmarks, in a supplier's page, in a WhatsApp message sent last month. They all land on a 404.
2. **The search ranking is thrown away.** As far as Google is concerned the old page has been deleted and a brand-new one has appeared, and the new one starts from zero.
3. The old address is gone from the sitemap with nothing pointing at where it went.

**So: fixing a typo in a `name` is free and safe. Fixing a "typo" in a `slug` is not.** Once a slug has been published, treat it as fixed even if it is ugly.

If a slug genuinely must change, that is a developer task — it needs a redirect from the old address to the new one, set up before the change goes live.

The same is true of a category `slug`, which changes `/catalogue/<slug>`.

### 3. Never upscale a product photograph

The photographs came out of the brochure PDF at their native size — between roughly **100 and 440 pixels wide**. They are sharp at the sizes the design uses (about 180px on a tile, about 400px in the product spotlight) and the site is built so it can never accidentally stretch them.

**Do not enlarge one to "make it fill the space".** Beyond about 2× its native width a photograph becomes visibly soft and blocky, and on a dark background that reads as a cheap site — which for safety equipment reads as a cheap product.

**Replacing a photograph properly:**

1. Get the highest-resolution original the supplier has — 800px wide or more is ideal.
2. Save it as a **PNG with a transparent background**. The design places products directly on dark surfaces; a white or black rectangle behind the product will show.
3. Keep the same filename, or update the `images` entry to the new filename.
4. Rebuild and look at the product page and the category tile.

If a supplier only has a small image, use it small. A crisp small photograph is better than a soft large one.

**Do not "fix" `p19-safety-vests.png` or `p19-safety-vests-2.png`.** Each contains a third element on a black panel. This looks like a mistake and has already been reported as one. It is not: brochure page 19 shows it as a deliberate DAY | NIGHT comparison demonstrating the vest's reflective strips. Leave both alone.

### 4. Never invent specifications, ratings or certifications

This is the rule the whole project is built around, and it is not a style preference.

**If the brochure does not print it, it does not go in the file.** Not a plausible value, not a value from a similar product, not a value from the supplier's website unless someone has actually confirmed it applies to this exact item, not "N/A", not a dash.

- A product with no specs shows **no spec table**. That is correct.
- A glove with no printed EN 388 rating shows **no EN 388 table at all** — not an empty one, not a row of dashes. 66 of the 72 products are in this position.
- The site claims **no certifications anywhere**, because none have been supplied. An empty certifications area is not a gap to be filled in with something reasonable.

This is safety equipment. A visitor choosing a cut-resistant glove for a workshop is making a decision about someone's hands. A specification that was guessed — even a careful, sensible guess — is a false claim about protective equipment, and it is worse than showing nothing at all, because showing nothing prompts them to ask.

**When you are unsure, leave it out and raise it.** Empty is a valid state everywhere on this site. That is a design decision, and it exists precisely so nobody is ever tempted to fill a gap.

### 5. EN 388: `X` and `0` are different claims

EN 388 is the European standard for gloves offering mechanical protection. A rating is five values, always in this order:

```json
"en388": {
  "abrasion": "4",
  "bladeCut": "X",
  "tear": "4",
  "puncture": "3",
  "tdmCut": "D"
}
```

Every value is in quotes, because the standard mixes digits with letters (TDM cut is graded A–F).

**The critical distinction:**

| Value | Means |
|---|---|
| `"X"` | The glove was **not submitted for that test**. Nothing is claimed either way. |
| `"0"` | The glove **was tested** and achieved the lowest level. |
| `"1"`–`"4"` | Tested, at that level. |

These are not two ways of saying "no protection". `X` says *we do not know*. `0` says *we tested it and it scored zero*. One is an absence of information; the other is a measured result. The site renders each one literally and spells out the difference for screen-reader users in every cell.

**Never normalise one into the other, in either direction.** Do not "tidy" a `0` into an `X` because zero looks like a mistake. Do not turn an `X` into a `0` because it looks like a gap.

Chem Guard's tear resistance really is printed as `0` in the brochure. It has been checked against the source page. It is correct and it stays.

Six of the 72 products carry a verified rating. For every other glove, **leave `en388` out of the record entirely** — do not include it with `X` in all five positions, because that is a claim ("we submitted it and it failed everything") and the truth is that no rating was ever printed.

---

## When you are done

```bash
npm run build
```

```bash
npm run test
```

The build proves the file is structurally valid; the tests prove the values hang together (unique slugs, real `heroProductSlug`s, correct counts, EN 388 intact). Then open the pages you changed and look at them:

- the product page, `/products/<slug>`
- its category page, `/catalogue/<category-slug>`
- the catalogue index, `/catalogue` — check the category tile has its photograph

Both commands together take well under a minute.

## What to escalate rather than decide

Send these to a developer instead of editing around them:

- A slug that has to change on an already-published page — it needs a redirect.
- A new category that belongs to neither existing division.
- Any certification, approval or conformity claim.
- A specification you cannot trace to a specific brochure page.
- Anything that would need a new field the schema does not have.
