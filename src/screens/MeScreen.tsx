import { useEffect, useState } from 'react';
import { api, type Me } from '../api';
import { go } from '../App';
import { COLOR_KEYS, COLORS, Critter } from '../art/Critter';
import { emailFor } from '../config';
import { disablePush, enablePush, pushState, type PushState } from '../push';
import { isMuted, setMuted } from '../sound';
import { supabase } from '../supabase';
import { BackBar } from './BackBar';

const NAME_RULE = /^[A-Za-z0-9_]{3,16}$/;
const PUSH_LABEL: Record<PushState, string> = {
  on: 'On',
  off: 'Off',
  blocked: 'Blocked',
  unsupported: 'Not on this browser',
  'needs-install': 'Add to Home Screen first',
};

export function MeScreen({ me, onChange }: { me: Me; onChange: () => void }) {
  const [muted, setM] = useState(isMuted());
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(me.username);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ good: boolean; text: string } | null>(null);
  const [push, setPush] = useState<PushState | null>(null);

  useEffect(() => {
    void pushState().then(setPush);
  }, []);

  async function pick(c: (typeof COLOR_KEYS)[number]) {
    await api.setColor(c);
    onChange();
  }

  /** Renames the account. A guest also sets a password here, which turns it into a real account. */
  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const n = name.trim();
    if (!NAME_RULE.test(n)) return setMsg({ good: false, text: 'Usernames are 3 to 16 letters, numbers or _ (no spaces).' });
    if (me.guest && password.length < 6) return setMsg({ good: false, text: 'Passwords need at least 6 characters.' });
    setBusy(true);
    try {
      if (n !== me.username) {
        const r = await api.changeUsername(n);
        if (r === 'taken') return setMsg({ good: false, text: 'That username is taken. Try another.' });
        if (r === 'invalid') return setMsg({ good: false, text: 'Usernames are 3 to 16 letters, numbers or _ (no spaces).' });
      }
      if (me.guest) {
        const { error } = await supabase.auth.updateUser({ email: emailFor(n), password });
        if (error) throw error;
        await supabase.auth.refreshSession();
      }
      setEditing(false);
      setPassword('');
      setMsg({ good: true, text: me.guest ? `Saved. Sign in as ${n} on any phone.` : `You’re ${n} now.` });
      onChange();
    } catch (err) {
      setMsg({ good: false, text: err instanceof Error ? err.message : 'Something went wrong. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function togglePush() {
    if (push === 'on') {
      await disablePush();
      setPush('off');
    } else if (push === 'off') {
      try {
        setPush(await enablePush());
      } catch (err) {
        setMsg({ good: false, text: err instanceof Error ? err.message : 'Couldn’t turn on notifications.' });
      }
    }
  }

  const showForm = editing || me.guest;

  return (
    <div className="screen">
      <BackBar title="Me" />
      <div className="card center-col">
        <Critter color={me.color} size={120} mood="cheer" />
        <div className="big-name">{me.username}</div>
        {me.guest && <p className="fine">You’re playing as a guest. This account only lives in this browser until you save it below.</p>}
        {!showForm && (
          <button className="btn" onClick={() => { setEditing(true); setMsg(null); }}>
            Change username
          </button>
        )}
        {showForm && (
          <form className="form name-form" onSubmit={saveName}>
            <label>
              {me.guest ? 'Pick a username' : 'New username'}
              <input value={name} onChange={(e) => setName(e.target.value)} autoCapitalize="none" autoCorrect="off" maxLength={16} />
            </label>
            {me.guest && (
              <label>
                Pick a password
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </label>
            )}
            <div className="row gap">
              {!me.guest && (
                <button type="button" className="btn grow" onClick={() => { setEditing(false); setName(me.username); setMsg(null); }}>
                  Cancel
                </button>
              )}
              <button className="btn btn-go grow" disabled={busy}>
                {busy ? '…' : me.guest ? 'Save my account' : 'Save'}
              </button>
            </div>
          </form>
        )}
        {msg && <div className={msg.good ? 'note' : 'error'}>{msg.text}</div>}
        <div className="label">Your color</div>
        <div className="swatches">
          {COLOR_KEYS.map((k) => (
            <button key={k} className={k === me.color ? 'swatch on' : 'swatch'} onClick={() => pick(k)} aria-label={COLORS[k].name}>
              <Critter color={k} size={44} />
              {COLORS[k].name}
            </button>
          ))}
        </div>
      </div>
      <div className="card list">
        <button className="list-row" onClick={togglePush} disabled={push !== 'on' && push !== 'off'}>
          Turn notifications <span className="list-right">{push ? PUSH_LABEL[push] : '…'}</span>
        </button>
        {push === 'needs-install' && (
          <p className="fine push-help">On iPhone: tap Share, then Add to Home Screen. Open Lava Drop from that icon and turn this on.</p>
        )}
        {push === 'blocked' && <p className="fine push-help">Notifications are blocked for this site in your phone’s settings.</p>}
        <button
          className="list-row"
          onClick={() => {
            setMuted(!muted);
            setM(!muted);
          }}
        >
          Sound <span className="list-right">{muted ? 'Off' : 'On'}</span>
        </button>
        <button className="list-row" onClick={() => go({ name: 'help' })}>
          How to play <span className="list-right">›</span>
        </button>
        <button className="list-row danger" onClick={() => supabase.auth.signOut()}>
          {me.guest ? 'Sign out (loses this guest)' : 'Sign out'}
        </button>
      </div>
    </div>
  );
}
