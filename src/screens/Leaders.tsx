import { useEffect, useState } from 'react';
import { api } from '../api';
import { Critter } from '../art/Critter';
import type { Leader } from '../types';
import { BackBar } from './BackBar';

/** You and your friends, ranked by wins in games against each other. The computer doesn't count. */
export function LeadersScreen() {
  const [rows, setRows] = useState<Leader[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.leaderboard().then(setRows).catch((e) => setError(e.message));
  }, []);
  const anyGames = rows?.some((r) => r.games > 0);

  return (
    <div className="screen">
      <BackBar title="Rankings" />
      {error && <div className="error">{error}</div>}
      {rows === null && !error && <div className="loading">Loading…</div>}
      {rows && !anyGames && (
        <p className="hint">Nobody’s on the board yet. Finish a game against family to get ranked.</p>
      )}
      {rows && anyGames && (
        <div className="card leaders">
          {rows.map((r, i) => (
            <div key={r.id} className={r.me ? 'leader-row me' : 'leader-row'}>
              <span className={`rank rank-${i + 1}`}>{i + 1}</span>
              <Critter color={r.color} size={44} mood={i === 0 ? 'cheer' : 'happy'} />
              <span className="leader-name grow">{r.me ? 'You' : r.username}</span>
              <span className="leader-rec">
                <b>{r.wins}</b>–{r.losses}
              </span>
            </div>
          ))}
          <p className="fine center">Wins–losses in games between you and your friends.</p>
        </div>
      )}
    </div>
  );
}
