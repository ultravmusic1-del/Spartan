import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * `@nanostores/persistent` picks its storage engine once, at module-evaluation
 * time: `typeof localStorage !== 'undefined'` decides between the real Storage
 * and a plain object it keeps in memory. So a stub has to be installed *before*
 * `./enquiry` is evaluated, and `vi.hoisted` is the one hook that runs above the
 * import statements.
 *
 * A stub rather than `environment: 'jsdom'`: jsdom is not a dependency of this
 * project and pulling ~10MB of DOM in to obtain nine lines of Storage would be a
 * poor trade. This also leaves `vitest.config.ts` — and its Astro content-store
 * workaround, which the other 32 tests depend on — completely untouched.
 *
 * The engine reads and writes with property access (`storage[key] = ...`,
 * `delete storage[key]`), not only `setItem`/`getItem`, so the stub keeps its
 * data as own properties and its methods on the prototype, exactly as the real
 * Storage exotic object behaves.
 */
vi.hoisted(() => {
  class MemoryStorage implements Storage {
    [key: string]: unknown;

    get length(): number {
      return Object.keys(this).length;
    }

    key(index: number): string | null {
      return Object.keys(this)[index] ?? null;
    }

    getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(this, key) ? String(this[key]) : null;
    }

    setItem(key: string, value: string): void {
      this[key] = String(value);
    }

    removeItem(key: string): void {
      delete this[key];
    }

    clear(): void {
      for (const key of Object.keys(this)) delete this[key];
    }
  }

  globalThis.localStorage = new MemoryStorage();
});

import { enquiry, addItem, removeItem, setQty, setNote, clear, itemCount } from './enquiry';

describe('enquiry store', () => {
  beforeEach(() => clear());

  it('starts empty', () => {
    expect(enquiry.get()).toEqual([]);
    expect(itemCount()).toBe(0);
  });

  it('adds an item with quantity 1', () => {
    addItem({ slug: 'safety-helmets', name: 'Safety Helmets' });
    expect(enquiry.get()).toEqual([
      { slug: 'safety-helmets', name: 'Safety Helmets', qty: 1, note: '' },
    ]);
  });

  it('increments quantity instead of duplicating', () => {
    addItem({ slug: 'safety-helmets', name: 'Safety Helmets' });
    addItem({ slug: 'safety-helmets', name: 'Safety Helmets' });
    expect(enquiry.get()).toHaveLength(1);
    expect(enquiry.get()[0].qty).toBe(2);
  });

  it('counts total quantity, not line count', () => {
    addItem({ slug: 'a', name: 'A' });
    addItem({ slug: 'a', name: 'A' });
    addItem({ slug: 'b', name: 'B' });
    expect(itemCount()).toBe(3);
  });

  it('removes an item', () => {
    addItem({ slug: 'a', name: 'A' });
    removeItem('a');
    expect(enquiry.get()).toEqual([]);
  });

  it('clamps quantity to a minimum of 1', () => {
    addItem({ slug: 'a', name: 'A' });
    setQty('a', 0);
    expect(enquiry.get()[0].qty).toBe(1);
  });

  it('caps quantity at 999', () => {
    addItem({ slug: 'a', name: 'A' });
    setQty('a', 100000);
    expect(enquiry.get()[0].qty).toBe(999);
  });

  it('stores a per-item note', () => {
    addItem({ slug: 'a', name: 'A' });
    setNote('a', 'Need 6 colourways');
    expect(enquiry.get()[0].note).toBe('Need 6 colourways');
  });

  it('survives corrupt storage without throwing', () => {
    localStorage.setItem('spartan.enquiry.v1', '{not json');
    expect(() => enquiry.get()).not.toThrow();
  });
});
