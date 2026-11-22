-- 1. Turn notifications (web push). Phones save their push subscription with save_push(). When a
--    game's turn passes from one person to another, or a game between two people ends, a trigger
--    calls the `notify` Edge Function through pg_net, and it sends the push. Bots never cause or
--    get one. The function URL and its shared secret live in private.settings, set outside git.
-- 2. Username changes: change_username() renames you and, for real accounts, the made-up sign-in
--    email that goes with the username.

create extension if not exists pg_net;

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
-- No policies: only the functions below and the Edge Function (service role) touch it.

create function public.save_push(endpoint text, p256dh text, auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (save_push.endpoint, auth.uid(), save_push.p256dh, save_push.auth)
  on conflict (endpoint) do update
    set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end $$;

create function public.delete_push(endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where push_subscriptions.endpoint = delete_push.endpoint and user_id = auth.uid()
$$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.settings (key text primary key, value text not null);

create function private.notify_game() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor uuid;
  target uuid;
  kind text;
begin
  if new.status = 'active' and new.turn is distinct from old.turn and old.turn is not null and new.turn is not null then
    actor := old.turn; target := new.turn; kind := 'turn';
  elsif new.status = 'finished' and old.status <> 'finished' then
    actor := coalesce(new.resigned_by, old.turn);
    target := case when actor = new.player1 then new.player2 else new.player1 end;
    kind := case when new.resigned_by is not null then 'resigned' else 'done' end;
  else
    return new;
  end if;
  if exists (select 1 from public.profiles where id in (actor, target) and bot is not null) then
    return new;
  end if;
  if not exists (select 1 from public.push_subscriptions where user_id = target) then
    return new;
  end if;
  -- A push failure must never break a move.
  begin
    perform net.http_post(
      url := (select value from private.settings where key = 'notify_url'),
      body := jsonb_build_object('game_id', new.id, 'to', target, 'from', actor, 'kind', kind),
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-notify-secret', (select value from private.settings where key = 'notify_secret')));
  exception when others then
    null;
  end;
  return new;
end $$;

create trigger notify_game after update on public.games
  for each row execute function private.notify_game();

create function public.change_username(new_name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  n text := trim(new_name);
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if n !~ '^[A-Za-z0-9_]{3,16}$' then return 'invalid'; end if;
  if exists (select 1 from public.profiles where username = n::citext and id <> auth.uid()) then return 'taken'; end if;
  update public.profiles set username = n where id = auth.uid();
  -- Real accounts sign in with <username>@players.popquiz.invalid, so that moves too. Guests have no email.
  update auth.users
     set email = lower(n) || '@players.popquiz.invalid',
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('username', n)
   where id = auth.uid() and email is not null;
  update auth.identities
     set identity_data = identity_data || jsonb_build_object('email', lower(n) || '@players.popquiz.invalid')
   where user_id = auth.uid() and provider = 'email';
  return 'ok';
end $$;

revoke execute on function public.save_push(text, text, text), public.delete_push(text), public.change_username(text)
  from public, anon;
grant execute on function public.save_push(text, text, text), public.delete_push(text), public.change_username(text)
  to authenticated;
