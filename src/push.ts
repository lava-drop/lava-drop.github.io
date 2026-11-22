import { VAPID_PUBLIC } from './config';
import { supabase } from './supabase';

// Turn notifications (web push). On iPhone they only work once the site is added to the Home
// Screen and opened from there; every browser needs https.

export type PushState = 'on' | 'off' | 'blocked' | 'unsupported' | 'needs-install';

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

function keyBytes(b64: string) {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function registration() {
  return navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}

export async function pushState(): Promise<PushState> {
  const supported = window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!supported) return isIos() && !isInstalled() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission !== 'granted') return 'off';
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

async function save(sub: PushSubscription) {
  const j = sub.toJSON();
  const { error } = await supabase.rpc('save_push', { endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth });
  if (error) throw new Error(error.message);
}

/** Asks permission (must run from a tap), subscribes this device and saves it to the signed-in player. */
export async function enablePush(): Promise<PushState> {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'blocked' : 'off';
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) }));
  await save(sub);
  return 'on';
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.rpc('delete_push', { endpoint: sub.endpoint });
  await sub.unsubscribe();
}

/** After sign-in: if this device already has a subscription, make sure it points at whoever is signed in now. */
export async function resavePush(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator) || !('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await save(sub);
  } catch {
    // Best effort; the Me screen shows the real state.
  }
}
