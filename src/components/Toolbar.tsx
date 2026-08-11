import { ArrowClockwise, MagnifyingGlass } from "@phosphor-icons/react";
import { useI18n } from "../lib/i18n";

interface ToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onScan: () => void;
  scanning: boolean;
}

export function Toolbar({
  query,
  onQueryChange,
  onScan,
  scanning,
}: ToolbarProps) {
  const { t } = useI18n();

  return (
    <header className="toolbar">
      <div className="toolbar-title">
        <span className="title-signal" aria-hidden="true" />
        <div>
          <strong>PortRoot</strong>
          <span>{t("app.tagline")}</span>
        </div>
      </div>
      <label className="search-field">
        <MagnifyingGlass size={19} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("toolbar.searchPlaceholder")}
          aria-label={t("toolbar.search")}
        />
        <kbd>⌘K</kbd>
      </label>
      <div className="toolbar-actions">
        <button className="primary-button" type="button" onClick={onScan} disabled={scanning}>
          <ArrowClockwise className={scanning ? "is-spinning" : ""} size={19} weight="bold" />
          {scanning ? t("toolbar.scanning") : t("toolbar.analyze")}
        </button>
      </div>
    </header>
  );
}
