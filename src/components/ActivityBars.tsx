interface ActivityBarsProps {
  score: number;
}

export function ActivityBars({ score }: ActivityBarsProps) {
  return (
    <span className="activity-bars" aria-label={`Activité ${score} sur 5`}>
      {[1, 2, 3, 4, 5].map((bar) => (
        <span key={bar} className={bar <= score ? "is-filled" : ""} />
      ))}
    </span>
  );
}
