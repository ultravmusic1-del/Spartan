import { persistentAtom } from '@nanostores/persistent';

/**
 * The enquiry basket — the site's entire conversion mechanism.
 *
 * There is no cart, no checkout, no prices and no accounts: a trade buyer
 * collects products while browsing and submits one RFQ. So this store is the
 * one piece of client state the site has, and losing it loses the lead.
 *
 * It persists to `localStorage` under a versioned key, so a future shape change
 * bumps to `.v2` and leaves old baskets to expire rather than crashing on them.
 * `name` is stored alongside `slug` deliberately: an enquiry submitted from a
 * stale basket must still say what the buyer thought they were asking about,
 * even if the catalogue has moved on since.
 */
export interface EnquiryItem {
  slug: string;
  name: string;
  qty: number;
  note: string;
}

export const enquiry = persistentAtom<EnquiryItem[]>('spartan.enquiry.v1', [], {
  encode: JSON.stringify,
  decode: (raw) => {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Corrupt storage must never break the page. A basket that has been
      // hand-edited, truncated by a full quota or written by an older version
      // costs the buyer their list — it must not cost them the site.
      return [];
    }
  },
});

/**
 * `Math.floor(n) || 1` also catches `NaN` and `-0`, which is what an empty or
 * non-numeric quantity field produces. 999 is an RFQ line, not a stock level.
 */
const clampQty = (n: number) => Math.min(999, Math.max(1, Math.floor(n) || 1));

/** Adding a product already in the basket increments it rather than duplicating. */
export function addItem(item: { slug: string; name: string }) {
  const items = enquiry.get();
  const existing = items.find((i) => i.slug === item.slug);
  enquiry.set(
    existing
      ? items.map((i) => (i.slug === item.slug ? { ...i, qty: clampQty(i.qty + 1) } : i))
      : [...items, { ...item, qty: 1, note: '' }],
  );
}

export const removeItem = (slug: string) =>
  enquiry.set(enquiry.get().filter((i) => i.slug !== slug));

export const setQty = (slug: string, qty: number) =>
  enquiry.set(enquiry.get().map((i) => (i.slug === slug ? { ...i, qty: clampQty(qty) } : i)));

/** Notes are capped so one pasted document cannot fill the storage quota. */
export const setNote = (slug: string, note: string) =>
  enquiry.set(enquiry.get().map((i) => (i.slug === slug ? { ...i, note: note.slice(0, 500) } : i)));

export const clear = () => enquiry.set([]);

/** Total units, not lines: three helmets and one pair of gloves is 4, not 2. */
export const itemCount = () => enquiry.get().reduce((n, i) => n + i.qty, 0);
