-- Removes the throwaway accounts made by tools/test-game.mjs (and their games).
delete from public.games where player1 in (select id from public.profiles where username like 'test\_%')
                            or player2 in (select id from public.profiles where username like 'test\_%');
delete from auth.users where id in (select id from public.profiles where username like 'test\_%');
