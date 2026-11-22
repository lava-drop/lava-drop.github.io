import { useEffect, useState } from 'react';
import { api, type Me } from '../api';
import { go } from '../App';
import { Critter } from '../art/Critter';
import { shareInvite, SHARE_MSG } from '../invite';
import type { Friend } from '../types';

/** Where an invite link lands once you're signed in: you're now friends, so play them. */
export function InviteScreen({ me, inviter }: { me: Me; inviter: string }) {
  const [them, setThem] = useState<(Friend & { self: boolean }) | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.acceptInvite(inviter).then(setThem).catch(() => setThem(null));
  }, [inviter]);

  async function play() {
    if (!them) return;
    setBusy(true);
    try {
      go({ name: 'game', id: await api.startGame(them.id) });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Could not start a game.');
      setBusy(false);
    }
  }

  async function share() {
    const r = await shareInvite(me);
    if (r === 'copied' || r === 'failed') setMsg(SHARE_MSG[r]);
  }

  if (them === undefined) return <div className="screen"><div className="loading">Loading…</div></div>;

  return (
    <div className="screen">
      <div className="card center-col invite-card">
        {them === null ? (
          <>
            <p className="big-line">That invite link doesn’t work anymore.</p>
            <button className="btn btn-big btn-go" onClick={() => go({ name: 'home' })}>Go to my games</button>
          </>
        ) : them.self ? (
          <>
            <Critter color={me.color} size={110} mood="cheer" />
            <p className="big-line">This is your own invite link.</p>
            <p className="fine">Send it to family. When they open it, you’re friends and ready to play.</p>
            <button className="btn btn-big btn-go" onClick={share}>Send my invite</button>
            <button className="link" onClick={() => go({ name: 'home' })}>Back to my games</button>
          </>
        ) : (
          <>
            <div className="invite-pair">
              <Critter color={me.color} size={96} mood="happy" />
              <span className="vs">VS</span>
              <Critter color={them.color} size={96} mood="cheer" />
            </div>
            <p className="big-line">You and <b>{them.username}</b> are friends now.</p>
            <button className="btn btn-big btn-go" disabled={busy} onClick={play}>
              {busy ? '…' : `Play ${them.username}`}
            </button>
            <button className="link" onClick={() => go({ name: 'home' })}>Not now</button>
          </>
        )}
        {msg && <div className="note">{msg}</div>}
      </div>
    </div>
  );
}
