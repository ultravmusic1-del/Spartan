/**
 * The primary navigation's model.
 *
 * WHY THIS IS A MODULE AND NOT MARKUP IN Header.astro
 *
 * The desktop menu and the mobile panel are two different renderers — one Astro,
 * one Preact — and they must never disagree about which item is lit or what sits
 * under Categories. `isCurrentNavItem` already existed for the first half of
 * that; the dropdown makes the second half matter too, because a division
 * missing from one of them is an entire range unreachable on one breakpoint.
 *
 * Nothing here reads the content layer. Both builders take plain arrays, so they
 * unit-test without booting the Content Layer, and `Header.astro` stays the only
 * thing that talks to `src/lib/catalog.ts` — which is also what keeps rule 3
 * intact: the header renders catalogue content now, and it goes through the seam
 * to get it.
 */

export interface NavLink {
  href: string;
  label: string;
  /**
   * The category exists and stocks nothing yet. Rendered with a quiet marker
   * rather than omitted: the range is real and its page says so honestly, but a
   * nav entry indistinguishable from fourteen stocked ranges is a small untrue
   * claim about stock — the same class of error as putting a borrowed
   * photograph on an empty category tile (docs/TRAPS.md).
   */
  expanding?: boolean;
}

export interface NavGroup {
  /** The division page. */
  href: string;
  /** The division's own name, verbatim — already "Spartan Electricals". */
  label: string;
  links: NavLink[];
}

export interface NavItem {
  href: string;
  label: string;
  /**
   * Additional paths this item lights for, beyond its own `href`. Each entry
   * matches itself exactly and anything beneath it.
   *
   * Categories owns three: `/catalogue` is its href, and `/electricals` and
   * `/safety` are two more ways into the same range. This replaced a single
   * `section?: string`, which could only ever describe one subtree — and
   * Categories is one item covering three.
   */
  owns?: string[];
  /** Divisions and their categories, shown in a dropdown under this item. */
  groups?: NavGroup[];
}

/** Trailing slashes are configuration-dependent; compare without them. */
export function normalisePath(path: string): string {
  return path.replace(/\/+$/, '') || '/';
}

/**
 * Whether a nav item is the page you are on, or a section you are in.
 *
 * Shared by the desktop menu and the mobile panel so the two cannot disagree
 * about which link is lit. Note what this does NOT do: it never returns true for
 * a product page. Products sit at `/products/…` and reach the catalogue through
 * their breadcrumb, which already says where they are; lighting a nav item that
 * does not contain them would be a claim about the IA that is not true.
 */
export function isCurrentNavItem(item: NavItem, current: string | undefined): boolean {
  if (!current) return false;
  const here = normalisePath(current);
  const owns = [item.href, ...(item.owns ?? [])];
  return owns.some((path) => {
    const base = normalisePath(path);
    if (here === base) return true;
    // `/catalogue` owns `/catalogue/lighting` but must never own `/catalogues`.
    return base === '/' ? false : here.startsWith(`${base}/`);
  });
}

/** The shape `buildCategoryGroups` needs, and no more, so tests need no fixtures. */
export interface DivisionLike {
  id: string;
  slug: string;
  name: string;
}

export interface CategoryLike {
  slug: string;
  name: string;
  divisionId: string;
  status: 'active' | 'expanding';
  productCount: number;
}

/**
 * One group per division, in the order given, each carrying that division's
 * categories in the order given. Both inputs are expected already sorted —
 * `getDivisions()` and `getCategories()` both sort by `order`.
 *
 * A division with no categories is omitted entirely rather than rendered as an
 * empty column. There is nothing behind it to reach.
 */
export function buildCategoryGroups(
  divisions: DivisionLike[],
  categories: CategoryLike[],
): NavGroup[] {
  return divisions
    .map((division) => ({
      href: `/${division.slug}`,
      label: division.name,
      links: categories
        .filter((category) => category.divisionId === division.id)
        .map((category) => ({
          href: `/catalogue/${category.slug}`,
          label: category.name,
          // Both conditions, not either. `status: 'expanding'` is an editorial
          // flag and `productCount` is the fact; a category marked expanding
          // that has since been stocked must stop being marked.
          ...(category.status === 'expanding' && category.productCount === 0
            ? { expanding: true }
            : {}),
        })),
    }))
    .filter((group) => group.links.length > 0);
}
