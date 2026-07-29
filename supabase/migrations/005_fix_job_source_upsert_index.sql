drop index if exists public.idx_jobs_user_source_key;
create unique index idx_jobs_user_source_key
  on public.jobs(user_id, source_key);
