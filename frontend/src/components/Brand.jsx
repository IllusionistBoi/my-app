import { Link } from "react-router-dom";

export default function Brand({ compact = false }) {
  return (
    <Link className={`brand${compact ? " brand-compact" : ""}`} to="/" aria-label="Planning Poker home">
      <span className="brand-mark" aria-hidden="true">
        P
      </span>
      <span>Planning Poker</span>
    </Link>
  );
}
