-- Identity alignment: the app uses local text user ids ("user-<timestamp>"),
-- not Supabase auth uuids. push_tokens was unreachable (uuid FK + auth.uid()
-- policy), which is why the table stayed empty and nudges could never send.
-- Writes go through the server's service-role key; the policy is
-- defense-in-depth for any future direct client access, same as bb_events.

-- Order matters: the RLS policy references user_id, so Postgres refuses to
-- alter the column type while the policy exists ("cannot alter type of a
-- column used in a policy definition"). Drop policy first, alter, recreate.
drop policy if exists "push_tokens: own rows only" on public.push_tokens;
alter table public.push_tokens drop constraint if exists push_tokens_user_id_fkey;
alter table public.push_tokens alter column user_id type text using user_id::text;

create policy "push_tokens: own rows only"
  on public.push_tokens for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);
