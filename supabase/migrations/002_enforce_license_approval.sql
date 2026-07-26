-- Prevent browser-authenticated users from granting themselves paid access.
-- Trusted backend operations using the Supabase service role remain able to
-- activate, renew, expire, or change plans after manual payment approval.

create or replace function public.enforce_profile_license_approval()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.plan := 'trial';
      new.license_status := 'trial';
    else
      new.plan := old.plan;
      new.license_status := old.license_status;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_enforce_license_approval on public.profiles;
create trigger trg_profiles_enforce_license_approval
before insert or update on public.profiles
for each row execute function public.enforce_profile_license_approval();

comment on function public.enforce_profile_license_approval() is
  'Prevents authenticated browser clients from self-activating plans or licenses; service-role admin workflows may approve manual payments.';
