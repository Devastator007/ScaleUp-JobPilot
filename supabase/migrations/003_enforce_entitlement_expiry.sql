-- Enforce paid JobPilot access for customer workspace data.
-- Manual administrators must create or update a subscription with an approved
-- status and a future expiry. Browser clients cannot write subscriptions.

create or replace function public.has_active_jobpilot_access()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1
      from public.subscriptions
      where user_id = (select auth.uid())
        and lower(status) in ('active', 'approved')
        and current_period_end is not null
        and current_period_end > now()
    )
    or (
      not exists (
        select 1
        from public.subscriptions
        where user_id = (select auth.uid())
      )
      and exists (
        select 1
        from public.profiles
        where id = (select auth.uid())
          and lower(license_status) in ('active', 'approved')
      )
    );
$$;

revoke all on function public.has_active_jobpilot_access() from public;
grant execute on function public.has_active_jobpilot_access() to authenticated;

comment on function public.has_active_jobpilot_access() is
  'Returns true for a future-dated approved manual subscription, with a legacy profile fallback only when no subscription row exists.';

drop policy if exists "saved searches select own" on public.saved_searches;
create policy "saved searches select own with access"
on public.saved_searches for select to authenticated
using ((select auth.uid()) = user_id and (select public.has_active_jobpilot_access()));

drop policy if exists "saved searches insert own" on public.saved_searches;
create policy "saved searches insert own with access"
on public.saved_searches for insert to authenticated
with check ((select auth.uid()) = user_id and (select public.has_active_jobpilot_access()));

drop policy if exists "saved searches update own" on public.saved_searches;
create policy "saved searches update own with access"
on public.saved_searches for update to authenticated
using ((select auth.uid()) = user_id and (select public.has_active_jobpilot_access()))
with check ((select auth.uid()) = user_id and (select public.has_active_jobpilot_access()));

drop policy if exists "saved searches delete own" on public.saved_searches;
create policy "saved searches delete own with access"
on public.saved_searches for delete to authenticated
using ((select auth.uid()) = user_id and (select public.has_active_jobpilot_access()));

drop policy if exists "jobs select own" on public.jobs;
create policy "jobs select own with access"
on public.jobs for select to authenticated
using ((select auth.uid()) = user_id and (select public.has_active_jobpilot_access()));

drop policy if exists "jobs insert own" on public.jobs;
create policy "jobs insert own with access"
on public.jobs for insert to authenticated
with check ((select auth.uid()) = user_id and (select public.has_active_jobpilot_access()));

drop policy if exists "jobs update own" on public.jobs;
create policy "jobs update own with access"
on public.jobs for update to authenticated
using ((select auth.uid()) = user_id and (select public.has_active_jobpilot_access()))
with check ((select auth.uid()) = user_id and (select public.has_active_jobpilot_access()));

drop policy if exists "jobs delete own" on public.jobs;
create policy "jobs delete own with access"
on public.jobs for delete to authenticated
using ((select auth.uid()) = user_id and (select public.has_active_jobpilot_access()));

drop policy if exists "applications select own" on public.applications;
create policy "applications select own with access"
on public.applications for select to authenticated
using ((select auth.uid()) = user_id and (select public.has_active_jobpilot_access()));

drop policy if exists "applications insert own" on public.applications;
create policy "applications insert own with access"
on public.applications for insert to authenticated
with check ((select auth.uid()) = user_id and (select public.has_active_jobpilot_access()));

drop policy if exists "applications update own" on public.applications;
create policy "applications update own with access"
on public.applications for update to authenticated
using ((select auth.uid()) = user_id and (select public.has_active_jobpilot_access()))
with check ((select auth.uid()) = user_id and (select public.has_active_jobpilot_access()));

drop policy if exists "applications delete own" on public.applications;
create policy "applications delete own with access"
on public.applications for delete to authenticated
using ((select auth.uid()) = user_id and (select public.has_active_jobpilot_access()));

drop policy if exists "activity select own" on public.activity_events;
create policy "activity select own with access"
on public.activity_events for select to authenticated
using ((select auth.uid()) = user_id and (select public.has_active_jobpilot_access()));

drop policy if exists "activity insert own" on public.activity_events;
create policy "activity insert own with access"
on public.activity_events for insert to authenticated
with check ((select auth.uid()) = user_id and (select public.has_active_jobpilot_access()));
