-- Pop Quiz: accounts, friends and two-player word games.
-- Every game rule runs in a security-definer function below. The app can read only its own
-- profile list, friend list and game headers; secret words and letter racks are never readable.

create extension if not exists citext;

-- ---------------------------------------------------------------- tables

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username citext not null unique check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  color text not null default 'sun',
  created_at timestamptz not null default now()
);

create table public.friends (
  user_id uuid not null references public.profiles on delete cascade,
  friend_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create table public.dictionary (word text primary key);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  player1 uuid not null references public.profiles on delete cascade,
  player2 uuid not null references public.profiles on delete cascade,
  rounds int not null default 5 check (rounds between 1 and 10),
  turn uuid references public.profiles,            -- whose move; null once finished
  status text not null default 'active' check (status in ('active', 'finished')),
  score1 int not null default 0,
  score2 int not null default 0,
  winner uuid references public.profiles,          -- null on a tie
  resigned_by uuid references public.profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (player1 <> player2)
);
create index games_player1 on public.games (player1, updated_at desc);
create index games_player2 on public.games (player2, updated_at desc);

create table public.game_racks (
  game_id uuid not null references public.games on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  letters text not null,
  swaps_left int not null default 1,
  primary key (game_id, user_id)
);

create table public.game_words (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games on delete cascade,
  seq int not null,                               -- 1..rounds, per setter
  setter uuid not null references public.profiles,
  solver uuid not null references public.profiles,
  word text not null,
  value int not null,
  guesses text not null default '',               -- letters guessed, in order
  wrong_words text[] not null default '{}',
  misses int not null default 0,
  status text not null default 'open' check (status in ('open', 'solved', 'failed')),
  solver_points int not null default 0,
  setter_points int not null default 0,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (game_id, setter, seq)
);
create index game_words_game on public.game_words (game_id);

-- ---------------------------------------------------------------- row security

alter table public.profiles enable row level security;
alter table public.friends enable row level security;
alter table public.dictionary enable row level security;
alter table public.games enable row level security;
alter table public.game_racks enable row level security;
alter table public.game_words enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy friends_read on public.friends for select to authenticated using (user_id = auth.uid());
create policy games_read on public.games for select to authenticated
  using (auth.uid() in (player1, player2));

revoke all on public.profiles, public.friends, public.dictionary, public.games,
  public.game_racks, public.game_words from anon, authenticated;
grant select on public.profiles, public.friends, public.games to authenticated;

-- Live updates: the app listens for changes to its own games.
alter publication supabase_realtime add table public.games;

-- ---------------------------------------------------------------- constants

create function public.max_misses() returns int language sql immutable as $$ select 6 $$;

-- Rare letters are harder to guess, so they are worth more.
create function public.letter_value(c text) returns int language sql immutable as $$
  select case
    when c in ('e','a','i','o','n','r','t','s','l') then 1
    when c in ('u','d','g') then 2
    when c in ('c','m','h','b','p') then 3
    when c in ('f','w','y','v','k') then 4
    when c in ('j','x') then 6
    when c in ('q','z') then 8
    else 0 end
$$;

create function public.word_value(w text) returns int language sql immutable as $$
  select coalesce(sum(public.letter_value(ch)), 0)::int
  from regexp_split_to_table(w, '') as ch
$$;

-- Ten tiles from a weighted bag, at least three and at most four vowels.
create function public.deal_rack() returns text language plpgsql volatile as $$
declare
  vowels constant text := 'aaaaaaaaaeeeeeeeeeeeeiiiiiiiiioooooooouuuu';
  consonants constant text :=
    'bbccddddffggghhjkllllmmnnnnnnppqrrrrrrssssttttttvvwwxyyz';
  nv int := 3 + floor(random() * 2)::int;
  tiles text[] := '{}';
begin
  for i in 1..nv loop
    tiles := tiles || substr(vowels, 1 + floor(random() * length(vowels))::int, 1);
  end loop;
  for i in 1..(10 - nv) loop
    tiles := tiles || substr(consonants, 1 + floor(random() * length(consonants))::int, 1);
  end loop;
  return (select string_agg(t, '' order by random()) from unnest(tiles) t);
end $$;

-- True when every letter of w can be taken from rack (each tile used once).
create function public.fits_rack(w text, rack text) returns boolean language plpgsql immutable as $$
declare
  r text := rack;
  p int;
  ch text;
begin
  foreach ch in array regexp_split_to_array(w, '') loop
    p := strpos(r, ch);
    if p = 0 then return false; end if;
    r := overlay(r placing '' from p for 1);
  end loop;
  return true;
end $$;

-- ---------------------------------------------------------------- turn engine

-- What a player has to do next in a game: 'solve', 'set' or 'none'.
-- The starter (player1) sets word k once they have finished k-1 of the opponent's words;
-- player2 sets word k once they have finished k. So each turn is: solve one, then set one.
create function public.next_action(g public.games, uid uuid) returns text
language plpgsql stable as $$
declare
  sets int;
  done int;
begin
  if g.status <> 'active' then return 'none'; end if;
  if exists (select 1 from public.game_words
             where game_id = g.id and solver = uid and status = 'open') then
    return 'solve';
  end if;
  select count(*) filter (where setter = uid),
         count(*) filter (where solver = uid and status <> 'open')
    into sets, done
    from public.game_words where game_id = g.id;
  if sets < g.rounds and done >= sets + (case when uid = g.player1 then 0 else 1 end) then
    return 'set';
  end if;
  return 'none';
end $$;

-- After a move: keep the turn, pass it, or finish the game.
create function public.advance_game(gid uuid) returns void
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
       + coalesce(sum(setter_points) filter (where setter = g.player1), 0),
         coalesce(sum(solver_points) filter (where solver = g.player2), 0)
       + coalesce(sum(setter_points) filter (where setter = g.player2), 0)
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

-- The game row for a move by the caller, locked. Raises if it is not their move.
create function public.my_game_for_move(gid uuid) returns public.games
language plpgsql as $$
declare
  g public.games;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into g from public.games where id = gid for update;
  if not found or auth.uid() not in (g.player1, g.player2) then
    raise exception 'no such game';
  end if;
  if g.status <> 'active' or g.turn is distinct from auth.uid() then
    raise exception 'not your turn';
  end if;
  return g;
end $$;

-- Close out a word that has just been solved or failed.
create function public.finish_word(w public.game_words, solved boolean) returns void
language plpgsql as $$
begin
  update public.game_words set
    status = case when solved then 'solved' else 'failed' end,
    solver_points = case when solved then w.value + 2 * (public.max_misses() - w.misses) else 0 end,
    setter_points = case when solved then 0 else w.value end,
    finished_at = now()
  where id = w.id;
end $$;

-- ---------------------------------------------------------------- reads for the app

-- The word with unguessed letters as underscores.
create function public.mask_word(w text, guesses text) returns text language sql immutable as $$
  select string_agg(case when strpos(guesses, ch) > 0 then ch else '_' end, '' order by n)
  from regexp_split_to_table(w, '') with ordinality as t(ch, n)
$$;

create function public.player_json(uid uuid, score int) returns jsonb language sql stable as $$
  select jsonb_build_object('id', p.id, 'username', p.username, 'color', p.color, 'score', score)
  from public.profiles p where p.id = uid
$$;

create function public.get_game(gid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g public.games;
  them uuid;
  act text;
  solving jsonb;
  rack jsonb;
  history jsonb;
  r public.game_racks;
begin
  select * into g from public.games where id = gid;
  if not found or uid is null or uid not in (g.player1, g.player2) then
    return null;
  end if;
  them := case when uid = g.player1 then g.player2 else g.player1 end;
  act := case when g.status <> 'active' then 'done'
              when g.turn = uid then public.next_action(g, uid)
              else 'wait' end;

  select jsonb_build_object(
           'word_id', w.id, 'seq', w.seq, 'length', length(w.word),
           'pattern', public.mask_word(w.word, w.guesses),
           'guesses', w.guesses, 'wrong_words', to_jsonb(w.wrong_words),
           'misses', w.misses, 'max_misses', public.max_misses())
    into solving
    from public.game_words w
   where w.game_id = gid and w.solver = uid and w.status = 'open';

  if act = 'set' then
    select * into r from public.game_racks where game_id = gid and user_id = uid;
    if not found then
      insert into public.game_racks (game_id, user_id, letters)
      values (gid, uid, public.deal_rack()) on conflict do nothing;
      select * into r from public.game_racks where game_id = gid and user_id = uid;
    end if;
    rack := jsonb_build_object('letters', r.letters, 'swaps_left', r.swaps_left);
  end if;

  -- Finished words in full, plus the caller's own words still being solved.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', w.id, 'seq', w.seq, 'setter', w.setter, 'solver', w.solver,
           'word', w.word, 'value', w.value, 'guesses', w.guesses,
           'wrong_words', to_jsonb(w.wrong_words), 'misses', w.misses,
           'pattern', public.mask_word(w.word, w.guesses),
           'status', w.status, 'solver_points', w.solver_points,
           'setter_points', w.setter_points, 'finished_at', w.finished_at)
           order by w.id), '[]'::jsonb)
    into history
    from public.game_words w
   where w.game_id = gid and (w.status <> 'open' or w.setter = uid);

  return jsonb_build_object(
    'id', g.id, 'status', g.status, 'rounds', g.rounds,
    'i_started', uid = g.player1,
    'me', public.player_json(uid, case when uid = g.player1 then g.score1 else g.score2 end),
    'them', public.player_json(them, case when uid = g.player1 then g.score2 else g.score1 end),
    'action', act, 'winner', g.winner, 'resigned_by', g.resigned_by,
    'solving', solving, 'rack', rack, 'history', history,
    'updated_at', g.updated_at);
end $$;

create function public.list_games() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(s.r order by (s.r->>'my_turn')::boolean desc,
                                         (s.r->>'active')::boolean desc,
                                         s.r->>'updated_at' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', g.id,
      'active', g.status = 'active',
      'my_turn', g.turn = auth.uid(),
      'them', public.player_json(o.id, case when auth.uid() = g.player1 then g.score2 else g.score1 end),
      'my_score', case when auth.uid() = g.player1 then g.score1 else g.score2 end,
      'round', least(g.rounds, 1 + (select count(*) from public.game_words w
                                    where w.game_id = g.id and w.solver = auth.uid()
                                      and w.status <> 'open')),
      'rounds', g.rounds,
      'winner', g.winner, 'resigned_by', g.resigned_by,
      'updated_at', g.updated_at) as r
    from public.games g
    join public.profiles o
      on o.id = case when auth.uid() = g.player1 then g.player2 else g.player1 end
    where auth.uid() in (g.player1, g.player2)
      and (g.status = 'active' or g.updated_at > now() - interval '30 days')
  ) s
$$;

create function public.list_friends() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'color', p.color)
                            order by lower(p.username::text)), '[]'::jsonb)
  from public.friends f join public.profiles p on p.id = f.friend_id
  where f.user_id = auth.uid()
$$;

-- ---------------------------------------------------------------- accounts and friends

create function public.username_available(name text) returns boolean
language sql stable security definer set search_path = public as $$
  select name ~ '^[A-Za-z0-9_]{3,16}$'
     and not exists (select 1 from public.profiles where username = name::citext)
$$;

-- New sign-ups pass their username and color in the sign-up metadata.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, color)
  values (new.id,
          new.raw_user_meta_data->>'username',
          coalesce(new.raw_user_meta_data->>'color', 'sun'));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.set_color(c text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if c not in ('sun','berry','mint','sky','grape','coral','lime','cocoa') then
    raise exception 'bad color';
  end if;
  update public.profiles set color = c where id = auth.uid();
end $$;

-- Friends are mutual and instant: adding someone adds you to their list too.
create function public.add_friend(name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into p from public.profiles where username = trim(name)::citext;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if p.id = auth.uid() then return jsonb_build_object('result', 'self'); end if;
  insert into public.friends (user_id, friend_id) values (auth.uid(), p.id), (p.id, auth.uid())
  on conflict do nothing;
  return jsonb_build_object('result', 'ok', 'friend',
    jsonb_build_object('id', p.id, 'username', p.username, 'color', p.color));
end $$;

create function public.remove_friend(fid uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.friends where user_id = auth.uid() and friend_id = fid
$$;

-- ---------------------------------------------------------------- moves

create function public.start_game(opponent uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  gid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if opponent = auth.uid() or not exists (select 1 from public.profiles where id = opponent) then
    raise exception 'bad opponent';
  end if;
  if (select count(*) from public.games
      where status = 'active' and auth.uid() in (player1, player2)) >= 50 then
    raise exception 'too many games';
  end if;
  insert into public.friends (user_id, friend_id) values (auth.uid(), opponent), (opponent, auth.uid())
  on conflict do nothing;
  insert into public.games (player1, player2, turn) values (auth.uid(), opponent, auth.uid())
  returning id into gid;
  return gid;
end $$;

create function public.guess_letter(gid uuid, letter text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  g public.games := public.my_game_for_move(gid);
  w public.game_words;
  c text := lower(letter);
begin
  if c !~ '^[a-z]$' then raise exception 'bad letter'; end if;
  select * into w from public.game_words
   where game_id = gid and solver = auth.uid() and status = 'open' for update;
  if not found then raise exception 'nothing to solve'; end if;
  if strpos(w.guesses, c) > 0 then return public.get_game(gid); end if;

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
  return public.get_game(gid);
end $$;

create function public.guess_word(gid uuid, guess text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  g public.games := public.my_game_for_move(gid);
  w public.game_words;
  t text := lower(trim(guess));
begin
  if t !~ '^[a-z]{1,12}$' then raise exception 'bad guess'; end if;
  select * into w from public.game_words
   where game_id = gid and solver = auth.uid() and status = 'open' for update;
  if not found then raise exception 'nothing to solve'; end if;

  if t = w.word then
    perform public.finish_word(w, true);
  else
    w.misses := w.misses + 1;
    update public.game_words set misses = w.misses, wrong_words = wrong_words || t where id = w.id;
    if w.misses < public.max_misses() then return public.get_game(gid); end if;
    perform public.finish_word(w, false);
  end if;
  perform public.advance_game(gid);
  return public.get_game(gid);
end $$;

create function public.swap_rack(gid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  g public.games := public.my_game_for_move(gid);
begin
  if public.next_action(g, auth.uid()) <> 'set' then raise exception 'not setting'; end if;
  update public.game_racks set letters = public.deal_rack(), swaps_left = swaps_left - 1
   where game_id = gid and user_id = auth.uid() and swaps_left > 0;
  return public.get_game(gid);
end $$;

-- Returns {"result": "ok" | "not_a_word" | "not_in_rack" | "bad_length"} plus the game when ok.
create function public.submit_word(gid uuid, word text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  g public.games := public.my_game_for_move(gid);
  t text := lower(trim(word));
  r public.game_racks;
  them uuid;
  n int;
begin
  if public.next_action(g, auth.uid()) <> 'set' then raise exception 'not setting'; end if;
  if t !~ '^[a-z]{4,8}$' then return jsonb_build_object('result', 'bad_length'); end if;
  select * into r from public.game_racks where game_id = gid and user_id = auth.uid();
  if not found or not public.fits_rack(t, r.letters) then
    return jsonb_build_object('result', 'not_in_rack');
  end if;
  if not exists (select 1 from public.dictionary d where d.word = t) then
    return jsonb_build_object('result', 'not_a_word');
  end if;

  them := case when auth.uid() = g.player1 then g.player2 else g.player1 end;
  select count(*) + 1 into n from public.game_words where game_id = gid and setter = auth.uid();
  insert into public.game_words (game_id, seq, setter, solver, word, value)
  values (gid, n, auth.uid(), them, t, public.word_value(t));
  delete from public.game_racks where game_id = gid and user_id = auth.uid();
  perform public.advance_game(gid);
  return jsonb_build_object('result', 'ok', 'game', public.get_game(gid));
end $$;

create function public.resign(gid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  g public.games;
begin
  select * into g from public.games where id = gid for update;
  if not found or auth.uid() is null or auth.uid() not in (g.player1, g.player2)
     or g.status <> 'active' then
    raise exception 'cannot resign';
  end if;
  update public.games set
    status = 'finished', turn = null, resigned_by = auth.uid(),
    winner = case when auth.uid() = g.player1 then g.player2 else g.player1 end,
    updated_at = now()
  where id = gid;
  return public.get_game(gid);
end $$;

-- ---------------------------------------------------------------- function access

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function
  public.get_game(uuid), public.list_games(), public.list_friends(),
  public.set_color(text), public.add_friend(text), public.remove_friend(uuid),
  public.start_game(uuid), public.guess_letter(uuid, text), public.guess_word(uuid, text),
  public.swap_rack(uuid), public.submit_word(uuid, text), public.resign(uuid)
  to authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
