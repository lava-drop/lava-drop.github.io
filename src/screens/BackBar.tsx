import { go } from '../App';

export function BackBar({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <header className="backbar">
      <button className="back" onClick={() => go({ name: 'home' })} aria-label="Back">
        ‹
      </button>
      <h1>{title}</h1>
      <div className="backbar-right">{right}</div>
    </header>
  );
}
