/** The title in hot chunky letters, with a balloon for the O. */
export function Logo({ size = 1 }: { size?: number }) {
  return (
    <div className="logo" style={{ fontSize: `${size}rem` }} aria-label="Lava Drop">
      <span className="logo-word">LAVA</span>
      <span className="logo-gap" />
      <span className="logo-word">DR</span>
      <span className="logo-balloon" aria-hidden />
      <span className="logo-word">P</span>
    </div>
  );
}
