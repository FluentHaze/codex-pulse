import './animated-value.css';

/** Replay for value updates, including raw changes hidden by compact formatting. */
export function AnimatedValue({ value, rawValue }: { value: string; rawValue?: number | null }) {
  const revision = rawValue === undefined ? value : `${rawValue ?? 'empty'}:${value}`;
  return (
    <span key={revision} className="animated-value animated-value-update">
      {value}
    </span>
  );
}
