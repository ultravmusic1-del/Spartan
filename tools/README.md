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

2. **Same-column image assignment.** Products are matched to the nearest image
   within their own page column. Nearest-overall assignment swaps images
   between the left and right columns of two-column pages.
