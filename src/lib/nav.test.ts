import { describe, it, expect } from 'vitest';
import {
  buildCategoryGroups,
  isCurrentNavItem,
  normalisePath,
  type CategoryLike,
  type DivisionLike,
  type NavItem,
} from './nav';

const divisions: DivisionLike[] = [
  { id: 'electricals', slug: 'electricals', name: 'Spartan Electricals' },
  { id: 'safety', slug: 'safety', name: 'Spartan Safety' },
];

const categories: CategoryLike[] = [
  { slug: 'lighting', name: 'Lighting', divisionId: 'electricals', status: 'active', productCount: 24 },
  {
    slug: 'electrical-accessories',
    name: 'Electrical Accessories',
    divisionId: 'electricals',
    status: 'expanding',
    productCount: 0,
  },
  { slug: 'hand-protection', name: 'Hand Protection', divisionId: 'safety', status: 'active', productCount: 11 },
];

const CATEGORIES_ITEM: NavItem = {
  href: '/catalogue',
  label: 'Categories',
  owns: ['/electricals', '/safety'],
};

describe('normalisePath', () => {
  it('strips trailing slashes but never empties the root', () => {
    expect(normalisePath('/catalogue/')).toBe('/catalogue');
    expect(normalisePath('/')).toBe('/');
    expect(normalisePath('//')).toBe('/');
  });
});

describe('isCurrentNavItem', () => {
  it('matches the item’s own page', () => {
    expect(isCurrentNavItem(CATEGORIES_ITEM, '/catalogue')).toBe(true);
  });

  it('matches anything beneath a path it owns', () => {
    expect(isCurrentNavItem(CATEGORIES_ITEM, '/catalogue/hand-protection')).toBe(true);
  });

  /*
   * The reason Categories needed `owns` to be a LIST. A single section string
   * could describe `/catalogue` or `/electricals` but not both, and Categories is
   * one nav item covering three routes into the same range. Before the dropdown,
   * Electricals and Safety were their own top-level items and each matched itself.
   */
  it('matches the two division pages it now covers', () => {
    expect(isCurrentNavItem(CATEGORIES_ITEM, '/electricals')).toBe(true);
    expect(isCurrentNavItem(CATEGORIES_ITEM, '/safety')).toBe(true);
  });

  it('ignores trailing slashes on either side', () => {
    expect(isCurrentNavItem(CATEGORIES_ITEM, '/electricals/')).toBe(true);
  });

  /*
   * Prefix matching on the bare string would light Categories on `/catalogues`
   * or `/safety-data-sheets`. The separator is what makes it a subtree test
   * rather than a "starts with" test.
   */
  it('does not match a path that merely starts with the same letters', () => {
    expect(isCurrentNavItem(CATEGORIES_ITEM, '/catalogues')).toBe(false);
    expect(isCurrentNavItem(CATEGORIES_ITEM, '/safety-data')).toBe(false);
  });

  it('never lights on a product page', () => {
    // Products reach the catalogue through their breadcrumb. Lighting a nav item
    // that does not contain them would misstate the IA.
    expect(isCurrentNavItem(CATEGORIES_ITEM, '/products/grip-guard-gp5')).toBe(false);
  });

  it('does not let Home own the whole site', () => {
    // `/` as a prefix would match every path on the site.
    const home: NavItem = { href: '/', label: 'Home' };
    expect(isCurrentNavItem(home, '/')).toBe(true);
    expect(isCurrentNavItem(home, '/about')).toBe(false);
  });

  it('is false for an unknown current path', () => {
    expect(isCurrentNavItem(CATEGORIES_ITEM, undefined)).toBe(false);
  });
});

describe('buildCategoryGroups', () => {
  it('groups categories under their division, in the order given', () => {
    const groups = buildCategoryGroups(divisions, categories);

    expect(groups.map((g) => g.label)).toEqual(['Spartan Electricals', 'Spartan Safety']);
    expect(groups[0]!.href).toBe('/electricals');
    expect(groups[0]!.links.map((l) => l.label)).toEqual(['Lighting', 'Electrical Accessories']);
    expect(groups[1]!.links.map((l) => l.href)).toEqual(['/catalogue/hand-protection']);
  });

  it('uses the division’s own name, which already carries the brand', () => {
    // The partner asked for "Spartan Electricals" in the dropdown. divisions.json
    // has said exactly that since it was written, so this needs no data change —
    // the old flat nav was the thing shortening it.
    expect(buildCategoryGroups(divisions, categories)[0]!.label).toBe('Spartan Electricals');
  });

  it('marks a category that stocks nothing yet', () => {
    const groups = buildCategoryGroups(divisions, categories);
    const links = groups[0]!.links;
    expect(links.find((l) => l.label === 'Lighting')?.expanding).toBeUndefined();
    expect(links.find((l) => l.label === 'Electrical Accessories')?.expanding).toBe(true);
  });

  /*
   * `status` is an editorial flag and `productCount` is the fact. A category
   * still flagged expanding after stock arrived must stop being marked, or the
   * nav goes on saying "soon" about a range with products on the shelf. Spill
   * Control is exactly this case: it was empty until seven SKUs landed.
   */
  it('stops marking a flagged category once it has products', () => {
    const stocked: CategoryLike[] = [
      { slug: 'spill-control', name: 'Spill Control', divisionId: 'safety', status: 'expanding', productCount: 7 },
    ];
    const groups = buildCategoryGroups(divisions, stocked);
    expect(groups[0]!.links[0]!.expanding).toBeUndefined();
  });

  it('omits a division with no categories rather than rendering an empty column', () => {
    const groups = buildCategoryGroups(divisions, categories.filter((c) => c.divisionId === 'safety'));
    expect(groups.map((g) => g.label)).toEqual(['Spartan Safety']);
  });

  it('covers every category exactly once, so none can go missing from the menu', () => {
    // The failure this guards is a whole range unreachable from the primary nav,
    // which is what the flat menu did to the catalogue index for weeks.
    const groups = buildCategoryGroups(divisions, categories);
    const hrefs = groups.flatMap((g) => g.links.map((l) => l.href));
    expect(hrefs).toHaveLength(categories.length);
    expect(new Set(hrefs).size).toBe(categories.length);
  });
});
