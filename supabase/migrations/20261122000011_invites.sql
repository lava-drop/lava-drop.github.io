-- Invite links: https://lava-drop.github.io/#/invite/<player id>. Opening one shows who invited you
-- (invite_info works before you sign in), and once you're in, accept_invite makes you friends both ways.

create function public.invite_info(inviter uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'username', p.username, 'color', p.color)
  from public.profiles p where p.id = $1 and p.bot is null
$$;

create function public.accept_invite(inviter uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  p public.profiles;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into p from public.profiles where id = $1 and bot is null;
  if not found then return null; end if;
  if p.id <> me then
    insert into public.friends (user_id, friend_id) values (me, p.id), (p.id, me) on conflict do nothing;
  end if;
  return jsonb_build_object('id', p.id, 'username', p.username, 'color', p.color, 'self', p.id = me);
end $$;

revoke execute on function public.invite_info(uuid), public.accept_invite(uuid) from public;
grant execute on function public.invite_info(uuid) to anon, authenticated;
grant execute on function public.accept_invite(uuid) to authenticated;
