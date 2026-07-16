drop policy if exists "activity delete own" on public.activity_events;
create policy "activity delete own"
on public.activity_events for delete
to authenticated
using ((select auth.uid()) = user_id);
