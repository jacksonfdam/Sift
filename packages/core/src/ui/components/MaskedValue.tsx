import { useState } from "react";
import { maskedDisplay } from "../../redaction/policy.js";

interface Props {
  value: string;
  /** Whether the policy considers this value sensitive. */
  sensitive: boolean;
  /** Global reveal-all toggle. */
  revealAll: boolean;
}

/**
 * Renders a value, masked when sensitive. Click reveals a single value;
 * the global toggle reveals everything. Masking never leaks value length.
 */
export function MaskedValue({ value, sensitive, revealAll }: Props): JSX.Element {
  const [revealed, setRevealed] = useState(false);
  const show = revealAll || revealed || !sensitive;

  if (show) return <span className="sift-revealed">{value}</span>;

  return (
    <span
      className="sift-masked"
      role="button"
      tabIndex={0}
      title="Click to reveal"
      onClick={() => setRevealed(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setRevealed(true);
        }
      }}
    >
      {maskedDisplay()}
    </span>
  );
}
