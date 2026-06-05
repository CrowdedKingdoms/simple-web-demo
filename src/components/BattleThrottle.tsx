interface BattleThrottleProps {
  throttle: number;
}

export function BattleThrottle({ throttle }: BattleThrottleProps) {
  const pct = Math.round(Math.max(0, Math.min(1, throttle)) * 100);

  return (
    <div className="battle-throttle" aria-label={`Throttle ${pct} percent`}>
      <span className="battle-throttle-label">SPD</span>
      <div className="battle-throttle-track">
        <div
          className="battle-throttle-fill"
          style={{ height: `${pct}%` }}
          data-testid="throttle-fill"
        />
        <div className="battle-throttle-ticks" aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
      <span className="battle-throttle-value">{pct}</span>
    </div>
  );
}
