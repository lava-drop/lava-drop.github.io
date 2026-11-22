-- Spark (the easy bot) solved 8 of 10 words in testing: too good for "easy".
-- It now plays a hunch (a common letter, not worked out from the pattern) 70% of the time, not 45%.
do $$
declare src text;
begin
  select pg_get_functiondef('public.bot_guess(uuid, uuid, text)'::regprocedure) into src;
  execute replace(src, 'random() < 0.45', 'random() < 0.7');
end $$;
