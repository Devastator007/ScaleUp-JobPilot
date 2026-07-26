# ScaleUp JobPilot Cloud

ScaleUp JobPilot Cloud is a Supabase-backed web app for selling a cloud version of the JobPilot product quickly. It includes account auth, customer profiles, saved searches, tracked jobs, pipeline views, analytics, billing/license display, and a secure Supabase schema with Row Level Security.

This version is intentionally built as a static app so it can be deployed fast to Netlify, Vercel, Cloudflare Pages, or any static hosting provider.

## What Is Included

- Supabase email/password authentication.
- User profile onboarding.
- Saved job searches.
- Job tracker with status pipeline: Saved, Applied, Interviewing, Offer, Rejected.
- Dashboard metrics and recent activity.
- Billing/license status display.
- Manual InstaPay/bank-transfer activation with database-enforced approval and expiry.
- Supabase SQL migration with RLS policies.
- Responsive commercial UI ready for screenshots and website demos.

## What Is Not Included Yet

- Server-side job scraping. This is intentionally not included in the cloud MVP because automated job-board scraping from cloud servers is fragile and may violate platform rules.
- Automated payment processing. Activation remains intentionally manual through approved InstaPay or direct bank-transfer verification.
- AI scoring API calls. The database/UI are ready for match scores and summaries; add an Edge Function when your OpenAI/Claude key is ready.

## Recommended This-Week Sales Positioning

Sell this first version as:

> A cloud job-search workspace for tracking applications, saved searches, fit scores, and pipeline progress.

Then offer the Windows desktop automation app as:

> Optional desktop assistant for users who want local browser-based application help.

This avoids promising cloud scraping while still giving customers a useful paid product.

## Supabase Setup

1. Create a new Supabase project for ScaleUp JobPilot.
2. Open Supabase SQL Editor.
3. Run `supabase/migrations/001_initial_schema.sql`, then `002_enforce_license_approval.sql`, then `003_enforce_entitlement_expiry.sql` in order.
4. In Supabase Auth settings, enable Email provider.
5. For quick testing, disable email confirmation. For production, enable confirmation.
6. Copy your anon/publishable key from Project Settings -> API.
7. Edit `config.js`:

```js
window.SCALEUP_CONFIG = {
  SUPABASE_URL: "https://ecprbghkcfxuperaxgzo.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY",
  APP_NAME: "ScaleUp JobPilot",
  SUPPORT_EMAIL: "support@scaleuptech.org"
};
```

Do not put a Supabase service role key in `config.js`.

## Local Test

Because browser module/CDN behavior can be restricted from `file://`, run a small static server from this folder:

```powershell
python -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

## Deploy

Upload the folder to a static host:

- Netlify: drag the folder into Netlify deploys.
- Vercel: import as a static project.
- Cloudflare Pages: upload or connect Git.
- Any cPanel/shared hosting: upload files into a public directory.

## Production Checklist

- Replace `config.js` with real Supabase values.
- Configure the approved InstaPay/bank-transfer instructions and support contact on the commercial website.
- Add privacy policy, terms, refund policy, and responsible-use wording on `scaleuptech.org`.
- Create a demo account for screenshots.
- Test signup, login, add job, edit job, save search, profile save, sign out.
- Test with two accounts to confirm users cannot see each other's data.
- Verify a manual approval, renewal, and expiry with separate customer and administrator test accounts.

## Security Notes

- RLS is enabled for all customer data tables.
- Policies restrict rows to the authenticated owner.
- The browser app only uses the public anon/publishable key.
- Subscription rows are read-only from the browser. Approve manual transfers only through a trusted administrator path, always setting a future `current_period_end`.

## Suggested Paid Plans

- Starter: job tracker, saved searches, pipeline, reports.
- Pro: AI fit scoring, cover letter drafts, advanced analytics.
- Desktop Bundle: cloud workspace plus Windows JobPilot assistant.
