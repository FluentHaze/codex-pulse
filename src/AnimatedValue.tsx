import './animated-value.css';

/** Replay for value updates, including raw changes hidden by compact formatting. */
export function AnimatedValue({
  value,
  rawValue,
  rolling = false,
}: {
  value: string;
  rawValue?: number | null;
  rolling?: boolean;
}) {
  if (rolling) {
    return (
      <span className="animated-value animated-value-rolling" aria-label={value}>
        {Array.from(value).map((character, index) => {
          const digit = /^[0-9]$/.test(character);
          return (
            <span
              key={
                digit
                  ? `digit:${value.slice(index + 1).replace(/[^0-9]/g, '').length}`
                  : `symbol:${character}:${value.length - index}`
              }
              className={digit ? 'rolling-digit' : 'rolling-symbol'}
              aria-hidden="true"
            >
              {digit ? (
                <span
                  className="rolling-digit-strip"
                  style={{ transform: `translateY(-${Number(character) * 10}%)` }}
                >
                  {Array.from({ length: 10 }, (_, number) => (
                    <span key={number}>{number}</span>
                  ))}
                </span>
              ) : (
                character
              )}
            </span>
          );
        })}
      </span>
    );
  }
  const revision = rawValue === undefined ? value : `${rawValue ?? 'empty'}:${value}`;
  return (
    <span key={revision} className="animated-value animated-value-update">
      {value}
    </span>
  );
}
