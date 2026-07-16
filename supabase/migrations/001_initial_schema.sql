create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  target_title text not null default '',
  location text not null default '',
  linkedin_url text not null default '',
  portfolio_url text not null default '',
  resume_summary text not null default '',
  plan text not null default 'trial',
  license_status text not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'manual',
  provider_customer_id text,
  provider_subscription_id text,
  plan text not null default 'trial',
  status text not null default 'trial',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  platform text not null default '',
  keywords text not null default '',
  location text not null default '',
  frequency text not null default 'manual',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_search_id uuid references public.saved_searches(id) on delete set null,
  title text not null,
  company text not null default '',
  platform text not null default 'Manual',
  status text not null default 'Saved',
  location text not null default '',
  salary text not null default '',
  url text not null default '',
  description text not null default '',
  notes text not null default '',
  match_score int check (match_score is null or (match_score >= 0 and match_score <= 100)),
  ai_summary text not null default '',
  follow_up_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  status text not null default 'draft',
  cover_letter text not null default '',
  submitted_at timestamptz,
  response_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  message text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_saved_searches_user on public.saved_searches(user_id);
create index if not exists idx_jobs_user_status on public.jobs(user_id, status);
create index if not exists idx_jobs_user_created on public.jobs(user_id, created_at desc);
create index if not exists idx_applications_user on public.applications(user_id);
create index if not exists idx_activity_events_user_created on public.activity_events(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists trg_saved_searches_updated_at on public.saved_searches;
create trigger trg_saved_searches_updated_at
before update on public.saved_searches
for each row execute function public.set_updated_at();

drop trigger if exists trg_jobs_updated_at on public.jobs;
create trigger trg_jobs_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

drop trigger if exists trg_applications_updated_at on public.applications;
create trigger trg_applications_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.saved_searches enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.activity_events enable row level security;

drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "subscriptions select own" on public.subscriptions;
create policy "subscriptions select own"
on public.subscriptions for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "saved searches select own" on public.saved_searches;
create policy "saved searches select own"
on public.saved_searches for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "saved searches insert own" on public.saved_searches;
create policy "saved searches insert own"
on public.saved_searches for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "saved searches update own" on public.saved_searches;
create policy "saved searches update own"
on public.saved_searches for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "saved searches delete own" on public.saved_searches;
create policy "saved searches delete own"
on public.saved_searches for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "jobs select own" on public.jobs;
create policy "jobs select own"
on public.jobs for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "jobs insert own" on public.jobs;
create policy "jobs insert own"
on public.jobs for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "jobs update own" on public.jobs;
create policy "jobs update own"
on public.jobs for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "jobs delete own" on public.jobs;
create policy "jobs delete own"
on public.jobs for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "applications select own" on public.applications;
create policy "applications select own"
on public.applications for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "applications insert own" on public.applications;
create policy "applications insert own"
on public.applications for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "applications update own" on public.applications;
create policy "applications update own"
on public.applications for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "applications delete own" on public.applications;
create policy "applications delete own"
on public.applications for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "activity select own" on public.activity_events;
create policy "activity select own"
on public.activity_events for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "activity insert own" on public.activity_events;
create policy "activity insert own"
on public.activity_events for insert
to authenticated
with check ((select auth.uid()) = user_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.saved_searches,
  public.jobs,
  public.applications,
  public.activity_events
to authenticated;
grant select on public.subscriptions to authenticated;
