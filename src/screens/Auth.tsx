import { useEffect, useState } from 'react';
import { api } from '../api';
import { COLOR_KEYS, COLORS, Critter } from '../art/Critter';
import { Logo } from '../art/Logo';
import { Scene } from '../art/Scene';
import { emailFor } from '../config';
import { supabase } from '../supabase';
import type { Color, Friend } from '../types';
import { NAME_RULE } from './GuestSave';

export function AuthScreen({ onDone, inviter }: { onDone: () => void; inviter?: string }) {
  const [invitedBy, setInvitedBy] = useState<Friend | null>(null);
  useEffect(() => {
    if (inviter) api.inviteInfo(inviter).then(setInvitedBy).catch(() => {});
  }, [inviter]);
  const [mode, setMode] = useState<'in' | 'new'>('in');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [color, setColor] = useState<Color>('sun');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [nick, setNick] = useState('');
  const [quickError, setQuickError] = useState('');

  // Quick play: pick a name, no password. It's a guest account until they add a password later.
  async function playAsGuest(e: React.FormEvent) {
    e.preventDefault();
    setQuickError('');
    const name = nick.trim();
    if (!NAME_RULE.test(name)) {
      setQuickError(name ? 'Names are 3 to 16 letters, numbers or _ (no spaces).' : 'Type your name first.');
      return;
    }
    setBusy(true);
    try {
      if (!(await api.usernameAvailable(name))) {
        setQuickError(`${name} is taken. Try another, or sign in below if it’s you.`);
        return;
      }
      const pick = COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)];
      const { error } = await supabase.auth.signInAnonymously({ options: { data: { username: name, color: pick } } });
      if (error) throw error;
      onDone();
    } catch (err) {
      setQuickError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const name = username.trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) {
      setError('Usernames are 3 to 16 letters, numbers or _ (no spaces).');
      return;
    }
    if (password.length < 6) {
      setError('Passwords need at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'new') {
        if (!(await api.usernameAvailable(name))) {
          setError('That username is taken. Try another.');
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: emailFor(name),
          password,
          options: { data: { username: name, color } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: emailFor(name), password });
        if (error) {
          setError('That username and password don’t match.');
          return;
        }
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen auth">
      {invitedBy && (
        <div className="card invite-banner">
          <Critter color={invitedBy.color} size={52} mood="cheer" />
          <div>
            <b>{invitedBy.username}</b> challenged you to Lava Drop!
            <div className="fine">Type your name and tap Play now, or sign in if you already play.</div>
          </div>
        </div>
      )}
      <div className="auth-hero">
        <Logo size={1.25} />
        <p className="tagline">Guess the word or drop in the lava.</p>
        <div className="auth-scene">
          <Scene color={color} misses={2} maxMisses={6} state="playing" rival={{ color: color === 'sky' ? 'berry' : 'sky' }} />
        </div>
      </div>
      <form className="card form quick-card" onSubmit={playAsGuest}>
        <label>
          What should we call you?
          <input
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            placeholder="Your name"
            autoCapitalize="words"
            autoCorrect="off"
            autoComplete="nickname"
            maxLength={16}
          />
        </label>
        {quickError && <div className="error">{quickError}</div>}
        <button className="btn btn-big btn-go quick-play" disabled={busy}>
          {busy ? '…' : 'Play now'}
        </button>
        <p className="fine">No password needed. Add one later to keep your games on any phone.</p>
      </form>
      <p className="fine center">Already play? Sign in below.</p>
      <div className="card">
        <div className="tabs">
          <button className={mode === 'in' ? 'tab on' : 'tab'} onClick={() => setMode('in')} type="button">
            Sign in
          </button>
          <button className={mode === 'new' ? 'tab on' : 'tab'} onClick={() => setMode('new')} type="button">
            New player
          </button>
        </div>
        <form onSubmit={submit} className="form">
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              maxLength={16}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'new' ? 'new-password' : 'current-password'}
            />
          </label>
          {mode === 'new' && (
            <>
              <div className="label">Pick your color</div>
              <div className="swatches">
                {COLOR_KEYS.map((k) => (
                  <button
                    type="button"
                    key={k}
                    className={k === color ? 'swatch on' : 'swatch'}
                    onClick={() => setColor(k)}
                    aria-label={COLORS[k].name}
                  >
                    <Critter color={k} size={44} mood={k === color ? 'cheer' : 'happy'} />
                    {COLORS[k].name}
                  </button>
                ))}
              </div>
              <p className="fine">
                Write your password down. There’s no email on your account, so it can’t be reset by email.
              </p>
            </>
          )}
          {error && <div className="error">{error}</div>}
          <button className="btn btn-big" disabled={busy}>
            {busy ? '…' : mode === 'new' ? 'Create account' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
