import { useCallback, useEffect, useState } from 'react';
import { api, type Me } from '../api';
import { go } from '../App';
import { Critter } from '../art/Critter';
import { shareInvite, SHARE_MSG } from '../invite';
import type { Friend } from '../types';
import { BackBar } from './BackBar';

/** Your friends (tap Play to start a game), invites, adding by username, and the computer. */
export function FriendsScreen({ me }: { me: Me }) {
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const [bots, setBots] = useState<Friend[] | null>(null);

  const load = useCallback(() => {
    api.listFriends().then(setFriends).catch((e) => setMsg(e.message));
    api.listBots().then(setBots).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await api.addFriend(name.trim());
      if (r.result === 'not_found') setMsg(`No player named “${name.trim()}”. Check the spelling.`);
      else if (r.result === 'self') setMsg('That’s you!');
      else if (r.result === 'bot') setMsg('That’s a bot. It’s already under Play the computer.');
      else {
        setName('');
        setMsg(`${r.friend!.username} added.`);
        load();
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function play(f: Friend) {
    setBusy(true);
    try {
      const id = await api.startGame(f.id);
      go({ name: 'game', id });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Could not start a game.');
      setBusy(false);
    }
  }

  async function share() {
    const r = await shareInvite(me);
    if (r === 'copied' || r === 'failed') setMsg(SHARE_MSG[r]);
  }

  async function remove(f: Friend) {
    await api.removeFriend(f.id);
    load();
  }

  return (
    <div className="screen">
      <BackBar title="Friends" />
      <div className="card invite-cta">
        <b>Invite family</b>
        <p className="fine">Text them a link. When they open it, you’re friends and ready to play.</p>
        <button className="btn btn-go" onClick={share}>Send an invite</button>
      </div>
      <section className="section">
        <div className="section-head">
          <h2>Your friends</h2>
          {friends && friends.length > 0 && (
            <button className="link" onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit'}</button>
          )}
        </div>
        {friends === null && <div className="loading">Loading…</div>}
        {friends?.length === 0 && <p className="hint">No friends yet. Send an invite, or add them by username below.</p>}
        {friends?.map((f) => (
          <div key={f.id} className="friend-row">
            <Critter color={f.color} size={48} />
            <div className="gc-name grow">{f.username}</div>
            {editing ? (
              <button className="btn btn-ghost" onClick={() => remove(f)}>Remove</button>
            ) : (
              <button className="btn btn-go" disabled={busy} onClick={() => play(f)}>Play</button>
            )}
          </div>
        ))}
      </section>
      <form className="card add-friend" onSubmit={add}>
        <label>
          Add a player by username
          <div className="row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="their username"
              maxLength={16}
            />
            <button className="btn" disabled={busy || !name.trim()}>Add</button>
          </div>
        </label>
        <p className="fine">Your username is <b>{me.username}</b>. Tell your family so they can add you.</p>
        {msg && <div className="note">{msg}</div>}
      </form>
      <section className="section">
        <h2>Play the computer</h2>
        {bots?.map((b) => (
          <div key={b.id} className="friend-row">
            <Critter color={b.color} size={48} />
            <div className="grow">
              <div className="gc-name">
                {b.username}
                <span className="bot-tag">BOT</span>
              </div>
              <div className="bot-desc">The computer. Always ready for a game.</div>
            </div>
            <button className="btn btn-go" disabled={busy} onClick={() => play(b)}>Play</button>
          </div>
        ))}
      </section>
    </div>
  );
}
