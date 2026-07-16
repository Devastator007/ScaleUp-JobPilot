# Deployment Status

## Supabase

Project URL:

```text
https://ecprbghkcfxuperaxgzo.supabase.co
```

Project ref:

```text
ecprbghkcfxuperaxgzo
```

Database status:

- Initial schema migration applied.
- Tables created: `profiles`, `subscriptions`, `saved_searches`, `jobs`, `applications`, `activity_events`.
- Row Level Security is enabled on all customer-data tables.
- Policies restrict customer rows to the authenticated owner.

## Still Needed

1. Open Supabase Dashboard.
2. Go to Project Settings -> API.
3. Copy the public anon key or publishable key.
4. Replace this value in `config.js`:

```js
SUPABASE_ANON_KEY: "PASTE_YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY_HERE"
```

5. In Auth -> Providers, confirm Email is enabled.
6. For quick testing, you may temporarily disable email confirmation. For production, enable confirmation.

## GitHub

The GitHub app/API could not access:

```text
ahmedhamdy687-prog/ScaleUp-JobPilot
```

The API returned 404, which usually means one of these:

- the repo is private and the GitHub connector does not have access;
- the repo name or owner is different;
- the GitHub connector is authorized for another GitHub account.

Grant the GitHub connector access to the repo or make the repo public temporarily, then I can push the files.
