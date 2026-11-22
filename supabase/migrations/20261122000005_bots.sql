-- Computer opponents, so someone with no friends on it yet can still play.
-- Two bot accounts (created by tools/create-bots.mjs, flagged here by username): an easy one that
-- guesses sloppily and sets plain words, and a hard one that plays the odds and sets nasty words.
-- The bot moves inside the player's own request, right after the turn passes to it.

alter table public.profiles add column bot text check (bot in ('easy', 'hard'));

-- ---------------------------------------------------------------- moves without the auth check
-- The public move functions check the caller, then call these. Bots call these directly.

create function public.apply_letter(gid uuid, uid uuid, c text) returns void
language plpgsql as $$
declare
  w public.game_words;
begin
  select * into w from public.game_words
   where game_id = gid and solver = uid and status = 'open' for update;
  if not found then raise exception 'nothing to solve'; end if;
  if strpos(w.guesses, c) > 0 then return; end if;
  w.guesses := w.guesses || c;
  if strpos(w.word, c) = 0 then w.misses := w.misses + 1; end if;
  update public.game_words set guesses = w.guesses, misses = w.misses where id = w.id;
  if public.mask_word(w.word, w.guesses) = w.word then
    perform public.finish_word(w, true);
    perform public.advance_game(gid);
  elsif w.misses >= public.max_misses() then
    perform public.finish_word(w, false);
    perform public.advance_game(gid);
  end if;
end $$;

create function public.apply_word(gid uuid, uid uuid, t text) returns void
language plpgsql as $$
declare
  w public.game_words;
begin
  select * into w from public.game_words
   where game_id = gid and solver = uid and status = 'open' for update;
  if not found then raise exception 'nothing to solve'; end if;
  if t = w.word then
    perform public.finish_word(w, true);
  else
    w.misses := w.misses + 1;
    update public.game_words set misses = w.misses, wrong_words = wrong_words || t where id = w.id;
    if w.misses < public.max_misses() then return; end if;
    perform public.finish_word(w, false);
  end if;
  perform public.advance_game(gid);
end $$;

-- Returns 'ok', 'bad_length', 'not_in_rack' or 'not_a_word'.
create function public.apply_submit(gid uuid, uid uuid, t text) returns text
language plpgsql as $$
declare
  g public.games;
  r public.game_racks;
  n int;
begin
  select * into g from public.games where id = gid;
  if t !~ '^[a-z]{4,8}$' then return 'bad_length'; end if;
  select * into r from public.game_racks where game_id = gid and user_id = uid;
  if not found or not public.fits_rack(t, r.letters) then return 'not_in_rack'; end if;
  if not exists (select 1 from public.dictionary d where d.word = t) then return 'not_a_word'; end if;
  select count(*) + 1 into n from public.game_words where game_id = gid and setter = uid;
  insert into public.game_words (game_id, seq, setter, solver, word, value)
  values (gid, n, uid, case when uid = g.player1 then g.player2 else g.player1 end, t, public.word_value(t));
  delete from public.game_racks where game_id = gid and user_id = uid;
  perform public.advance_game(gid);
  return 'ok';
end $$;

-- ---------------------------------------------------------------- the bot

create function public.bot_guess(gid uuid, uid uuid, skill text) returns void
language plpgsql as $$
declare
  w public.game_words;
  pat text;
  rx text := '^';
  ch text;
  n int;
  pick text;
  only_word text;
begin
  select * into w from public.game_words where game_id = gid and solver = uid and status = 'open';
  pat := public.mask_word(w.word, w.guesses);
  foreach ch in array regexp_split_to_array(pat, '') loop
    rx := rx || case when ch <> '_' then ch
                     when w.guesses = '' then '.'
                     else '[^' || w.guesses || ']' end;
  end loop;
  rx := rx || '$';

  select count(*), min(word) into n, only_word from public.dictionary
   where length(word) = length(w.word) and word ~ rx and not (word = any (w.wrong_words));

  -- Sure of it (or, for the hard bot, a coin flip between two): say the word.
  if n = 1 or (skill = 'hard' and n = 2 and random() < 0.5) then
    perform public.apply_word(gid, uid, only_word);
    return;
  end if;

  if skill = 'easy' and random() < 0.45 then
    -- A hunch: one of the more common letters, not worked out from the pattern.
    select l into pick
      from unnest(regexp_split_to_array('etaoinsrhldcumpfgwybvk', '')) with ordinality as t(l, i)
     where strpos(w.guesses, l) = 0
     order by i + random() * 12 limit 1;
  else
    -- The letter that appears in the most words still possible.
    select l into pick from (
      select l, count(*) c
        from public.dictionary d,
             lateral (select distinct x as l from regexp_split_to_table(d.word, '') x) s
       where length(d.word) = length(w.word) and d.word ~ rx and strpos(w.guesses, l) = 0
       group by l) f
     order by c desc, random()
     offset case when skill = 'hard' and random() < 0.1 then 1 else 0 end
     limit 1;
  end if;
  if pick is null then
    pick := (select l from unnest(regexp_split_to_array('abcdefghijklmnopqrstuvwxyz', '')) l
              where strpos(w.guesses, l) = 0 order by random() limit 1);
  end if;
  perform public.apply_letter(gid, uid, pick);
end $$;

create function public.bot_set(gid uuid, uid uuid, skill text) returns void
language plpgsql as $$
declare
  rack text;
  pick text;
begin
  select letters into rack from public.game_racks where game_id = gid and user_id = uid;
  if rack is null then
    rack := public.deal_rack();
    insert into public.game_racks (game_id, user_id, letters) values (gid, uid, rack);
  end if;
  if skill = 'hard' then
    -- Rare letters and few vowels: among the 12 highest-scoring words it can make, at random.
    select word into pick from (
      select word from public.dictionary
       where length(word) between 5 and 8 and word ~ ('^[' || rack || ']+$') and public.fits_rack(word, rack)
       order by public.word_value(word) - 2 * length(regexp_replace(word, '[^aeiou]', '', 'g')) desc
       limit 12) t
     order by random() limit 1;
  else
    select word into pick from public.dictionary
     where length(word) between 5 and 6 and word ~ ('^[' || rack || ']+$') and public.fits_rack(word, rack)
     order by random() limit 1;
  end if;
  if pick is null then
    select word into pick from public.dictionary
     where length(word) >= 4 and word ~ ('^[' || rack || ']+$') and public.fits_rack(word, rack)
     order by random() limit 1;
  end if;
  if pick is null then
    -- Should not happen (racks are dealt to make 8+ words), but never leave the game stuck.
    update public.game_racks set letters = public.deal_rack() where game_id = gid and user_id = uid;
    return;
  end if;
  perform public.apply_submit(gid, uid, pick);
end $$;

-- Plays every move the bots owe in this game, until it's a person's turn or the game ends.
create function public.bot_play(gid uuid) returns void
language plpgsql as $$
declare
  g public.games;
  skill text;
begin
  for i in 1..60 loop
    select * into g from public.games where id = gid for update;
    exit when g.status <> 'active' or g.turn is null;
    select bot into skill from public.profiles where id = g.turn;
    exit when skill is null;
    case public.next_action(g, g.turn)
      when 'solve' then perform public.bot_guess(gid, g.turn, skill);
      when 'set' then perform public.bot_set(gid, g.turn, skill);
      else exit;
    end case;
  end loop;
end $$;

-- ---------------------------------------------------------------- public moves, now via the helpers

create or replace function public.guess_letter(gid uuid, letter text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  g public.games := public.my_game_for_move(gid);
  c text := lower(letter);
begin
  if c !~ '^[a-z]$' then raise exception 'bad letter'; end if;
  perform public.apply_letter(gid, auth.uid(), c);
  perform public.bot_play(gid);
  return public.get_game(gid);
end $$;

create or replace function public.guess_word(gid uuid, guess text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  g public.games := public.my_game_for_move(gid);
  t text := lower(trim(guess));
begin
  if t !~ '^[a-z]{1,12}$' then raise exception 'bad guess'; end if;
  perform public.apply_word(gid, auth.uid(), t);
  perform public.bot_play(gid);
  return public.get_game(gid);
end $$;

create or replace function public.submit_word(gid uuid, word text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  g public.games := public.my_game_for_move(gid);
  res text;
begin
  if public.next_action(g, auth.uid()) <> 'set' then raise exception 'not setting'; end if;
  res := public.apply_submit(gid, auth.uid(), lower(trim(word)));
  if res <> 'ok' then return jsonb_build_object('result', res); end if;
  perform public.bot_play(gid);
  return jsonb_build_object('result', 'ok', 'game', public.get_game(gid));
end $$;

-- Bots aren't added to friend lists; they have their own spot on the New game screen.
create or replace function public.start_game(opponent uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  gid uuid;
  is_bot boolean;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select bot is not null into is_bot from public.profiles where id = opponent;
  if opponent = auth.uid() or is_bot is null then raise exception 'bad opponent'; end if;
  if (select count(*) from public.games
      where status = 'active' and auth.uid() in (player1, player2)) >= 50 then
    raise exception 'too many games';
  end if;
  if not is_bot then
    insert into public.friends (user_id, friend_id) values (auth.uid(), opponent), (opponent, auth.uid())
    on conflict do nothing;
  end if;
  insert into public.games (player1, player2, turn) values (auth.uid(), opponent, auth.uid())
  returning id into gid;
  return gid;
end $$;

create or replace function public.add_friend(name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into p from public.profiles where username = trim(name)::citext;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if p.id = auth.uid() then return jsonb_build_object('result', 'self'); end if;
  if p.bot is not null then return jsonb_build_object('result', 'bot'); end if;
  insert into public.friends (user_id, friend_id) values (auth.uid(), p.id), (p.id, auth.uid())
  on conflict do nothing;
  return jsonb_build_object('result', 'ok', 'friend',
    jsonb_build_object('id', p.id, 'username', p.username, 'color', p.color));
end $$;

create function public.list_bots() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'username', username, 'color', color, 'bot', bot)
                            order by bot = 'hard'), '[]'::jsonb)
  from public.profiles where bot is not null
$$;

-- player_json also says whether the player is a bot.
create or replace function public.player_json(uid uuid, score int) returns jsonb language sql stable as $$
  select jsonb_build_object('id', p.id, 'username', p.username, 'color', p.color, 'score', score, 'bot', p.bot)
  from public.profiles p where p.id = uid
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function
  public.get_game(uuid), public.list_games(), public.list_friends(), public.list_bots(),
  public.set_color(text), public.add_friend(text), public.remove_friend(uuid),
  public.start_game(uuid), public.guess_letter(uuid, text), public.guess_word(uuid, text),
  public.swap_rack(uuid), public.submit_word(uuid, text), public.resign(uuid)
  to authenticated;

update public.profiles set bot = 'easy' where username = 'Spark';
update public.profiles set bot = 'hard' where username = 'Magma';
