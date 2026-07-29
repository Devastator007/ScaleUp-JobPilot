grant select, insert, update on table public.profiles to authenticated;

comment on table public.profiles is
  'Candidate-owned JobPilot setup. Table grants permit authenticated access; RLS policies restrict every operation to the owning user.';
