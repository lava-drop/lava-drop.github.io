-- Touch the game on every guess so the word's setter can watch the balloons pop live
-- (the app listens to changes on games, which is the only game table it can read).
create function public.touch_game() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.games set updated_at = now() where id = new.game_id;
  return new;
end $$;
revoke execute on function public.touch_game() from public, anon, authenticated;

create trigger game_words_touch after update of guesses, misses on public.game_words
  for each row execute function public.touch_game();
