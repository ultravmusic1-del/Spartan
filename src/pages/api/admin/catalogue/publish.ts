/**
 * Ask Vercel to build the site, so saved catalogue edits become the live site.
 *
 * IT REPORTS "BUILD REQUESTED", NEVER "PUBLISHED". The deploy hook returns a job
 * id the moment it accepts the request and says nothing about whether the build
 * succeeds — it can fail on a schema violation, a broken image path, or an
 * unrelated commit somebody pushed a minute earlier. Rule 2's principle in a
 * second place: report what is known, not what is hoped.
 *
 * UNCONFIGURED IS AN ERROR HERE, which is deliberately the opposite of the
 * enquiry path. An enquiry submitted with no email credentials was still
 * written to Postgres, so nothing was lost and reporting failure would have
 * been a lie in the other direction. A publish with no hook records nothing at
 * all: it either requested a build or it did not.
 *
 * There is no rate limit. The hook is Vercel's to throttle, an admin pressing
 * the button twice costs one queued build, and the only people who can reach
 * this route are the ones on the `admins` allow-list.
 */
import type { APIRoute } from 'astro';
import { env, configured } from '../../../../lib/env';
import type { NoticeCode } from '../../../../lib/admin/notices';

export const prerender = false;

const HOOK = 'VERCEL_DEPLOY_HOOK_URL';
const to = (notice: NoticeCode): string => `/admin/catalogue?notice=${notice}`;

export const POST: APIRoute = async ({ redirect }) => {
  if (!configured(HOOK)) return redirect(to('publish-unconfigured'), 302);

  try {
    const response = await fetch(env(HOOK), { method: 'POST' });
    if (!response.ok) {
      /*
       * The status is logged and not shown. A deploy hook answers 404 for a
       * hook that has been deleted and 403 for one whose project has been
       * moved, and the difference is the whole diagnosis — but it is a
       * maintainer's diagnosis, not an editor's, and the notice vocabulary is
       * a closed whitelist for a reason.
       */
      console.error(`[admin] deploy hook refused the request: ${response.status}`);
      return redirect(to('publish-failed'), 302);
    }
    return redirect(to('publish-requested'), 302);
  } catch (cause) {
    console.error('[admin] deploy hook unreachable', cause);
    return redirect(to('publish-failed'), 302);
  }
};
