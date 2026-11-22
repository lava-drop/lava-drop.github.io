-- 2026-11-22: no easy/hard choice, just one bot that's somewhat competitive.
-- Magma is the only bot offered. It plays a hunch 30% of the time, only says the word when it's
-- sure, and sets a random pick from its 40 best words instead of its 12 nastiest.
-- Spark stays in the database so old games still load, but isn't offered any more.
do $$
declare src text;
begin
  select pg_get_functiondef('public.bot_guess(uuid, uuid, text)'::regprocedure) into src;
  src := replace(src, 'if n = 1 or (skill = ''hard'' and n = 2 and random() < 0.5) then', 'if n = 1 then');
  src := replace(src, 'if skill = ''easy'' and random() < 0.7 then',
                      'if random() < (case when skill = ''easy'' then 0.7 else 0.3 end) then');
  src := replace(src, 'offset case when skill = ''hard'' and random() < 0.1 then 1 else 0 end', 'offset 0');
  if src not like '%else 0.3 end%' or src like '%n = 2%' then raise exception 'bot_guess patch did not apply'; end if;
  execute src;

  select pg_get_functiondef('public.bot_set(uuid, uuid, text)'::regprocedure) into src;
  src := replace(src, 'limit 12) t', 'limit 40) t');
  if src not like '%limit 40) t%' then raise exception 'bot_set patch did not apply'; end if;
  execute src;
end $$;

create or replace function public.list_bots() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'username', username, 'color', color, 'bot', bot)), '[]'::jsonb)
  from public.profiles where bot = 'hard'
$$;
