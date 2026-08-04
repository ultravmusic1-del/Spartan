import { useEffect, useRef, useState } from 'preact/hooks';

export interface FilterDivision {
  slug: string;
  name: string;
}

export interface FilterCategory {
  slug: string;
  name: string;
  divisionSlug: string;
  count: number;
}

interface Props {
  divisions: FilterDivision[];
  categories: FilterCategory[];
  /** Total products server-rendered on the page. */
  total: number;
}

/**
 * CatalogueFilters — narrows the catalogue listing by division and category.
 *
 * It filters the DOM that is already on the page. Every one of the 72 products
 * and all 15 categories are server-rendered by `/catalogue`; this island only
 * toggles `hidden` on the `<li>`s the page owns, keyed off their `data-`
 * attributes. Nothing is fetched, nothing is re-rendered, and the full list
 * stays in the HTML — so the page is complete for a crawler and complete with
 * JavaScript switched off.
 *
 * Because of that, the controls must not be operable until they work: they
 * render in a pending state on the server and reveal themselves once hydrated.
 * A control that looks live and does nothing is worse than no control, and
 * `client:idle` leaves a real window before hydration. While pending the bar
 * keeps the exact box it will occupy (see the note on the root element), so
 * revealing it shifts nothing.
 *
 * FILTER STATE IS NOT IN THE URL, deliberately. Every view this island can
 * express already has a real, static, server-rendered address:
 * `/catalogue/lighting` for a category and (from Task 11) `/electricals` for a
 * division. Mirroring those as `/catalogue?category=lighting` would publish a
 * second URL for content that already has a canonical one, and — because this
 * island filters the DOM rather than rendering it — a shared link would show
 * all 72 products until hydration and then visibly cut down. So this is an
 * in-page scanning aid, the category tiles and breadcrumbs are the navigation,
 * and Back leaves the page rather than unwinding filter steps.
 */
export default function CatalogueFilters({ divisions, categories, total }: Props) {
  const [ready, setReady] = useState(false);
  const [division, setDivision] = useState('');
  const [category, setCategory] = useState('');
  const [shown, setShown] = useState(total);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setReady(true), []);

  useEffect(() => {
    if (!ready) return;

    let visible = 0;
    for (const li of document.querySelectorAll<HTMLElement>('[data-product]')) {
      const match =
        (division === '' || li.dataset.division === division) &&
        (category === '' || li.dataset.category === category);
      li.hidden = !match;
      if (match) visible += 1;
    }

    // The category tiles are navigation, not results: they follow the division
    // so the browse list matches the scope, but they are not cut to a single
    // tile when one category is picked — the tile for that category is the link
    // to its own full page, and the ones beside it are how you leave it.
    for (const li of document.querySelectorAll<HTMLElement>('[data-category-tile]')) {
      li.hidden = !(division === '' || li.dataset.division === division);
    }

    // The grid paints a border, so an all-hidden grid would be an empty box —
    // and a result narrower than the column count would draw its rules across
    // cells that hold nothing. Both are the grid's own width, so the column
    // count travels as a custom property rather than as a class per case.
    const grid = document.querySelector<HTMLElement>('[data-product-grid]');
    if (grid) {
      grid.hidden = visible === 0;
      grid.style.setProperty('--cols', String(Math.min(Math.max(visible, 1), 4)));
      grid.style.setProperty('--cols-md', String(Math.min(Math.max(visible, 1), 3)));
      grid.style.setProperty('--cols-sm', String(Math.min(Math.max(visible, 1), 2)));
    }
    const none = document.querySelector<HTMLElement>('[data-product-none]');
    if (none) none.hidden = visible > 0;

    setShown(visible);
  }, [ready, division, category]);

  // Categories are offered within the chosen division only, so the two controls
  // cannot be combined into an empty result.
  const options = division ? categories.filter((c) => c.divisionSlug === division) : categories;
  const filtered = division !== '' || category !== '';

  const onDivision = (slug: string) => {
    setDivision(slug);
    setCategory('');
  };

  const reset = () => {
    setDivision('');
    setCategory('');
    rootRef.current?.querySelector<HTMLElement>('input')?.focus();
  };

  return (
    /* The pending state is a class, NOT the `hidden` attribute. Tailwind 4's
       preflight ships `[hidden]:where(:not([hidden=until-found])){display:none
       !important}`, and no ordinary author rule outranks an `!important` one —
       so `hidden` here could be switched off but never made to hold its space,
       and the bar would pop in and push the whole grid down. Measured: 134px of
       shift, CLS 0.042. It stays an attribute on the list items below, where
       `display: none` is exactly what is wanted. */
    <div class={ready ? 'cf' : 'cf cf--pending'} ref={rootRef}>
      <fieldset class="cf__group">
        <legend class="cf__legend">Division</legend>
        <div class="cf__radios">
          <label class={division === '' ? 'cf__radio cf__radio--on' : 'cf__radio'}>
            <input
              type="radio"
              name="cf-division"
              value=""
              checked={division === ''}
              onChange={() => onDivision('')}
            />
            <span>All divisions</span>
          </label>
          {divisions.map((d) => (
            <label
              key={d.slug}
              class={division === d.slug ? 'cf__radio cf__radio--on' : 'cf__radio'}
            >
              <input
                type="radio"
                name="cf-division"
                value={d.slug}
                checked={division === d.slug}
                onChange={() => onDivision(d.slug)}
              />
              <span>{d.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div class="cf__group">
        <label class="cf__legend" for="cf-category">
          Category
        </label>
        <select
          id="cf-category"
          class="cf__select"
          value={category}
          onChange={(e) => setCategory((e.currentTarget as HTMLSelectElement).value)}
        >
          <option value="">All categories</option>
          {options.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name} ({c.count})
            </option>
          ))}
        </select>
      </div>

      <div class="cf__status">
        {/* Server-rendered with the unfiltered figure already in it, so
            hydration is not itself an announcement. */}
        <p class="cf__count" role="status" aria-live="polite">
          Showing {shown} of {total} products
        </p>
        {filtered && (
          <button type="button" class="cf__reset" onClick={reset}>
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
