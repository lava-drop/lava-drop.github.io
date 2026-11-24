-- New tiles costs points (Thomas, 2026-11-23): trading your rack takes swap_cost() off your score.
-- Penalties live on the game row so advance_game's recount from game_words keeps them.

alter table public.games
  add column penalty1 int not null default 0,
  add column penalty2 int not null default 0;

create or replace function public.swap_cost() returns int language sql immutable as $$ select 5 $$;

create or replace function public.advance_game(gid uuid) returns void
language plpgsql as $$
declare
  g public.games;
  cur uuid;
  other uuid;
begin
  select * into g from public.games where id = gid;
  cur := g.turn;
  other := case when cur = g.player1 then g.player2 else g.player1 end;
  select coalesce(sum(solver_points) filter (where solver = g.player1), 0)
       + coalesce(sum(setter_points) filter (where setter = g.player1), 0) - g.penalty1,
         coalesce(sum(solver_points) filter (where solver = g.player2), 0)
       + coalesce(sum(setter_points) filter (where setter = g.player2), 0) - g.penalty2
    into g.score1, g.score2
    from public.game_words where game_id = gid;

  if public.next_action(g, cur) = 'none' then
    if public.next_action(g, other) <> 'none' then
      cur := other;
    else
      cur := null;
    end if;
  end if;

  update public.games set
    score1 = g.score1,
    score2 = g.score2,
    turn = cur,
    status = case when cur is null then 'finished' else 'active' end,
    winner = case when cur is null then
               case when g.score1 > g.score2 then g.player1
                    when g.score2 > g.score1 then g.player2 end
             end,
    updated_at = now()
  where id = gid;
end $$;

create or replace function public.swap_rack(gid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  g public.games := public.my_game_for_move(gid);
  c int := public.swap_cost();
begin
  if public.next_action(g, auth.uid()) <> 'set' then raise exception 'not setting'; end if;
  update public.game_racks set letters = public.deal_rack(), swaps_left = swaps_left - 1
   where game_id = gid and user_id = auth.uid() and swaps_left > 0;
  if found then
    update public.games set
      penalty1 = penalty1 + case when auth.uid() = player1 then c else 0 end,
      penalty2 = penalty2 + case when auth.uid() = player2 then c else 0 end,
      score1 = score1 - case when auth.uid() = player1 then c else 0 end,
      score2 = score2 - case when auth.uid() = player2 then c else 0 end,
      updated_at = now()
    where id = gid;
  end if;
  return public.get_game(gid);
end $$;
