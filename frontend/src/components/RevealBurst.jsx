const PARTICLES = Array.from({ length: 14 }, (_, index) => index);

export default function RevealBurst({ burstKey }) {
  if (!burstKey) {
    return null;
  }

  return (
    <div className="reveal-burst" key={burstKey} aria-hidden="true">
      {PARTICLES.map((index) => (
        <i key={index} style={{ "--particle": index }} />
      ))}
      <span>Cards up</span>
    </div>
  );
}
