-- Words players tried to set that aren't in the dictionary (2026-11-24), so missing words show up
-- here instead of as complaints. The app logs a word after it has sat on the make-a-word screen
-- marked "Not in our word list" for 3 seconds. Read it with:
--   select word, count(*), count(distinct user_id) from missed_words group by 1 order by 2 desc;
create table public.missed_words (
  id bigint generated always as identity primary key,
  word text not null check (word ~ '^[a-z]{4,8}$'),
  user_id uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);
alter table public.missed_words enable row level security; -- no policies: only the function writes

create function public.log_missed_word(w text) returns void
language plpgsql security definer set search_path = public as $$
declare t text := lower(trim(w));
begin
  if auth.uid() is null or t !~ '^[a-z]{4,8}$' then return; end if;
  if exists (select 1 from public.dictionary d where d.word = t) then return; end if;
  -- One row per player per word per day, and a daily cap, so it can't be flooded.
  if exists (select 1 from public.missed_words m where m.user_id = auth.uid() and m.word = t
             and m.created_at > now() - interval '1 day') then return; end if;
  if (select count(*) from public.missed_words m where m.user_id = auth.uid()
      and m.created_at > now() - interval '1 day') >= 100 then return; end if;
  insert into public.missed_words (word, user_id) values (t, auth.uid());
end $$;

revoke execute on function public.log_missed_word(text) from public, anon;
grant execute on function public.log_missed_word(text) to authenticated;
