export type Color = 'sun' | 'berry' | 'mint' | 'sky' | 'grape' | 'coral' | 'lime' | 'cocoa';

export interface Player {
  id: string;
  username: string;
  color: Color;
  score: number;
  bot: 'easy' | 'hard' | null;
}

export interface Friend {
  id: string;
  username: string;
  color: Color;
  bot?: 'easy' | 'hard' | null;
  /** My record against them (friends list only). */
  record?: Record3;
}

export interface Record3 {
  wins: number;
  losses: number;
  ties: number;
}

export interface Leader {
  id: string;
  username: string;
  color: Color;
  wins: number;
  losses: number;
  games: number;
  me: boolean;
}

export interface Stats {
  wins: number;
  losses: number;
  ties: number;
  bot_wins: number;
  bot_losses: number;
  best_score: number | null;
  streak: number;
  stumps: number;
  best_word: { word: string; victim: string; points: number } | null;
}

export interface Solving {
  word_id: number;
  seq: number;
  length: number;
  pattern: string;
  guesses: string;
  wrong_words: string[];
  misses: number;
  max_misses: number;
}

export interface WordResult {
  id: number;
  seq: number;
  setter: string;
  solver: string;
  word: string;
  value: number;
  guesses: string;
  wrong_words: string[];
  misses: number;
  pattern: string;
  status: 'open' | 'solved' | 'failed';
  solver_points: number;
  setter_points: number;
  finished_at: string | null;
}

export interface Game {
  id: string;
  status: 'active' | 'finished' | 'cancelled';
  rounds: number;
  i_started: boolean;
  me: Player;
  them: Player;
  action: 'solve' | 'set' | 'wait' | 'done';
  winner: string | null;
  resigned_by: string | null;
  solving: Solving | null;
  rack: { letters: string; swaps_left: number } | null;
  history: WordResult[];
  updated_at: string;
}

export interface GameSummary {
  id: string;
  active: boolean;
  my_turn: boolean;
  them: Player;
  my_score: number;
  round: number;
  rounds: number;
  winner: string | null;
  resigned_by: string | null;
  updated_at: string;
}
