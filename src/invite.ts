import type { Me } from './api';

/** The link that makes whoever opens it your friend. Production address, so it works from any device. */
export function inviteLink(me: Me) {
  const base = import.meta.env.DEV ? `${location.origin}${import.meta.env.BASE_URL}` : 'https://lava-drop.github.io/';
  return `${base}#/invite/${me.id}`;
}

/** Opens the phone's share menu (Messages etc.); falls back to copying the link. */
export async function shareInvite(me: Me): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const url = inviteLink(me);
  const text = `${me.username} challenged you to Lava Drop! Guess the word or drop in the lava.`;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Lava Drop', text, url });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export const SHARE_MSG: Record<'copied' | 'failed', string> = {
  copied: 'Invite link copied. Paste it in a text.',
  failed: 'Couldn’t open sharing on this browser.',
};
