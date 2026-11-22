-- save_push's parameter names clashed with the table's columns ("endpoint is ambiguous").
-- Same signature (the app calls it by these names), body rewritten to use positional parameters.
create or replace function public.save_push(endpoint text, p256dh text, auth text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not signed in'; end if;
  insert into public.push_subscriptions as s (endpoint, user_id, p256dh, auth)
  values ($1, me, $2, $3)
  on conflict on constraint push_subscriptions_pkey do update
    set user_id = me, p256dh = $2, auth = $3, created_at = now();
end $$;
