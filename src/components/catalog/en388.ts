/**
 * EN 388 is the European standard for gloves offering mechanical protection.
 * Six of the 72 products carry a printed rating; the other 66 have none, and a
 * missing rating must read as missing rather than as a default.
 *
 * The five levels always appear in this fixed order on the pictogram, so the
 * order is the standard's, not a presentational choice.
 *
 * `X` and `0` are DIFFERENT CLAIMS and must never be collapsed into each other:
 *
 *   X  the glove was not submitted for that test — nothing is claimed
 *   0  the glove was tested and achieved the lowest level
 *
 * Chem Guard's tear resistance is printed as `0`. That is a real, tested result
 * and is rendered literally. Values stay strings because the standard mixes
 * digits (abrasion/cut/tear/puncture) with letters (TDM cut, A–F).
 *
 * `title` carries the plain-language reading of each cell. En388Table.astro
 * additionally exposes it as visually-hidden text, because a `title` attribute
 * alone is not reliably announced by assistive technology and is unreachable by
 * keyboard and touch.
 */
import type { Product } from '../../lib/catalog';

type En388 = NonNullable<Product['en388']>;

export interface En388Column {
  label: string;
  value: string;
  title: string;
}

const ORDER: { key: keyof En388; label: string }[] = [
  { key: 'abrasion', label: 'Abrasion' },
  { key: 'bladeCut', label: 'Blade cut' },
  { key: 'tear', label: 'Tear' },
  { key: 'puncture', label: 'Puncture' },
  { key: 'tdmCut', label: 'TDM cut' },
];

export function en388Columns(en388: En388): En388Column[] {
  return ORDER.map(({ key, label }) => {
    const value = en388[key];
    return {
      label,
      value,
      title: value === 'X' ? `${label}: not tested for this glove` : `${label}: level ${value}`,
    };
  });
}
