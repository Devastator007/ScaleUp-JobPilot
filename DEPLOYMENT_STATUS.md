# Deployment Status

## GitHub Pages

Repository status:

```text
public
```

Expected public route:

```text
https://ahmedhamdy687-prog.github.io/ScaleUp-JobPilot/
```

Current verified status as of 2026-07-26:

- The repository is public.
- The route returns GitHub Pages `404 Site not found`.
- Pages deployment is not live.

GitHub does not allow `actions/configure-pages` to enable a site with the
workflow's default `GITHUB_TOKEN`. An administrator must enable Pages once:

1. Open repository **Settings -> Pages**.
2. Under **Build and deployment**, select **GitHub Actions** as the source.
3. Open **Actions -> Deploy static app to GitHub Pages**.
4. Run the workflow on `main`.
5. Require the `Verify public deployment` step to pass before reporting the
   application as live.

The workflow intentionally verifies HTTP `200` and the `ScaleUp JobPilot`
application marker after deployment.

## Supabase

Configured project reference:

```text
ecprbghkcfxuperaxgzo
```

The repository contains the initial schema and entitlement migrations, but this
runtime does not have access to that Supabase project. Their production
application, RLS state, and end-to-end manual activation behavior are therefore
not confirmed.

Before reporting production readiness:

1. Connect an account with access to project `ecprbghkcfxuperaxgzo`.
2. Inspect existing tables and migration history.
3. Apply only missing migrations in numeric order.
4. Verify RLS and entitlement triggers with customer and administrator test
   accounts.
5. Test trial denial, manual InstaPay/bank-transfer approval, expiry, and
   renewal.
