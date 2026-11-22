-- End a game without a winner: for duplicates and games someone stopped playing. Either player can
-- end an active game. An ended game doesn't count in any record (records only read 'finished'),
-- drops off both players' game lists, and sends no notification.

alter table public.games drop constraint games_status_check;
alter table public.games add constraint games_status_check check (status in ('active', 'finished', 'cancelled'));
alter table public.games add column ended_by uuid references public.profiles on delete set null;

create function public.end_game(gid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.games
     set status = 'cancelled', turn = null, ended_by = auth.uid(), updated_at = now()
   where id = gid and status = 'active' and auth.uid() in (player1, player2);
  if not found then raise exception 'not your active game'; end if;
end $$;

revoke execute on function public.end_game(uuid) from public, anon;
grant execute on function public.end_game(uuid) to authenticated;

-- Ended games don't show in the games list.
do $$
declare
  def text := pg_get_functiondef('public.list_games'::regproc);
  fixed text := replace(def,
    'where auth.uid() in (g.player1, g.player2)',
    'where auth.uid() in (g.player1, g.player2) and g.status <> ''cancelled''');
begin
  if fixed = def then raise exception 'list_games filter not found'; end if;
  execute fixed;
end $$;
