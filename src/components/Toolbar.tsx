import {
  ArrowClockwise,
  MagnifyingGlass,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import type { SortMode } from "../types";

interface ToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  sort: SortMode;
  onSortChange: (sort: SortMode) => void;
  onScan: () => void;
  scanning: boolean;
}

export function Toolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  onScan,
  scanning,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar-title">
        <span className="title-signal" aria-hidden="true" />
        <div>
          <strong>PortRoot</strong>
          <span>Chaque port, jusqu’à sa racine</span>
        </div>
      </div>
      <label className="search-field">
        <MagnifyingGlass size={19} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Rechercher un dossier, processus, port, PID…"
          aria-label="Rechercher"
        />
        <kbd>⌘K</kbd>
      </label>
      <label className="sort-field">
        <SlidersHorizontal size={18} />
        <span>Trier</span>
        <select value={sort} onChange={(event) => onSortChange(event.target.value as SortMode)}>
          <option value="evaluation">Évaluation</option>
          <option value="activity">Activité</option>
          <option value="age">Ancienneté</option>
          <option value="port">Port</option>
        </select>
      </label>
      <div className="toolbar-actions">
        <button className="primary-button" type="button" onClick={onScan} disabled={scanning}>
          <ArrowClockwise className={scanning ? "is-spinning" : ""} size={19} weight="bold" />
          {scanning ? "Analyse…" : "Analyser"}
        </button>
      </div>
    </header>
  );
}
