import { useState } from 'react';
import { api, type Me } from '../api';
import { emailFor } from '../config';
import { supabase } from '../supabase';

export const NAME_RULE = /^[A-Za-z0-9_]{3,16}$/;
/** Guests from before names were asked for got an automatic Guest#### name. */
export const isAutoGuestName = (name: string) => /^Guest\d{4}$/.test(name);

/**
 * Turns a guest into a real account: pick (or keep) a name and set a password, so the games
 * follow you to any phone. Used on the Me screen and in the home-screen reminder.
 */
export function GuestSave({ me, onSaved }: { me: Me; onSaved: (name: string) => void }) {
  const [name, setName] = useState(isAutoGuestName(me.username) ? '' : me.username);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const n = name.trim();
    if (!NAME_RULE.test(n)) return setError('Names are 3 to 16 letters, numbers or _ (no spaces).');
    if (password.length < 6) return setError('Passwords need at least 6 characters.');
    setBusy(true);
    try {
      if (n !== me.username) {
        const r = await api.changeUsername(n);
        if (r === 'taken') return setError('That name is taken. Try another.');
        if (r === 'invalid') return setError('Names are 3 to 16 letters, numbers or _ (no spaces).');
      }
      const { error: err } = await supabase.auth.updateUser({ email: emailFor(n), password });
      if (err) throw err;
      await supabase.auth.refreshSession();
      onSaved(n);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form name-form" onSubmit={save}>
      <label>
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} autoCapitalize="none" autoCorrect="off" maxLength={16} placeholder="e.g. Meg" />
      </label>
      <label>
        Pick a password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      </label>
      {error && <div className="error">{error}</div>}
      <button className="btn btn-big btn-go" disabled={busy}>
        {busy ? '…' : 'Save my account'}
      </button>
    </form>
  );
}
