alter table public.profiles alter column plan set default 'JobPilot Access';
alter table public.profiles alter column license_status set default 'active';
alter table public.subscriptions alter column plan set default 'JobPilot Access';
alter table public.subscriptions alter column status set default 'active';

update public.profiles
set plan = 'JobPilot Access', license_status = 'active'
where lower(coalesce(plan, '')) = 'trial'
   or lower(coalesce(license_status, '')) = 'trial';

update public.subscriptions
set plan = 'JobPilot Access', status = 'active'
where lower(coalesce(plan, '')) = 'trial'
   or lower(coalesce(status, '')) = 'trial';
