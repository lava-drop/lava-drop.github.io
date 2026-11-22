// Live checks for migration 8: username change, guest -> real account, and the push pipeline
// (trigger -> pg_net -> notify function -> web push, delivered to a fake subscription on httpbin).
// Clean up after with tools/cleanup-test-users.sql. Run: node --experimental-strip-types tools/test-push-names.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { createECDH, randomBytes } from 'node:crypto';
import { SUPABASE_URL, SUPABASE_KEY, emailFor } from '../src/config.ts';

const client = () => createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const rnd = () => Math.random().toString(36).slice(2, 7);
let fails = 0;
const check = (ok, what) => { console.log(ok ? 'PASS' : 'FAIL', what); if (!ok) fails++; };

// 1. Real account renames and signs in with the new name.
const a = client();
const nameA = `test_a${rnd()}`;
await a.auth.signUp({ email: emailFor(nameA), password: 'testpass1', options: { data: { username: nameA, color: 'sun' } } });
const renamed = `test_r${rnd()}`;
check((await a.rpc('change_username', { new_name: renamed })).data === 'ok', 'rename returns ok');
check((await a.rpc('change_username', { new_name: 'x y' })).data === 'invalid', 'bad name refused');
const a2 = client();
check(!(await a2.auth.signInWithPassword({ email: emailFor(renamed), password: 'testpass1' })).error, 'sign in with the new name');
check(!!(await a2.auth.signInWithPassword({ email: emailFor(nameA), password: 'testpass1' })).error, 'old name no longer signs in');

// 2. Guest keeps the account by picking a username + password.
const g = client();
const gName = `test_g${rnd()}`;
const gs = await g.auth.signInAnonymously({ options: { data: { username: gName, color: 'mint' } } });
check(gs.data.user?.is_anonymous === true, 'guest is anonymous');
const kept = `test_k${rnd()}`;
check((await g.rpc('change_username', { new_name: kept })).data === 'ok', 'guest rename ok');
const up = await g.auth.updateUser({ email: emailFor(kept), password: 'testpass1' });
check(!up.error, `guest upgrade (${up.error?.message ?? 'ok'})`);
const g2 = client();
const gIn = await g2.auth.signInWithPassword({ email: emailFor(kept), password: 'testpass1' });
check(!gIn.error && gIn.data.user?.is_anonymous === false, 'kept guest signs in with password, no longer anonymous');

// 3. Push: B registers a fake subscription; A sends B a word, which passes the turn to B.
const b = client();
const nameB = `test_b${rnd()}`;
await b.auth.signUp({ email: emailFor(nameB), password: 'testpass1', options: { data: { username: nameB, color: 'sky' } } });
const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
const sub = { endpoint: `https://httpbin.org/anything/lavadrop-${rnd()}`, p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') };
check(!(await b.rpc('save_push', sub)).error, 'B saved a push subscription');
const bId = (await b.auth.getUser()).data.user.id;
const gid = (await a2.rpc('start_game', { opponent: bId })).data;
const game = (await a2.rpc('get_game', { gid })).data;
const words = readFileSync(new URL('../public/words.txt', import.meta.url), 'utf8').split('\n');
const fits = (w, r) => { for (const ch of w) { const i = r.indexOf(ch); if (i < 0) return false; r = r.slice(0, i) + r.slice(i + 1); } return true; };
const w = words.find((x) => x.length >= 5 && fits(x, game.rack.letters));
const sent = await a2.rpc('submit_word', { gid, word: w });
check(sent.data?.result === 'ok', `A sent ${w}`);
console.log('GAME', gid, 'ENDPOINT', sub.endpoint);
process.exit(fails ? 1 : 0);
