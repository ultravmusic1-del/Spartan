import { atom } from 'nanostores';

/**
 * Whether the enquiry drawer is open.
 *
 * The badge and the drawer are two separate Astro islands, so they cannot share
 * component state — the trigger has to reach the panel across a hydration
 * boundary. A store rather than a `CustomEvent` on `window` because both islands
 * are `client:idle` and there is no guarantee which hydrates first: an event
 * dispatched before the drawer is listening is lost for good, while an atom is
 * simply read on mount. On the site's only conversion path that difference is
 * the whole point.
 *
 * This lives beside the basket rather than inside it because it is throwaway UI
 * state — it must never be persisted, and `stores/enquiry.ts` persists
 * everything it holds.
 */
export const drawerOpen = atom(false);

export const openDrawer = () => drawerOpen.set(true);
export const closeDrawer = () => drawerOpen.set(false);
