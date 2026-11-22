import { useCallback, useEffect, useState } from 'react';
import { loadMe, type Me } from './api';
import { supabase } from './supabase';
import { AuthScreen } from './screens/Auth';
import { HomeScreen } from './screens/Home';
import { FriendsScreen } from './screens/Friends';
import { GameScreen } from './screens/Game';
import { MeScreen } from './screens/MeScreen';
import { HowToPlay } from './screens/HowToPlay';
import { InviteScreen } from './screens/Invite';
import { LeadersScreen } from './screens/Leaders';
import { loadWords } from './words';
import { resavePush } from './push';

export type Route =
  | { name: 'home' }
  | { name: 'friends' }
  | { name: 'me' }
  | { name: 'help' }
  | { name: 'leaders' }
  | { name: 'game'; id: string }
  | { name: 'invite'; id: string };

function parseHash(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  const [a, b] = h.split('/');
  if (a === 'game' && b) return { name: 'game', id: b };
  if (a === 'invite' && b) return { name: 'invite', id: b };
  if (a === 'friends') return { name: 'friends' };
  if (a === 'me') return { name: 'me' };
  if (a === 'help') return { name: 'help' };
  if (a === 'leaders') return { name: 'leaders' };
  return { name: 'home' };
}

export function go(r: Route) {
  location.hash = r.name === 'game' || r.name === 'invite' ? `#/${r.name}/${r.id}` : r.name === 'home' ? '#/' : `#/${r.name}`;
}

export default function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [route, setRoute] = useState<Route>(parseHash);

  const refreshMe = useCallback(async () => {
    const m = await loadMe();
    setMe(m);
    // A phone that already allowed notifications follows whoever signs in on it.
    if (m) void resavePush();
  }, []);

  useEffect(() => {
    void refreshMe();
    void loadWords();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void refreshMe();
    });
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener('hashchange', onHash);
    };
  }, [refreshMe]);

  if (me === undefined) return <div className="app"><div className="loading">Loading…</div></div>;
  if (me === null) return <div className="app"><AuthScreen onDone={refreshMe} inviter={route.name === 'invite' ? route.id : undefined} /></div>;

  return (
    <div className="app">
      {route.name === 'home' && <HomeScreen me={me} onChange={refreshMe} />}
      {route.name === 'friends' && <FriendsScreen me={me} />}
      {route.name === 'me' && <MeScreen me={me} onChange={refreshMe} />}
      {route.name === 'help' && <HowToPlay />}
      {route.name === 'leaders' && <LeadersScreen />}
      {route.name === 'game' && <GameScreen key={route.id} me={me} gid={route.id} />}
      {route.name === 'invite' && <InviteScreen key={route.id} me={me} inviter={route.id} />}
    </div>
  );
}
