-- Records instead of high scores: head-to-head W-L per friend, a family leaderboard (wins in games
-- between you and your friends, bots left out), and personal stats for the Me screen.

-- My record against one player: { wins, losses, ties } from my side.
create function public.head_to_head(other uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'wins', count(*) filter (where g.winner = (select auth.uid())),
    'losses', count(*) filter (where g.winner = $1),
    'ties', count(*) filter (where g.winner is null))
  from public.games g
  where g.status = 'finished'
    and ((g.player1 = (select auth.uid()) and g.player2 = $1) or (g.player2 = (select auth.uid()) and g.player1 = $1))
$$;

-- Friends now carry my record against each of them.
create or replace function public.list_friends() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'color', p.color,
                                               'record', public.head_to_head(p.id))
                            order by lower(p.username::text)), '[]'::jsonb)
  from public.friends f join public.profiles p on p.id = f.friend_id
  where f.user_id = (select auth.uid())
$$;

-- Me and my friends, ranked by wins in finished games played between any two of us.
create function public.leaderboard() returns jsonb
language sql stable security definer set search_path = public as $$
  with members as (
    select p.id, p.username, p.color from public.profiles p
    where p.bot is null
      and (p.id = (select auth.uid())
           or p.id in (select friend_id from public.friends where user_id = (select auth.uid())))
  ), gs as (
    select g.player1, g.player2, g.winner from public.games g
    where g.status = 'finished'
      and g.player1 in (select id from members) and g.player2 in (select id from members)
  ), rows as (
    select m.id, m.username, m.color,
           (select count(*) from gs where gs.winner = m.id)::int as wins,
           (select count(*) from gs where m.id in (gs.player1, gs.player2) and gs.winner <> m.id)::int as losses,
           (select count(*) from gs where m.id in (gs.player1, gs.player2))::int as games
    from members m
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'username', username, 'color', color,
                                               'wins', wins, 'losses', losses, 'games', games,
                                               'me', id = (select auth.uid()))
                            order by wins desc, losses asc, lower(username::text)), '[]'::jsonb)
  from rows
$$;

-- Personal stats. Records count people only; the computer gets its own line.
create function public.my_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  res jsonb;
  streak int := 0;
  r record;
begin
  if me is null then raise exception 'not signed in'; end if;
  for r in
    select g.winner from public.games g
      join public.profiles o on o.id = case when g.player1 = me then g.player2 else g.player1 end
    where g.status = 'finished' and me in (g.player1, g.player2) and o.bot is null
    order by g.updated_at desc
  loop
    exit when r.winner is distinct from me;
    streak := streak + 1;
  end loop;

  select jsonb_build_object(
      'wins', count(*) filter (where o.bot is null and g.winner = me),
      'losses', count(*) filter (where o.bot is null and g.winner = o.id),
      'ties', count(*) filter (where o.bot is null and g.winner is null),
      'bot_wins', count(*) filter (where o.bot is not null and g.winner = me),
      'bot_losses', count(*) filter (where o.bot is not null and g.winner = o.id),
      'best_score', max(case when g.player1 = me then g.score1 else g.score2 end) filter (where o.bot is null),
      'streak', streak)
    into res
  from public.games g
    join public.profiles o on o.id = case when g.player1 = me then g.player2 else g.player1 end
  where g.status = 'finished' and me in (g.player1, g.player2);

  return res || jsonb_build_object(
    'stumps', (select count(*) from public.game_words w where w.setter = me and w.status = 'failed'),
    'best_word', (select jsonb_build_object('word', w.word, 'victim', o.username, 'points', w.setter_points)
                  from public.game_words w join public.profiles o on o.id = w.solver
                  where w.setter = me and w.status = 'failed'
                  order by w.setter_points desc, length(w.word) desc, w.finished_at desc
                  limit 1));
end $$;

revoke execute on function public.head_to_head(uuid), public.leaderboard(), public.my_stats() from public, anon;
grant execute on function public.head_to_head(uuid), public.leaderboard(), public.my_stats() to authenticated;
