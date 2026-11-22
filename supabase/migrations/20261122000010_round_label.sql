-- The round shown in the games list counted only the words *you* had guessed, so the player who
-- went second saw "Round 5" while still setting their round-4 word. A round is done when both
-- players have played it: round = 1 + (finished words in the game) / 2.
do $$
declare
  def text := pg_get_functiondef('public.list_games'::regproc);
  fixed text := regexp_replace(def,
    'and w\.solver = auth\.uid\(\)\s+and w\.status <> ''open''\)',
    'and w.status <> ''open'') / 2');
begin
  if fixed = def then raise exception 'list_games round expression not found'; end if;
  execute fixed;
end $$;
