/** Pulsing "radar" dot. Pass off to show it paused. */
export default function Orb({ off = false }: { off?: boolean }) {
  return (
    <div className={`orb-wrap ${off ? "off" : ""}`} aria-hidden>
      <span className="ring" />
      <span className="ring" />
      <span className="ring" />
      <div className="orb" />
    </div>
  );
}
