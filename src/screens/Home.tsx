import { useCallback, useEffect, useState } from 'react';
import { api, type Me } from '../api';
import { go } from '../App';
import { Critter } from '../art/Critter';
import { Logo } from '../art/Logo';
import { shareInvite, SHARE_MSG } from '../invite';
import { enablePush, pushState, type PushState } from '../push';
import { supabase } from '../supabase';
import type { GameSummary } from '../types';
import { GuestSave, isAutoGuestName } from './GuestSave';

/** Re-runs `load` whenever one of my games changes on the server. */
export function useGamesFeed(load: () => void, filter?: string) {
  useEffect(() => {
    const ch = supabase
      .channel(`games-${filter ?? 'all'}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', ...(filter ? { filter } : {}) }, () => load())
      .subscribe();
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      void supabase.removeChannel(ch);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load, filter]);
}

export function HomeScreen({ me, onChange }: { me: Me; onChange: () => void }) {
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.listGames().then(setGames).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  useGamesFeed(load);
  const [push, setPush] = useState<PushState | null>(null);
  useEffect(() => {
    void pushState().then(setPush);
  }, []);

  const [shareMsg, setShareMsg] = useState('');
  async function invite() {
    const r = await shareInvite(me);
    if (r === 'copied' || r === 'failed') setShareMsg(SHARE_MSG[r]);
  }

  // Guests get asked to save their account: right away if they still have an automatic Guest####
  // name, otherwise once they've finished a game. "Not now" hides it until the app is reopened.
  const [nudgeOff, setNudgeOff] = useState(() => {
    try {
      return sessionStorage.getItem('lavadrop-save-nudge') === 'off';
    } catch {
      return false;
    }
  });
  const hideNudge = () => {
    setNudgeOff(true);
    try {
      sessionStorage.setItem('lavadrop-save-nudge', 'off');
    } catch {
      /* private mode: it just shows again next time */
    }
  };
  const autoName = isAutoGuestName(me.username);
  const showNudge = me.guest && !nudgeOff && games !== null && (autoName || games.some((g) => !g.active));

  const mine = games?.filter((g) => g.active && g.my_turn) ?? [];
  const theirs = games?.filter((g) => g.active && !g.my_turn) ?? [];
  const done = games?.filter((g) => !g.active) ?? [];

  return (
    <div className="screen home">
      <header className="topbar">
        <Logo size={0.9} />
        <button className="me-btn" onClick={() => go({ name: 'me' })} aria-label="My profile">
          <Critter color={me.color} size={40} />
        </button>
      </header>

      <button className="btn btn-big btn-go new-game" onClick={() => go({ name: 'friends' })}>
        + New game
      </button>
      <div className="row gap home-actions">
        <button className="btn grow" onClick={() => go({ name: 'friends' })}>Friends</button>
        <button className="btn grow" onClick={invite}>Invite</button>
        <button className="btn grow" onClick={() => go({ name: 'leaders' })}>Rankings</button>
      </div>
      {shareMsg && <div className="note">{shareMsg}</div>}

      {(push === 'off' || push === 'needs-install') && (
        <div className="card push-card">
          <b>Know when it’s your turn</b>
          {push === 'off' ? (
            <>
              <p className="fine">Get a notification when someone makes their move.</p>
              <button className="btn btn-go" onClick={() => enablePush().then(setPush).catch(() => setPush('off'))}>
                Turn on notifications
              </button>
            </>
          ) : (
            <p className="fine">On iPhone: tap Share, then Add to Home Screen. Open Lava Drop from that icon to turn on notifications.</p>
          )}
        </div>
      )}
      {me.guest && (
        <button className="card guest-card" onClick={() => go({ name: 'me' })}>
          {autoName ? <>You’re showing up as <b>{me.username}</b>. Tap to pick your name.</> : <>Add a password to keep your games, <b>{me.username}</b>.</>}
        </button>
      )}

      {showNudge && (
        <div className="modal-bg">
          <div className="modal save-nudge">
            <h3>{autoName ? 'Pick your name' : 'Keep your games'}</h3>
            <p className="fine">
              {autoName
                ? `You’re showing up as ${me.username}. Pick your real name and a password so family knows it’s you and your games are safe.`
                : 'Add a password so your games and record aren’t lost if this browser gets cleared, and so you can play from any phone.'}
            </p>
            <GuestSave me={me} onSaved={() => { hideNudge(); onChange(); }} />
            <button className="link center" onClick={hideNudge}>Not now</button>
          </div>
        </div>
      )}
      {error && <div className="error">{error}</div>}
      {games === null && !error && <div className="loading">Loading games…</div>}
      {games?.length === 0 && (
        <div className="empty card">
          <Critter color={me.color} size={90} mood="sleepy" />
          <p>No games yet. Take on the family, or warm up against the computer.</p>
          <button className="link" onClick={() => go({ name: 'help' })}>How to play</button>
        </div>
      )}

      <Section title="Your turn" games={mine} me={me} />
      <Section title="Their turn" games={theirs} me={me} />
      <Section title="Finished" games={done} me={me} />

      {games && games.length > 0 && (
        <button className="link center" onClick={() => go({ name: 'help' })}>How to play</button>
      )}
    </div>
  );
}

function Section({ title, games, me }: { title: string; games: GameSummary[]; me: Me }) {
  if (!games.length) return null;
  return (
    <section className="section">
      <h2>{title}</h2>
      {games.map((g) => (
        <GameCard key={g.id} g={g} me={me} />
      ))}
    </section>
  );
}

function GameCard({ g, me }: { g: GameSummary; me: Me }) {
  let status: string;
  let cls = '';
  if (g.active) {
    status = g.my_turn ? 'Your move!' : `Waiting on ${g.them.username}`;
    cls = g.my_turn ? 'hot' : '';
  } else if (g.resigned_by) {
    status = g.resigned_by === me.id ? 'You resigned' : `${g.them.username} resigned`;
  } else if (!g.winner) {
    status = 'Tie game';
  } else {
    status = g.winner === me.id ? 'You won!' : `${g.them.username} won`;
    cls = g.winner === me.id ? 'won' : 'lost';
  }
  return (
    <button className={`game-card ${cls}`} onClick={() => go({ name: 'game', id: g.id })}>
      <Critter color={g.them.color} size={52} mood={g.active ? 'happy' : g.winner === g.them.id ? 'cheer' : 'happy'} />
      <div className="gc-main">
        <div className="gc-name">
          {g.them.username}
          {g.them.bot && <span className="bot-tag">BOT</span>}
        </div>
        <div className="gc-status">
          {status}
          {g.active && <span className="gc-round"> · Round {g.round} of {g.rounds}</span>}
        </div>
      </div>
      <div className="gc-score">
        <span className="mine">{g.my_score}</span>
        <span className="dash">–</span>
        <span>{g.them.score}</span>
      </div>
    </button>
  );
}
