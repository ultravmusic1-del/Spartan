import { describe, it, expect, vi, afterEach } from 'vitest';
import { recordEnquiry, markNotified, storeConfigured } from './enquiry-store';
import type { EnquiryPayload } from './enquiry-schema';

/**
 * These tests never reach Supabase, and that is the point: the unconfigured path
 * is what CI and every developer machine without secrets actually run, and it is
 * the path that must not throw, must not make a network call, and must report
 * `unconfigured` rather than `failed`.
 *
 * The distinction is load-bearing — `decideOutcome` turns `failed` into a 502
 * and `unconfigured` into a logged success. Collapsing the two here would 502
 * every enquiry in the e2e suite.
 */
const payload: EnquiryPayload = {
  name: 'Sam Rahman',
  company: 'Gulf Contracting',
  email: 'sam@example.com',
  phone: '+971500000000',
  country: 'UAE',
  division: '',
  message: 'Please quote for a 40-site rollout.',
  items: [{ slug: 'safety-helmets', name: 'Safety Helmets', qty: 12, note: '' }],
  website: '',
  source: 'enquiry',
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** Both variables blank — the state a machine with no `.env` is in. */
function withoutCredentials(): void {
  vi.stubEnv('SUPABASE_URL', '');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
}

describe('enquiry-store without credentials', () => {
  it('reports itself unconfigured', () => {
    withoutCredentials();
    expect(storeConfigured()).toBe(false);
  });

  it('returns `unconfigured`, never `failed`', async () => {
    withoutCredentials();
    const result = await recordEnquiry(payload);

    expect(result.state).toBe('unconfigured');
    expect(result.id).toBeUndefined();
  });

  it('makes no network call', async () => {
    withoutCredentials();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await recordEnquiry(payload);
    await markNotified('00000000-0000-0000-0000-000000000000');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('marking notified is a no-op rather than a throw', async () => {
    withoutCredentials();
    await expect(
      markNotified('00000000-0000-0000-0000-000000000000'),
    ).resolves.toBeUndefined();
  });
});

describe('enquiry-store configuration', () => {
  it('needs both variables, not either', () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(storeConfigured()).toBe(false);

    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
    expect(storeConfigured()).toBe(false);
  });

  /* Whitespace is not a credential. A variable set to a stray space in a
     dashboard would otherwise put the endpoint into its configured path and
     fail every write. */
  it('treats a whitespace-only value as unset', () => {
    vi.stubEnv('SUPABASE_URL', '   ');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '   ');
    expect(storeConfigured()).toBe(false);
  });
});
