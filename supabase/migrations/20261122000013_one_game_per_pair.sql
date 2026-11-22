-- Tapping Play on someone you already have a game going with started a second game, so the
-- home screen showed the same player twice. start_game now returns the game already in progress
-- with that opponent instead of making a new one.
do $$
declare
  def text := pg_get_functiondef('public.start_game(uuid)'::regprocedure);
  fixed text := regexp_replace(def,
    '(raise exception ''too many games'';\s*end if;)',
    E'\\1\n  select id into gid from public.games\n   where status = ''active''\n     and ((player1 = auth.uid() and player2 = opponent) or (player2 = auth.uid() and player1 = opponent))\n   order by created_at desc limit 1;\n  if gid is not null then return gid; end if;');
begin
  if fixed = def then raise exception 'start_game anchor not found'; end if;
  execute fixed;
end $$;
