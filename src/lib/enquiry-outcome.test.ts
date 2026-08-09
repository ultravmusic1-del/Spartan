import { describe, it, expect } from 'vitest';
import { decideOutcome, type ChannelState } from './enquiry-outcome';

/**
 * All nine combinations, asserted directly. The whole reason `decideOutcome` is
 * a pure function is that the two mistakes available here are both expensive and
 * neither is visible from a passing e2e run:
 *
 *  - reporting success when nothing captured the enquiry loses the lead in
 *    exactly the way this feature exists to prevent;
 *  - reporting failure when the row *was* written sends the buyer round again
 *    and writes a duplicate.
 */
const cases: Array<{
  store: ChannelState;
  email: ChannelState;
  status: number;
  ok: boolean;
  recorded: boolean;
  delivered: boolean;
  logPayload: boolean;
  why: string;
}> = [
  // Something carried it. Success, whichever channel it was.
  { store: 'ok', email: 'ok', status: 200, ok: true, recorded: true, delivered: true, logPayload: false, why: 'both channels succeeded' },
  { store: 'ok', email: 'failed', status: 200, ok: true, recorded: true, delivered: false, logPayload: false, why: 'row written, mail provider down — the lead is safe' },
  { store: 'ok', email: 'unconfigured', status: 200, ok: true, recorded: true, delivered: false, logPayload: false, why: 'row written, no mail credentials' },
  { store: 'failed', email: 'ok', status: 200, ok: true, recorded: false, delivered: true, logPayload: false, why: 'database down but the email reached a human' },
  { store: 'unconfigured', email: 'ok', status: 200, ok: true, recorded: false, delivered: true, logPayload: false, why: 'email only, as the site behaved before the database existed' },

  // Nothing configured: local dev and CI. Not a lost lead — nothing was asked
  // to carry it. This is the case that would 502 every e2e submission if the
  // endpoint treated "unconfigured" and "failed" as the same thing.
  { store: 'unconfigured', email: 'unconfigured', status: 200, ok: true, recorded: false, delivered: false, logPayload: true, why: 'no channel configured at all' },

  // At least one channel was configured and every configured one failed.
  { store: 'failed', email: 'failed', status: 502, ok: false, recorded: false, delivered: false, logPayload: true, why: 'both configured channels failed' },
  { store: 'failed', email: 'unconfigured', status: 502, ok: false, recorded: false, delivered: false, logPayload: true, why: 'the only configured channel failed' },
  { store: 'unconfigured', email: 'failed', status: 502, ok: false, recorded: false, delivered: false, logPayload: true, why: 'the only configured channel failed' },
];

describe('decideOutcome', () => {
  for (const c of cases) {
    it(`store=${c.store} email=${c.email} → ${c.status} (${c.why})`, () => {
      const outcome = decideOutcome(c.store, c.email);

      expect(outcome.status).toBe(c.status);
      expect(outcome.body.ok).toBe(c.ok);
      expect(outcome.body.recorded).toBe(c.recorded);
      expect(outcome.body.delivered).toBe(c.delivered);
      expect(outcome.logPayload).toBe(c.logPayload);
    });
  }

  it('never reports success when neither channel carried the enquiry and one was configured', () => {
    const states: ChannelState[] = ['unconfigured', 'ok', 'failed'];

    for (const store of states) {
      for (const email of states) {
        const outcome = decideOutcome(store, email);
        const carried = store === 'ok' || email === 'ok';
        const anyConfigured = store !== 'unconfigured' || email !== 'unconfigured';

        if (!carried && anyConfigured) {
          expect(outcome.body.ok, `${store}/${email} must not report success`).toBe(false);
        }
      }
    }
  });

  it('always keeps the payload when nothing durable holds it', () => {
    const states: ChannelState[] = ['unconfigured', 'ok', 'failed'];

    for (const store of states) {
      for (const email of states) {
        const outcome = decideOutcome(store, email);
        if (store !== 'ok' && email !== 'ok') {
          expect(outcome.logPayload, `${store}/${email} must log the payload`).toBe(true);
        }
      }
    }
  });

  it('only ever claims recorded or delivered when that channel actually succeeded', () => {
    const states: ChannelState[] = ['unconfigured', 'ok', 'failed'];

    for (const store of states) {
      for (const email of states) {
        const outcome = decideOutcome(store, email);
        expect(outcome.body.recorded).toBe(store === 'ok');
        expect(outcome.body.delivered).toBe(email === 'ok');
      }
    }
  });
});
