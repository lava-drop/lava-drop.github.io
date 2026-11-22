// Sends "your turn" / "game over" web pushes. Called only by the notify_game trigger (pg_net),
// which proves itself with the shared x-notify-secret header. Secrets: VAPID_PUBLIC, VAPID_PRIVATE,
// NOTIFY_SECRET, APP_URL. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const APP_URL = Deno.env.get('APP_URL') ?? 'https://lava-drop.github.io/';
webpush.setVapidDetails(APP_URL, Deno.env.get('VAPID_PUBLIC')!, Deno.env.get('VAPID_PRIVATE')!);
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (req.headers.get('x-notify-secret') !== Deno.env.get('NOTIFY_SECRET')) return json({ error: 'forbidden' }, 403);
  const { game_id, to, from, kind } = await req.json();

  const [{ data: game }, { data: who }, { data: subs }] = await Promise.all([
    db.from('games').select('id, player1, player2, score1, score2, winner, rounds').eq('id', game_id).single(),
    db.from('profiles').select('username').eq('id', from).single(),
    db.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', to),
  ]);
  if (!game || !who || !subs?.length) return json({ sent: 0 });

  const name = who.username;
  const mine = game.player1 === to ? game.score1 : game.score2;
  const theirs = game.player1 === to ? game.score2 : game.score1;
  let title: string;
  let body: string;
  if (kind === 'turn') {
    title = `Your turn vs ${name}`;
    body = `${name} made their move. Don't drop in the lava!`;
  } else if (kind === 'resigned') {
    title = `${name} gave up`;
    body = `You win ${mine}–${theirs}.`;
  } else {
    title = `Game over vs ${name}`;
    body = game.winner === to ? `You won ${mine}–${theirs}!` : game.winner ? `${name} won ${theirs}–${mine}.` : `It's a tie, ${mine}–${theirs}.`;
  }
  const payload = JSON.stringify({ title, body, tag: game.id, url: `${APP_URL}#/game/${game.id}` });

  let sent = 0;
  const errors: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // The phone dropped this subscription: forget it.
        if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        errors.push(String(code ?? (e as Error).message));
      }
    }),
  );
  return json({ sent, errors });
});
