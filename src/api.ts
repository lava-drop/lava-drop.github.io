import { supabase } from './supabase';
import type { Color, Friend, Game, GameSummary } from './types';

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const api = {
  usernameAvailable: (name: string) => call<boolean>('username_available', { name }),
  listGames: () => call<GameSummary[]>('list_games'),
  listFriends: () => call<Friend[]>('list_friends'),
  listBots: () => call<Friend[]>('list_bots'),
  addFriend: (name: string) =>
    call<{ result: 'ok' | 'not_found' | 'self' | 'bot'; friend?: Friend }>('add_friend', { name }),
  removeFriend: (fid: string) => call<void>('remove_friend', { fid }),
  setColor: (c: Color) => call<void>('set_color', { c }),
  startGame: (opponent: string) => call<string>('start_game', { opponent }),
  getGame: (gid: string) => call<Game | null>('get_game', { gid }),
  guessLetter: (gid: string, letter: string) => call<Game>('guess_letter', { gid, letter }),
  guessWord: (gid: string, guess: string) => call<Game>('guess_word', { gid, guess }),
  swapRack: (gid: string) => call<Game>('swap_rack', { gid }),
  submitWord: (gid: string, word: string) =>
    call<{ result: 'ok' | 'not_a_word' | 'not_in_rack' | 'bad_length'; game?: Game }>('submit_word', { gid, word }),
  resign: (gid: string) => call<Game>('resign', { gid }),
  changeUsername: (newName: string) => call<'ok' | 'invalid' | 'taken'>('change_username', { new_name: newName }),
};

export interface Me {
  id: string;
  username: string;
  color: Color;
  /** Signed in with Play now: no username/password yet, lives only in this browser. */
  guest: boolean;
}

export async function loadMe(): Promise<Me | null> {
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) return null;
  const { data } = await supabase.from('profiles').select('id, username, color').eq('id', uid).single();
  return data ? { ...(data as Omit<Me, 'guest'>), guest: s.session?.user.is_anonymous === true } : null;
}
