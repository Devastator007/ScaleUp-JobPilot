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
- GitHub Pages is enabled with **GitHub Actions** as its source.
- The public route returns the `ScaleUp JobPilot` application.
- The deployed HTML, JavaScript, configuration, and stylesheet are
  independently required to return HTTP `200` with expected application
  markers after every deployment.

The Pages workflow fails closed when the route or any required production asset
is missing, stale, or invalid.

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
