# Extraction tooling

Regenerates site assets from the Spartan brochure PDF. Run only when the
brochure is revised — output is committed, so a normal build never runs these.

    npm run extract:catalog -- "path/to/brochure.pdf"
    npm run extract:logo    -- "path/to/brochure.pdf"
    npm run extract:heroes  -- "path/to/brochure.pdf"

There is a fourth script for the per-family datasheet PDFs, which are a
different kind of source and are handled differently:

    node tools/extract-datasheets.mjs [--only <substring>]

## Why `extract-datasheets` is separate

`extract-catalog` reads the one brochure and derives products, specs and images
together from its layout. The datasheets are 20 unrelated supplier documents
with no shared structure, so there is nothing to infer — those products and
specs are authored by hand in `products.json` and the script only lifts the
photography.

It hits **the same black-box problem** described below, and solves it the same
way: pulling an embedded image out directly gives an opaque rectangle (sampled
from these PDFs the bed is `#000` with no alpha channel at all), because the
knock-out lives in the page's clip stack rather than in the image. So it goes
through the same `renderImagesOnly` helper.

Two things it does that the brochure pipeline does not need:

- **Clips the crop to the page.** Several sheets place a tall photo running off
  the bottom edge — the exhaust-fan sheet puts a 420pt image at y=602 on a 792pt
  page — and rendering the whole placed rect pads the cutout with empty space.
- **Trims the transparent border.** These layouts sit a subject on a canvas far
  larger than itself; the shuttered fan covers under 4% of its own frame.
  Untrimmed, that padding is what gets scaled to fit the card's 150px media box,
  leaving the product a quarter of its proper size.

Every run refuses any cutout that came out fully opaque, which is what a lost
clip looks like, or empty, which is what a dropped render looks like. Those
checks are unconditional — there is no flag to skip them. Entries select their
image by native pixel dimensions rather than draw order, so a re-run cannot
silently grab a different picture; where several images share a size, `nth`
counts left-to-right across the page, not in draw order.

### Flattened pages

Two of the datasheets — `SPARTAN - PORTABLE AIR COOLERS.pdf` and
`Spartan Fans Product Catalog.pdf` — are **a single flattened raster per page**
(one 2481x3509 image covering the whole layout). There is no clip stack to
exploit, so the background cannot be knocked out; it has to be computed.

Those entries use the second manifest kind, `crop`: a rect in PDF points plus a
`key` mode and a `threshold`, handed to `lib/keying.mjs`. Two things about it:

- **The key mode is per image.** The air coolers are white and grey products on
  a blue gradient, so keying on brightness erases the product and keying on
  saturation does not. The consumer fans are the mirror case, dark products on
  near-white. There is no single mode that works for both.
- **The mask is flood-filled from the border, not applied globally.** A global
  threshold punches a hole through every background-coloured region *inside* the
  subject — a white panel on a white-keyed product. Only background-like pixels
  reachable from the image edge count as background.

A `crop` entry renders at **the page's own native raster resolution** — derived
from the widest image on the page divided by the page width, so nothing is
upscaled or needlessly downsampled — unless the entry sets `scale` to override
it. Crop rects are clamped to the page box before the slice is taken; a rect
that misses the page entirely is reported as a problem rather than throwing.
Keyed cutouts are refused if they come out nearly fully opaque (the key never
fired) or nearly empty (the key ate the subject).

## Two things that will silently break if changed

1. **Clip forwarding.** Product photos are rectangles with opaque black
   backgrounds, knocked out by `clipImageMask`. Forward every clip/mask/group
   push AND its matching pop; filter only fill operations. Dropping clips
   yields products inside black boxes — which looks fine on white pages and
   catastrophic on the dark layout.

2. **Same-column assignment.** Products are matched to the images *and* spec
   lines within their own page column (`sameColumnFilter` in `lib/pdf.mjs`).
   Nearest-overall assignment swaps images between the left and right columns
   of two-column pages, and a spec filter without the column test hands every
   product its neighbour's specs on top of its own.

## Hero photographs — two are not usable as-is

`extract-heroes` emits six plates. After a re-run, expect to delete or avoid two:

- **`cover.jpg` is blank white** (mean RGB 255,255,255). The brochure cover was
  a text overlay on a plain field, so once the overlay is correctly stripped
  there is no photograph left. It is deleted from `src/assets/hero/` — do not
  re-add it, it renders as an empty box.
- **`lighting.jpg` and `ventilation-water.jpg`** carry the brochure's own
  white-and-red divider graphic across the lower half of the plate, which shows
  as a band under any landscape crop. Usable only with a tight top crop.

`electrical.jpg`, `safety.jpg` and `workwear.jpg` are clean full-bleed
photographs and are the three the site uses.

## Spec parsing

`extract-catalog` emits `specs: [{ label, value }]` per product, splitting each
line on its first colon. Lines with no `Label:` are feature bullets and get
`label: null` — no label is invented for them. Values the brochure wrapped over
several lines are rejoined, which is a heuristic: the PDF marks a wrap no
differently from a new bullet. The unparsed lines are kept as `specsRaw` so
consumers can fall back on them.
