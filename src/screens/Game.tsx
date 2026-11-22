import { recordLine } from '../records';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type Me } from '../api';
import { go } from '../App';
import { Critter } from '../art/Critter';
import { Scene } from '../art/Scene';
import { sfx } from '../sound';
import type { Game, WordResult } from '../types';
import { fitsRack, ideas, isWord, LETTER_VALUES, loadWords, wordValue } from '../words';
import { BackBar } from './BackBar';
import { useGamesFeed } from './Home';

const seenKey = (gid: string) => `popquiz-seen-${gid}`;
/** Id of the newest finished word I've seen in this game, or null if I've never opened it here. */
function lastSeen(gid: string): number | null {
  try {
    const v = localStorage.getItem(seenKey(gid));
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}
function markSeen(gid: string, id: number) {
  try {
    localStorage.setItem(seenKey(gid), String(id));
  } catch {
    /* private mode */
  }
}

export function GameScreen({ me, gid }: { me: Me; gid: string }) {
  const [game, setGame] = useState<Game | null | undefined>(undefined);
  const [error, setError] = useState('');
  // The word I just finished solving, shown as a result card before moving on.
  const [justSolved, setJustSolved] = useState<WordResult | null>(null);
  // News since I last looked: how they did on a word I made.
  const [recap, setRecap] = useState<WordResult | null>(null);
  const [menu, setMenu] = useState(false);

  const load = useCallback(() => {
    api.getGame(gid).then((g) => {
      setGame(g);
      if (!g) return;
      const seen = lastSeen(gid);
      const newest = Math.max(0, ...g.history.filter((h) => h.status !== 'open').map((h) => h.id));
      if (seen !== null) {
        const news = g.history.filter((h) => h.setter === me.id && h.status !== 'open' && h.id > seen).at(-1);
        if (news) setRecap(news);
      }
      if (seen === null || newest > seen) markSeen(gid, newest);
    }).catch((e) => setError(e.message));
  }, [gid, me.id]);
  useEffect(load, [load]);
  useGamesFeed(load, `id=eq.${gid}`);

  if (game === undefined) return <div className="screen"><BackBar title="" /><div className="loading">Loading…</div></div>;
  if (game === null) return <div className="screen"><BackBar title="" /><div className="error">Game not found.</div></div>;

  const onMove = (g: Game, finished?: WordResult) => {
    setGame(g);
    const seen = lastSeen(gid) ?? 0;
    // Against a bot, the reply comes back in the same move: show how it did on my word.
    const news = g.history.filter((h) => h.setter === me.id && h.status !== 'open' && h.id > seen).at(-1);
    if (news) setRecap(news);
    if (finished) setJustSolved(finished);
    const newest = Math.max(seen, ...g.history.filter((h) => h.status !== 'open').map((h) => h.id));
    markSeen(gid, newest);
  };

  return (
    <div className="screen game">
      <BackBar
        title={`vs ${game.them.username}`}
        right={game.status === 'active' && (
          <button className="link" onClick={() => setMenu(true)} aria-label="Game menu">•••</button>
        )}
      />
      <Scoreboard game={game} />
      {error && <div className="error">{error}</div>}

      {justSolved ? (
        <SolveResult w={justSolved} game={game} onNext={() => setJustSolved(null)} />
      ) : game.action === 'solve' && game.solving ? (
        <SolvePanel game={game} onMove={onMove} onError={setError} />
      ) : game.action === 'set' && game.rack ? (
        <SetPanel game={game} onMove={onMove} onError={setError} />
      ) : game.action === 'wait' ? (
        <WaitPanel game={game} me={me} />
      ) : (
        <DonePanel game={game} me={me} />
      )}

      <History game={game} me={me} />

      {recap && <RecapModal w={recap} game={game} onClose={() => setRecap(null)} />}
      {menu && (
        <div className="modal-bg" onClick={() => setMenu(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Give up this game?</h3>
            <p>{game.them.username} will win.</p>
            <div className="row gap">
              <button className="btn btn-ghost grow" onClick={() => setMenu(false)}>Keep playing</button>
              <button
                className="btn btn-danger grow"
                onClick={async () => {
                  setMenu(false);
                  setGame(await api.resign(gid));
                }}
              >
                Resign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Scoreboard({ game }: { game: Game }) {
  // A round is over once both players have played it, so count every finished word, not just mine.
  const done = game.history.filter((h) => h.status !== 'open').length;
  const round = Math.min(game.rounds, Math.floor(done / 2) + 1);
  return (
    <div className="scoreboard">
      <div className="sb-player">
        <Critter color={game.me.color} size={40} />
        <div>
          <div className="sb-name">You</div>
          <div className="sb-score">{game.me.score}</div>
        </div>
      </div>
      <div className="sb-round">
        {game.status === 'active' ? <>Round<br /><b>{round}/{game.rounds}</b></> : <b>Final</b>}
      </div>
      <div className="sb-player right">
        <div>
          <div className="sb-name">{game.them.username}</div>
          <div className="sb-score">{game.them.score}</div>
        </div>
        <Critter color={game.them.color} size={40} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- solving

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

function SolvePanel({ game, onMove, onError }: { game: Game; onMove: (g: Game, finished?: WordResult) => void; onError: (e: string) => void }) {
  const s = game.solving!;
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [guess, setGuess] = useState('');
  const [shake, setShake] = useState(false);

  const handle = useCallback(async (p: Promise<Game>) => {
    setBusy(true);
    onError('');
    try {
      const g = await p;
      const finished = g.history.find((h) => h.id === s.word_id && h.status !== 'open');
      if (finished) {
        if (finished.status === 'solved') sfx.win();
        else { sfx.pop(); setTimeout(() => sfx.ouch(), 350); }
        onMove(g, finished);
      } else if (g.solving) {
        if (g.solving.misses > s.misses) {
          sfx.pop();
          setShake(true);
          setTimeout(() => setShake(false), 400);
        } else sfx.ding();
        onMove(g);
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }, [s.word_id, s.misses, onMove, onError]);

  const tapLetter = useCallback((ch: string) => {
    if (busy || s.guesses.includes(ch)) return;
    void handle(api.guessLetter(game.id, ch));
  }, [busy, s.guesses, handle, game.id]);

  useEffect(() => {
    if (typing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[a-z]$/i.test(e.key)) tapLetter(e.key.toLowerCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tapLetter, typing]);

  return (
    <div className="panel">
      <Scene color={game.me.color} misses={s.misses} maxMisses={s.max_misses} state="playing" rival={{ color: game.them.color }} />
      <p className="prompt">Solve {game.them.username}’s word</p>
      <div className={`word-tiles ${shake ? 'shake' : ''}`}>
        {[...s.pattern].map((ch, i) => (
          <div key={i} className={ch === '_' ? 'wt blank' : 'wt shown'}>{ch === '_' ? '' : ch}</div>
        ))}
      </div>
      {s.wrong_words.length > 0 && (
        <p className="fine center">Not it: {s.wrong_words.map((w) => w.toUpperCase()).join(', ')}</p>
      )}
      <div className="keyboard">
        {ROWS.map((row) => (
          <div className="kb-row" key={row}>
            {[...row].map((ch) => {
              const guessed = s.guesses.includes(ch);
              const hit = guessed && s.pattern.includes(ch);
              return (
                <button
                  key={ch}
                  className={`key ${guessed ? (hit ? 'hit' : 'miss') : ''}`}
                  disabled={busy || guessed}
                  onClick={() => { sfx.tap(); tapLetter(ch); }}
                >
                  {ch}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <button className="btn btn-big btn-solve" disabled={busy} onClick={() => setTyping(true)}>
        Solve it!
      </button>

      {typing && (
        <div className="modal-bg" onClick={() => setTyping(false)}>
          <form
            className="modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              const t = guess.trim().toLowerCase();
              if (!/^[a-z]+$/.test(t)) return;
              setTyping(false);
              setGuess('');
              void handle(api.guessWord(game.id, t));
            }}
          >
            <h3>What’s the word?</h3>
            <p className="fine">{s.length} letters. A wrong guess pops a balloon.</p>
            <input
              autoFocus
              value={guess}
              maxLength={s.length}
              onChange={(e) => setGuess(e.target.value.replace(/[^a-z]/gi, ''))}
              autoCapitalize="none"
              autoCorrect="off"
              className="guess-input"
            />
            <div className="row gap">
              <button type="button" className="btn btn-ghost grow" onClick={() => setTyping(false)}>Cancel</button>
              <button className="btn btn-go grow" disabled={guess.length !== s.length}>Guess</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function SolveResult({ w, game, onNext }: { w: WordResult; game: Game; onNext: () => void }) {
  const solved = w.status === 'solved';
  return (
    <div className="panel">
      <Scene color={game.me.color} misses={solved ? w.misses : 6} maxMisses={6} state={solved ? 'solved' : 'failed'} rival={{ color: game.them.color }} />
      <div className={`result-card ${solved ? 'good' : 'bad'}`}>
        <div className="result-title">{solved ? 'You got it!' : 'Stumped!'}</div>
        <WordReveal word={w.word} guesses={w.guesses} />
        <div className="result-pts">
          {solved
            ? <>+{w.solver_points} for you <span className="fine">({w.value} for the word + {w.solver_points - w.value} balloon bonus)</span></>
            : <>+{w.setter_points} for {game.them.username}</>}
        </div>
      </div>
      <button className="btn btn-big btn-go" onClick={onNext}>
        {game.action === 'set' ? 'Now make a word for them →' : 'Continue'}
      </button>
    </div>
  );
}

function WordReveal({ word, guesses }: { word: string; guesses?: string }) {
  return (
    <div className="word-tiles small">
      {[...word].map((ch, i) => (
        <div key={i} className={`wt shown ${guesses !== undefined && !guesses.includes(ch) ? 'missed' : ''}`}>{ch}</div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- making a word

const EMPTY_SLOTS: (number | null)[] = Array(8).fill(null);
interface Drag {
  from: 'rack' | 'slot';
  tile: number;
  slot: number;
  sx: number;
  sy: number;
  x: number;
  y: number;
  moved: boolean;
  over: number | null;
}

function SetPanel({ game, onMove, onError }: { game: Game; onMove: (g: Game) => void; onError: (e: string) => void }) {
  const rack = game.rack!;
  const [order, setOrder] = useState<number[]>(() => [...rack.letters].map((_, i) => i));
  // The 8 word slots, left to right: a rack tile index, or null for a blank. Removing a letter leaves
  // its blank in place, and `cursor` points at it so the next tile you tap fills that spot.
  const [slots, setSlots] = useState<(number | null)[]>(EMPTY_SLOTS);
  const [cursor, setCursor] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [busy, setBusy] = useState(false);
  const [suggest, setSuggest] = useState<string[] | null>(null);
  const [, setWordsReady] = useState(0);
  const [bad, setBad] = useState('');

  useEffect(() => {
    setOrder([...rack.letters].map((_, i) => i));
    setSlots(EMPTY_SLOTS);
    setCursor(null);
    setSuggest(null);
  }, [rack.letters]);
  useEffect(() => {
    void loadWords().then(() => setWordsReady(1));
  }, []);

  const last = slots.reduce<number>((acc, x, k) => (x === null ? acc : k), -1);
  const gap = slots.slice(0, last + 1).includes(null);
  const word = gap ? '' : slots.slice(0, last + 1).map((i) => rack.letters[i!]).join('');
  const valid = word.length >= 4 && word.length <= 8 && isWord(word);
  const used = (i: number) => slots.includes(i);

  /** Puts rack tile i in slot k. Whatever was in k goes back to the rack; if i was in another slot, that one empties. */
  const place = (i: number, k: number) => {
    sfx.tap();
    setBad('');
    setSlots((cur) => cur.map((x, j) => (j === k ? i : x === i ? null : x)));
    setCursor(null);
  };
  const pick = (i: number) => {
    if (used(i)) return;
    const k = cursor ?? slots.indexOf(null);
    if (k < 0) return;
    place(i, k);
  };
  /** Tapping a letter in the word takes it out and leaves the blank, ready for a replacement. */
  const tapSlot = (k: number) => {
    if (slots[k] !== null) {
      sfx.tap();
      setSlots((cur) => cur.map((x, j) => (j === k ? null : x)));
    }
    setBad('');
    setCursor(k);
  };
  const removeLast = () => {
    if (last < 0) return;
    setSlots((cur) => cur.map((x, j) => (j === last ? null : x)));
    setCursor(null);
  };
  const clear = () => {
    setSlots(EMPTY_SLOTS);
    setCursor(null);
  };

  // Drag a tile from the rack onto any slot (replacing what's there), or drag a letter in the word
  // to another slot (they swap) or off the word (it comes out). A press that doesn't move is a tap.
  const startDrag = (e: React.PointerEvent, from: 'rack' | 'slot', tile: number, slot = -1) => {
    if (e.button !== 0) return;
    setDrag({ from, tile, slot, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, moved: false, over: null });
  };
  useEffect(() => {
    if (!drag) return;
    const slotAt = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-slot]');
      return el ? Number(el.dataset.slot) : null;
    };
    const move = (e: PointerEvent) => {
      const moved = drag.moved || Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8;
      setDrag({ ...drag, x: e.clientX, y: e.clientY, moved, over: moved ? slotAt(e.clientX, e.clientY) : null });
    };
    const up = (e: PointerEvent) => {
      setDrag(null);
      if (!drag.moved) {
        if (drag.from === 'rack') pick(drag.tile);
        else tapSlot(drag.slot);
        return;
      }
      const k = slotAt(e.clientX, e.clientY);
      if (drag.from === 'rack') {
        if (k !== null) place(drag.tile, k);
      } else if (k === null) {
        setSlots((cur) => cur.map((x, j) => (j === drag.slot ? null : x)));
        setCursor(drag.slot);
      } else if (k !== drag.slot) {
        sfx.tap();
        setSlots((cur) => cur.map((x, j) => (j === k ? drag.tile : j === drag.slot ? cur[k] : x)));
        setCursor(null);
      }
    };
    const cancel = () => setDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  });

  const fillWord = (w: string) => {
    const used: number[] = [];
    for (const ch of w) {
      const i = [...rack.letters].findIndex((c, j) => c === ch && !used.includes(j));
      if (i < 0) return;
      used.push(i);
    }
    setSlots(EMPTY_SLOTS.map((_, k) => used[k] ?? null));
    setCursor(null);
  };

  async function send() {
    if (!valid || busy) return;
    setBusy(true);
    onError('');
    try {
      const r = await api.submitWord(game.id, word);
      if (r.result === 'ok' && r.game) {
        sfx.whoosh();
        onMove(r.game);
      } else {
        sfx.buzz();
        setBad(r.result === 'not_a_word' ? 'That one isn’t in our word list.' : 'Use 4 to 8 of your tiles.');
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function swap() {
    setBusy(true);
    try {
      const g = await api.swapRack(game.id);
      sfx.whoosh();
      onMove(g);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Backspace') removeLast();
      else if (e.key === 'Enter') void send();
      else if (/^[a-z]$/i.test(e.key)) {
        const ch = e.key.toLowerCase();
        const i = order.find((j) => rack.letters[j] === ch && !used(j));
        if (i !== undefined) pick(i);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  let status: React.ReactNode;
  if (bad) status = <span className="bad">{bad}</span>;
  else if (gap) status = 'Fill the blank, or tap a letter to take it out';
  else if (word.length < 4) status = 'Tap or drag tiles to spell a word (4 to 8 letters)';
  else if (!isWord(word)) status = <span className="bad">Not in our word list</span>;
  else status = <span className="good">✓ {word.toUpperCase()} is worth {wordValue(word)} points</span>;

  return (
    <div className="panel">
      <div className="set-hero">
        <Critter color={game.them.color} size={70} mood="nervous" holding />
        <p className="prompt">Make a word to stump {game.them.username}</p>
      </div>
      <div className="slots">
        {slots.map((i, k) => {
          const cls = `${drag?.over === k ? ' over' : ''}${cursor === k ? ' cursor' : ''}`;
          return i === null ? (
            <div key={k} data-slot={k} className={`slot${cls}`} onPointerDown={() => tapSlot(k)} />
          ) : (
            <button
              key={k}
              data-slot={k}
              className={`tile in-slot${cls}${drag?.moved && drag.from === 'slot' && drag.slot === k ? ' lifted' : ''}`}
              onPointerDown={(e) => startDrag(e, 'slot', i, k)}
            >
              {rack.letters[i]}
              <span className="tv">{LETTER_VALUES[rack.letters[i]]}</span>
            </button>
          );
        })}
      </div>
      <div className="set-status">{status}</div>
      <div className="rack">
        {order.map((i) => (
          <button
            key={i}
            className={`tile ${used(i) ? 'used' : ''}${drag?.moved && drag.from === 'rack' && drag.tile === i ? ' lifted' : ''}`}
            onPointerDown={(e) => !used(i) && startDrag(e, 'rack', i)}
            disabled={used(i)}
          >
            {rack.letters[i]}
            <span className="tv">{LETTER_VALUES[rack.letters[i]]}</span>
          </button>
        ))}
      </div>
      {drag?.moved && (
        <div className="tile drag-ghost" style={{ left: drag.x, top: drag.y }}>
          {rack.letters[drag.tile]}
          <span className="tv">{LETTER_VALUES[rack.letters[drag.tile]]}</span>
        </div>
      )}
      <div className="tool-row">
        <button className="btn btn-ghost" onClick={() => setOrder([...order].sort(() => Math.random() - 0.5))}>Shuffle</button>
        <button className="btn btn-ghost" onClick={clear} disabled={last < 0}>Clear</button>
        <button className="btn btn-ghost" onClick={swap} disabled={busy || rack.swaps_left < 1}>
          New tiles{rack.swaps_left < 1 ? ' (used)' : ''}
        </button>
        <button className="btn btn-ghost" onClick={async () => setSuggest(await ideas(rack.letters))}>Ideas</button>
      </div>
      {suggest && (
        <div className="ideas">
          {suggest.length === 0 ? (
            <span className="fine">No ideas with these tiles. Try New tiles.</span>
          ) : (
            suggest.map((w) => (
              <button key={w} className="chip" onClick={() => fitsRack(w, rack.letters) && fillWord(w)}>
                {w.toUpperCase()} · {wordValue(w)}
              </button>
            ))
          )}
        </div>
      )}
      <button className="btn btn-big btn-go" disabled={!valid || busy} onClick={send}>
        Send to {game.them.username}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- waiting and done

function WaitPanel({ game, me }: { game: Game; me: Me }) {
  const mine = game.history.find((h) => h.setter === me.id && h.status === 'open');
  if (!mine) {
    return (
      <div className="panel">
        <div className="wait-card card center-col">
          <Critter color={game.them.color} size={90} mood="nervous" />
          <p>{game.them.username} is making a word for you…</p>
        </div>
      </div>
    );
  }
  return (
    <div className="panel">
      <Scene color={game.them.color} misses={mine.misses} maxMisses={6} state="playing" rival={{ color: game.me.color }} />
      <p className="prompt">
        {mine.guesses.length === 0
          ? `Sent! Waiting for ${game.them.username} to start guessing.`
          : `${game.them.username} is guessing your word…`}
      </p>
      <div className="word-tiles small">
        {[...mine.word].map((ch, i) => (
          <div key={i} className={`wt ${mine.guesses.includes(ch) ? 'shown' : 'ghost'}`}>{ch}</div>
        ))}
      </div>
      <p className="fine center">
        Worth {mine.value} to you if they can’t get it. Guessed: {mine.guesses ? mine.guesses.toUpperCase().split('').join(' ') : 'nothing yet'}
      </p>
    </div>
  );
}

function DonePanel({ game, me }: { game: Game; me: Me }) {
  const [busy, setBusy] = useState(false);
  const won = game.winner === me.id;
  const tie = !game.winner;
  const played = useRef(false);
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    if (won) sfx.win();
    else if (!tie) sfx.lose();
  }, [won, tie]);
  const [record, setRecord] = useState('');
  useEffect(() => {
    api.headToHead(game.them.id).then((r) => setRecord(recordLine(game.them.username, r))).catch(() => {});
  }, [game.them.id, game.them.username]);
  const title = game.resigned_by
    ? game.resigned_by === me.id ? 'You resigned' : `${game.them.username} resigned`
    : tie ? 'It’s a tie!' : won ? 'You win!' : `${game.them.username} wins!`;
  return (
    <div className="panel">
      <div className={`done-card card center-col ${won ? 'won' : ''}`}>
        <div className="done-critters">
          <Critter color={game.me.color} size={90} mood={won || tie ? 'cheer' : 'nervous'} />
          <Critter color={game.them.color} size={90} mood={!won || tie ? 'cheer' : 'nervous'} />
        </div>
        <div className="result-title">{title}</div>
        <div className="final-score">{game.me.score} – {game.them.score}</div>
        {record && <div className="record-line big">{record} overall</div>}
      </div>
      <button
        className="btn btn-big btn-go"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          go({ name: 'game', id: await api.startGame(game.them.id) });
        }}
      >
        Rematch!
      </button>
    </div>
  );
}

function History({ game, me }: { game: Game; me: Me }) {
  const rows = useMemo(() => game.history.filter((h) => h.status !== 'open'), [game.history]);
  if (!rows.length) return null;
  return (
    <section className="section history">
      <h2>{game.status === 'active' ? 'Words so far' : 'All the words'}</h2>
      {rows.map((h) => {
        const mineSet = h.setter === me.id;
        const who = mineSet ? game.them.username : 'You';
        const left = 6 - h.misses;
        return (
          <div key={h.id} className="hist-row">
            <div className="hist-word">{h.word.toUpperCase()}</div>
            <div className="hist-what">
              {mineSet ? 'Your word. ' : `${game.them.username}’s word. `}
              {h.status === 'solved'
                ? `${who} solved it with ${left} balloon${left === 1 ? '' : 's'} left.`
                : `${who} got stumped.`}
            </div>
            <div className={`hist-pts ${(h.status === 'solved') !== mineSet ? 'good' : 'meh'}`}>
              {h.status === 'solved' ? `+${h.solver_points}` : `+${h.setter_points}`}
              <span className="fine"> {(h.status === 'solved') !== mineSet ? 'you' : game.them.username}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}

type Step = { kind: 'letter'; ch: string } | { kind: 'word'; t: string };

/** How they did on my word, played back guess by guess (Skip jumps to the end). */
function RecapModal({ w, game, onClose }: { w: WordResult; game: Game; onClose: () => void }) {
  const solved = w.status === 'solved';
  const steps = useMemo<Step[]>(() => {
    const out: Step[] = [...w.guesses].map((ch) => ({ kind: 'letter' as const, ch }));
    for (const t of w.wrong_words) out.push({ kind: 'word', t });
    if (solved && [...w.word].some((ch) => !w.guesses.includes(ch))) out.push({ kind: 'word', t: w.word });
    return out;
  }, [w, solved]);
  const [n, setN] = useState(0);
  const done = n >= steps.length;

  useEffect(() => {
    if (done) {
      if (solved) sfx.lose();
      else sfx.win();
      return;
    }
    const t = setTimeout(() => {
      const s = steps[n];
      const hit = s.kind === 'letter' ? w.word.includes(s.ch) : s.t === w.word;
      if (hit) sfx.ding();
      else sfx.pop();
      setN(n + 1);
    }, n === 0 ? 900 : 1000);
    return () => clearTimeout(t);
  }, [n, done, steps, w.word, solved]);

  const shown = steps.slice(0, n);
  const letters = shown.flatMap((s) => (s.kind === 'letter' ? [s.ch] : [])).join('');
  const misses = shown.filter((s) => (s.kind === 'letter' ? !w.word.includes(s.ch) : s.t !== w.word)).length;
  const last = shown.at(-1);
  const fullyShown = done && solved;
  const who = game.them.username;

  return (
    <div className="modal-bg replay-bg">
      <div className="modal replay" onClick={(e) => e.stopPropagation()}>
        <h3 className="center">{done ? (solved ? `${who} got your word` : `You stumped ${who}!`) : `${who} is guessing your word…`}</h3>
        <Scene color={game.them.color} misses={done && !solved ? 6 : misses} maxMisses={6} state={done ? (solved ? 'solved' : 'failed') : 'playing'} rival={{ color: game.me.color }} />
        <div className="word-tiles small">
          {[...w.word].map((ch, i) => (
            <div key={i} className={`wt ${fullyShown || letters.includes(ch) ? 'shown' : done ? 'shown missed' : 'blank'}`}>
              {fullyShown || letters.includes(ch) || done ? ch : ''}
            </div>
          ))}
        </div>
        <div className="replay-line">
          {!done && !last && 'Thinking…'}
          {!done && last && (last.kind === 'letter'
            ? <>Guessed <b>{last.ch.toUpperCase()}</b> {w.word.includes(last.ch) ? '✓' : '✗'}</>
            : <>Went for <b>{last.t.toUpperCase()}</b> {last.t === w.word ? '✓' : '✗'}</>)}
          {done && (solved
            ? `${6 - w.misses} balloon${6 - w.misses === 1 ? '' : 's'} left. +${w.solver_points} for ${who}.`
            : `+${w.setter_points} for you!`)}
        </div>
        {done ? (
          <button className="btn btn-go btn-big" onClick={onClose}>OK</button>
        ) : (
          <button className="btn btn-ghost btn-big" onClick={() => setN(steps.length)}>Skip ›</button>
        )}
      </div>
    </div>
  );
}
