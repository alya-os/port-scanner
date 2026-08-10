import { useI18n } from "../lib/i18n";

interface ActivityBarsProps {
  score: number;
}

export function ActivityBars({ score }: ActivityBarsProps) {
  const { t } = useI18n();
  return (
    <span className="activity-bars" aria-label={t("activity.aria", { score })}>
      {[1, 2, 3, 4, 5].map((bar) => (
        <span key={bar} className={bar <= score ? "is-filled" : ""} />
      ))}
    </span>
  );
}
