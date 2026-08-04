# Extraction tooling

Regenerates site assets from the Spartan brochure PDF. Run only when the
brochure is revised — output is committed, so a normal build never runs these.

    npm run extract:catalog -- "path/to/brochure.pdf"
    npm run extract:logo    -- "path/to/brochure.pdf"
    npm run extract:heroes  -- "path/to/brochure.pdf"

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
