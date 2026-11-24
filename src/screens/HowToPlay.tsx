import { Critter } from '../art/Critter';
import { BackBar } from './BackBar';

export function HowToPlay() {
  return (
    <div className="screen">
      <BackBar title="How to play" />
      <div className="card prose">
        <div className="center-col">
          <Critter color="coral" size={90} holding mood="nervous" />
        </div>
        <h3>Take turns stumping each other</h3>
        <p>
          A game is 5 rounds. On your turn you <b>solve</b> the word your opponent made for you, then <b>make</b> a
          word for them. (Whoever starts just makes a word on the first turn.)
        </p>
        <h3>Solving</h3>
        <p>
          Your lava brute hangs from 6 balloons over a lake of lava. Guess one letter at a time. Every wrong letter
          pops a balloon. Think you know it? Tap <b>Solve it</b> and type the whole word, but a wrong guess pops a
          balloon too. Lose all 6 and you drop in.
        </p>
        <h3>Making a word</h3>
        <p>
          You get 10 letter tiles. Tap tiles to spell a real word, 4 to 8 letters long. Don’t like your tiles? Tap
          <b>New tiles</b> to trade them once per turn, but it costs you 5 points.
        </p>
        <h3>Points</h3>
        <p>
          Each letter is worth points: common letters 1, rare ones like Q and Z up to 8. A word is worth all its
          letters added up.
        </p>
        <ul>
          <li>Solve a word: you get its points, plus 2 for every balloon you still have.</li>
          <li>Stump your opponent: you get your word’s points.</li>
        </ul>
        <p>Hard letters score more, but if they solve it, they get those points. Choose wisely!</p>
        <p>After 5 rounds, the most points wins.</p>
        <h3>No one to play?</h3>
        <p>No one around? Play <b>Magma</b>, the computer, from the New game screen.</p>
      </div>
      <p className="fine center">Word list: ENABLE (public domain) filtered by the OpenSubtitles frequency list (hermitdave/FrequencyWords, CC BY-SA 4.0).</p>
    </div>
  );
}
