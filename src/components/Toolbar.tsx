import { ArrowClockwise, MagnifyingGlass, ShieldCheck, ShieldSlash } from "@phosphor-icons/react";
import { useI18n } from "../lib/i18n";

interface ToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  protectedFilterAvailable: boolean;
  hideProtected: boolean;
  protectedProcessCount: number;
  onToggleProtected: () => void;
  onScan: () => void;
  scanning: boolean;
}

export function Toolbar({
  query,
  onQueryChange,
  protectedFilterAvailable,
  hideProtected,
  protectedProcessCount,
  onToggleProtected,
  onScan,
  scanning,
}: ToolbarProps) {
  const { t } = useI18n();

  return (
    <header className="toolbar">
      <div className="toolbar-title">
        <span className="title-signal" aria-hidden="true" />
        <div>
          <strong>Port Scanner</strong>
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
        <button
          className={`protected-filter-button ${hideProtected ? "is-active" : ""} ${protectedFilterAvailable ? "" : "is-unavailable"}`}
          type="button"
          onClick={onToggleProtected}
          disabled={!protectedFilterAvailable || (!hideProtected && protectedProcessCount === 0)}
          aria-pressed={hideProtected}
          aria-hidden={!protectedFilterAvailable}
          tabIndex={protectedFilterAvailable ? 0 : -1}
          title={t(hideProtected ? "toolbar.showProtected" : "toolbar.hideProtected")}
        >
          {hideProtected ? <ShieldCheck size={18} weight="duotone" /> : <ShieldSlash size={18} weight="duotone" />}
          <span className="protected-filter-label">{t(hideProtected ? "toolbar.showProtected" : "toolbar.hideProtected")}</span>
          {protectedProcessCount > 0 && <span className="protected-filter-count">{protectedProcessCount}</span>}
        </button>
        <button
          className="primary-button scan-button"
          type="button"
          onClick={onScan}
          disabled={scanning}
          aria-busy={scanning}
        >
          <ArrowClockwise className={scanning ? "is-spinning" : ""} size={19} weight="bold" />
          <span>{scanning ? t("toolbar.scanning") : t("toolbar.analyze")}</span>
        </button>
      </div>
    </header>
  );
}
