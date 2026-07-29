-- Grant every authenticated JobPilot customer a seven-day trial from their
-- immutable auth account creation time. Paid access requires an approved,
-- future-dated subscription. The named owner account remains unrestricted.

create or replace function public.has_active_jobpilot_access()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select
    (select auth.uid()) is not null
    and (
      exists (
        select 1
        from auth.users
        where id = (select auth.uid())
          and lower(email) = 'ahmed_hamdy_mahdy@outlook.com'
      )
      or exists (
        select 1
        from public.subscriptions
        where user_id = (select auth.uid())
          and lower(status) in ('active', 'approved')
          and current_period_end is not null
          and current_period_end > now()
      )
      or exists (
        select 1
        from auth.users
        where id = (select auth.uid())
          and created_at + interval '7 days' > now()
      )
    );
$$;

revoke all on function public.has_active_jobpilot_access() from public;
grant execute on function public.has_active_jobpilot_access() to authenticated;

comment on function public.has_active_jobpilot_access() is
  'JobPilot entitlement: unrestricted named owner, approved future-dated subscription, or seven days from immutable auth account creation.';
