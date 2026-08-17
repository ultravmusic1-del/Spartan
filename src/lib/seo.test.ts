import { describe, it, expect } from 'vitest';
import {
  productJsonLd,
  breadcrumbJsonLd,
  organizationJsonLd,
  itemListJsonLd,
  productDescription,
  requireSite,
  serialiseJsonLd,
} from './seo';

const product = {
  slug: 'safety-helmets',
  name: 'Safety Helmets',
  variantLabel: null,
  categoryId: 'head',
  images: ['p15-safety-helmets.png'],
  specs: [{ label: 'Shell', value: 'HDPE compound + nylon ratchet' }],
  status: 'published' as const,
  source: { doc: 'brochure', page: 15 },
  order: 1,
};

const SITE = 'https://spartan.example';

describe('productJsonLd', () => {
  it('emits a Product node with brand and description', () => {
    const ld = productJsonLd(product, SITE);
    expect(ld['@type']).toBe('Product');
    expect(ld.name).toBe('Safety Helmets');
    expect(ld.brand).toEqual({ '@type': 'Brand', name: 'Spartan' });
    expect(ld.description).toContain('HDPE');
  });

  it('never emits commercial claims the site cannot support', () => {
    const ld = productJsonLd(product, SITE);
    expect(ld).not.toHaveProperty('offers');
    expect(ld).not.toHaveProperty('aggregateRating');
    expect(ld).not.toHaveProperty('review');
  });

  it('includes the variant label in the name when present', () => {
    const ld = productJsonLd({ ...product, name: 'Ear Muff', variantLabel: 'NRR 25dB' }, SITE);
    expect(ld.name).toBe('Ear Muff NRR 25dB');
  });
});

describe('breadcrumbJsonLd', () => {
  it('numbers positions from 1 and absolutises URLs', () => {
    const ld = breadcrumbJsonLd(
      [{ name: 'Catalogue', url: '/catalogue' }, { name: 'Head & Face', url: '/catalogue/head-face-protection' }],
      SITE,
    );
    expect(ld['@type']).toBe('BreadcrumbList');
    expect(ld.itemListElement.map((i: any) => i.position)).toEqual([1, 2]);
    expect(ld.itemListElement[0].item).toBe(`${SITE}/catalogue`);
  });
});

describe('organizationJsonLd', () => {
  it('emits an Organization with the founding year', () => {
    const ld = organizationJsonLd(SITE);
    expect(ld['@type']).toBe('Organization');
    expect(ld.name).toBe('Spartan');
    expect(ld.foundingDate).toBe('2015');
  });
});

describe('itemListJsonLd', () => {
  it('lists products in order with absolute URLs', () => {
    const ld = itemListJsonLd([product, { ...product, slug: 'brow-guard', name: 'Brow Guard' }], SITE);
    expect(ld['@type']).toBe('ItemList');
    expect(ld.numberOfItems).toBe(2);
    expect(ld.itemListElement[1].url).toBe(`${SITE}/products/brow-guard`);
  });
});

/*
 * Three cases beyond the brief's suite, one per rule this module exists to
 * enforce: the description is assembled from printed specs and nothing else,
 * a crumb with no destination gets no invented one, and the Organization node
 * claims only what site.json can actually substantiate.
 */

describe('productJsonLd — derived fields', () => {
  it('derives description, url and image from the product itself', () => {
    const ld = productJsonLd(product, SITE);
    expect(ld.description).toBe('Safety Helmets. Shell: HDPE compound + nylon ratchet.');
    expect(ld.url).toBe(`${SITE}/products/safety-helmets`);
    // No image is invented when none is passed in.
    expect(ld).not.toHaveProperty('image');

    // A large minority of the catalogue's spec rows carry no label — 132 of 598
    // on 2026-08-17 — and those render as the bare printed value rather than
    // being dropped or given a made-up one. The ratio is what matters here, not
    // the totals: this comment read "95 of the 225" long after the datasheet
    // integration took the catalogue past twice that, because nothing asserts a
    // figure written in prose. Treat both numbers as a dated snapshot.
    const unlabelled = productJsonLd(
      { ...product, specs: [{ label: null, value: 'Conforms to the printed brochure row' }] },
      SITE,
    );
    expect(unlabelled.description).toBe('Safety Helmets. Conforms to the printed brochure row.');

    // Long spec sets are cut at a whole row, never mid-value.
    const wordy = productJsonLd(
      {
        ...product,
        specs: Array.from({ length: 12 }, (_, i) => ({
          label: `Property ${i}`,
          value: 'a value long enough that twelve of them run well past any sane meta description',
        })),
      },
      SITE,
    );
    expect(wordy.description.length).toBeLessThanOrEqual(300);
    expect(wordy.description.endsWith('sane meta description.')).toBe(true);

    const withImage = productJsonLd(product, SITE, { image: '/_astro/p15.abc123.png' });
    expect(withImage.image).toBe(`${SITE}/_astro/p15.abc123.png`);
  });
});

describe('breadcrumbJsonLd — the current page', () => {
  it('omits item on a crumb with no URL rather than inventing one', () => {
    const ld = breadcrumbJsonLd(
      [{ name: 'Catalogue', url: '/catalogue' }, { name: 'Safety Helmets' }],
      SITE,
    );
    expect(ld.itemListElement[1]).not.toHaveProperty('item');
    expect(ld.itemListElement[1]!.name).toBe('Safety Helmets');
    expect(ld.itemListElement[1]!.position).toBe(2);
  });
});

/*
 * Two additions made while wiring the builders into pages (Task 15): a second
 * length budget for the same description text, and one place that turns
 * `Astro.site` into the string the builders take.
 */

describe('productDescription — the meta-description budget', () => {
  const wordy = {
    ...product,
    specs: [
      { label: 'Shell', value: 'HDPE compound + nylon ratchet' },
      { label: 'Colours', value: 'Red, White, Blue, Orange, Yellow, Green' },
      { label: 'Adjustment', value: '6-point, for even load distribution across the crown' },
    ],
  };

  it('cuts at a whole spec row under the budget it is given', () => {
    // The JSON-LD ceiling fits all three rows.
    expect(productDescription(wordy).length).toBeLessThanOrEqual(300);
    expect(productDescription(wordy)).toContain('6-point');

    // A meta description is truncated by search engines around 155-160, so the
    // same text is cut again at 160 — and cut between rows, never mid-value.
    const meta = productDescription(wordy, 160);
    expect(meta.length).toBeLessThanOrEqual(160);
    expect(meta).toBe('Safety Helmets. Shell: HDPE compound + nylon ratchet. Colours: Red, White, Blue, Orange, Yellow, Green.');
    expect(meta.endsWith('Green.')).toBe(true);
  });

  it('still returns the product name when no spec row fits', () => {
    // Never an empty string and never a truncated fragment: the name alone is
    // the honest floor.
    expect(productDescription(wordy, 20)).toBe('Safety Helmets.');
  });
});

describe('serialiseJsonLd', () => {
  // The catalogue holds no "<" today, so nothing in the built output exercises
  // this. It is here for the admin dashboard, where product text stops being
  // brochure-derived — which is exactly the point at which nobody will be
  // reading Seo.astro.
  const CLOSER = '</' + 'script><img src=x onerror=alert(1)>';

  it('escapes < so a closing script tag cannot end the block early', () => {
    const out = serialiseJsonLd(productJsonLd({ ...product, name: `Guard ${CLOSER}` }, SITE));
    expect(out).not.toContain('<');
    expect(out).toContain('\\u003c');
    // Escaped, not deleted: the value survives a round trip byte for byte.
    expect(JSON.parse(out).name).toBe(`Guard ${CLOSER}`);
  });

  it('neutralises an HTML comment opener too', () => {
    const out = serialiseJsonLd({ name: 'Guard <!-- hidden -->' });
    expect(out).not.toContain('<!--');
    expect(JSON.parse(out).name).toBe('Guard <!-- hidden -->');
  });

  it('leaves ordinary nodes byte-identical to JSON.stringify', () => {
    const node = productJsonLd(product, SITE);
    expect(serialiseJsonLd(node)).toBe(JSON.stringify(node));
  });
});

describe('requireSite', () => {
  it('returns the configured origin and refuses to guess one', () => {
    expect(requireSite(new URL('https://spartan.example'))).toBe('https://spartan.example/');
    // `Astro.site` is undefined whenever astro.config.mjs omits `site`. There is
    // no relative form of a canonical or an og:url, so this fails the build.
    expect(() => requireSite(undefined)).toThrow(/must set `site`/);
  });
});

describe('organizationJsonLd — what it may claim', () => {
  it('states only name, url, logo and founding date', () => {
    const ld = organizationJsonLd(SITE);
    expect(Object.keys(ld).sort()).toEqual(
      ['@context', '@type', 'foundingDate', 'logo', 'name', 'url'].sort(),
    );
    // src/data/site.json still holds placeholder contact details. Publishing a
    // placeholder address as structured data is worse than publishing none.
    expect(ld).not.toHaveProperty('address');
    expect(ld).not.toHaveProperty('telephone');
    expect(ld).not.toHaveProperty('email');
  });
});
