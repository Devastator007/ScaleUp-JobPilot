alter table public.profiles
  add column if not exists job_preferences jsonb not null default '{
    "platforms": ["LinkedIn"],
    "must_have_keywords": "",
    "exclude_keywords": "",
    "minimum_match_score": 70,
    "daily_apply_limit": 10,
    "application_mode": "review"
  }'::jsonb,
  add column if not exists application_answers jsonb not null default '{}'::jsonb;

alter table public.jobs
  add column if not exists source_key text,
  add column if not exists action_status text not null default 'review',
  add column if not exists application_route text not null default 'outside_portal';

alter table public.applications
  add column if not exists answer_pack jsonb not null default '{}'::jsonb;

create unique index if not exists idx_jobs_user_source_key
  on public.jobs(user_id, source_key)
  where source_key is not null and source_key <> '';
create unique index if not exists idx_applications_user_job
  on public.applications(user_id, job_id);

alter table public.jobs
  drop constraint if exists jobs_action_status_check;
alter table public.jobs
  add constraint jobs_action_status_check
  check (action_status in ('review', 'ready', 'candidate_action_required', 'submitted'));

alter table public.jobs
  drop constraint if exists jobs_application_route_check;
alter table public.jobs
  add constraint jobs_application_route_check
  check (application_route in ('jobpilot', 'outside_portal'));

comment on column public.profiles.job_preferences is
  'Single source of truth for job discovery criteria previously duplicated in saved_searches.';
comment on column public.profiles.application_answers is
  'Candidate-provided reusable answers used to prepare applications; never stores third-party passwords.';
comment on column public.jobs.action_status is
  'Review/application action state. Outside portals require explicit candidate action unless a supported direct integration exists.';
