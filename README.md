# Lava Drop (repo: pop-quiz)

A two-player, take-turns word game for the family. Each turn you solve the word your opponent
made for you (every wrong letter pops one of your critter's 6 balloons; lose them all and it
lands on a cactus), then make a word for them from 10 letter tiles. 5 rounds, most points wins.
Accounts are username + password; friends are added by username.

The art, the critter, the name and the rules are our own. It is a hangman-style game, not a copy
of any existing app.

## How it's built

- **App:** React + TypeScript + Vite, a static site (installable as a home-screen app via
  `public/manifest.webmanifest` and `public/sw.js`). Hosted on GitHub Pages under `/pop-quiz/`.
- **Backend:** Supabase project **Pop Quiz** (ref `htvuzvtylujcnffifrxl`, us-east-1, free plan).
  Every game rule runs in Postgres functions in `supabase/migrations/`. The app can read only
  profiles, its own friend list and its own game headers; secret words and racks are never
  readable by a player. Live updates come from Realtime on `games` (each guess touches the game,
  so the setter watches the balloons pop live).
- **Accounts:** Supabase needs an email, so each username maps to
  `<username>@players.popquiz.invalid` (`src/config.ts`). Email confirmation is off. There is
  no password reset by email; reset one with the Supabase dashboard (Authentication > Users).
- **Words:** `tools/build-words.mjs` builds the list players may set (41,644 words, 4-8
  letters): the American spell-check list (ESDB/SCOWL size 60, US, `tools/data/scowl-us60.txt`,
  license in `tools/data/scowl-README.txt`) plus "common" words (ENABLE ∩ the 50k most frequent
  in hermitdave/FrequencyWords, CC BY-SA 4.0; only these are set by the bot), minus
  `tools/data/blocklist.txt` and its word endings (with an allow list for SPICY, HONKED ...).
  Both sources are credited on How to play. It writes `public/words.txt` (instant check in the
  app) and migration 17, which syncs the dictionary table. Guessing letters needs no dictionary.
- **Missed words:** words left marked "Not in our word list" for 3 s are logged to
  `missed_words` (migration 18): `select word, count(*) from missed_words group by 1 order by 2 desc`.

## Rules as coded

- Player 1 sets a word first. On each later turn: solve the open word, then set one. Turn engine:
  `next_action()` / `advance_game()` in the schema migration.
- Racks: 10 tiles, 3-4 vowels, at most two of any letter, re-dealt until the rack can make at
  least 8 words of 5+ letters (`deal_rack()`). One "New tiles" per turn, costing `swap_cost()` (5) points (migration 16).
- Letter values: 1 (e a i o n r t s l), 2 (u d g), 3 (c m h b p), 4 (f w y v k), 6 (j x), 8 (q z).
- Solve: word value + 2 per balloon left, to the solver. Fail: word value to the setter.
- A wrong whole-word guess costs a balloon, like a wrong letter.

## Commands

```bash
npm run dev                                   # local, http://localhost:5173/pop-quiz/
npm run build                                 # type-check + build to dist/
node tools/build-words.mjs                    # rebuild the word list + dictionary migration
npx supabase db push --remote                 # apply new migrations (CLI is signed in on this PC)
node --experimental-strip-types tools/test-game.mjs     # full game + security checks, live
npx supabase db query --remote --yes -f tools/cleanup-test-users.sql   # remove test_ accounts
node tools/screenshots.mjs <dir>              # scripted playthrough screenshots (dev server up)
```
