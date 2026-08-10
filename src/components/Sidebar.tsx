import {
  AppleLogo,
  Desktop,
  LockSimple,
  PuzzlePiece,
  SquaresFour,
  type Icon,
} from "@phosphor-icons/react";
import type { NavFilter, PortRecord } from "../types";

interface SidebarProps {
  active: NavFilter;
  onChange: (filter: NavFilter) => void;
  records: PortRecord[];
  platform: string;
}

const navItems: Array<{ id: NavFilter; label: string; icon: Icon }> = [
  { id: "all", label: "Tous", icon: SquaresFour },
  { id: "application", label: "Applications", icon: Desktop },
  { id: "system", label: "macOS", icon: AppleLogo },
  { id: "other", label: "Autres", icon: PuzzlePiece },
  { id: "protected", label: "Protégés", icon: LockSimple },
];

export function Sidebar({ active, onChange, records, platform }: SidebarProps) {
  const processCount = (filter: NavFilter) => {
    const selected = records.filter((record) => {
      if (filter === "all") return true;
      if (filter === "protected") return record.protected;
      return record.category === filter;
    });
    return new Set(selected.map((record) => `${record.processName}:${record.pid ?? record.port}`)).size;
  };

  return (
    <aside className="sidebar" aria-label="Filtres principaux">
      <div className="sidebar-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const label = item.id === "system" && platform !== "macos" ? "Système" : item.label;
          return (
            <button
              key={item.id}
              className={`sidebar-item ${active === item.id ? "is-active" : ""}`}
              type="button"
              onClick={() => onChange(item.id)}
              aria-pressed={active === item.id}
              title={label}
            >
              <span className="sidebar-icon-wrap">
                <IconComponent size={24} weight={active === item.id ? "fill" : "regular"} />
                <span className="sidebar-count">{processCount(item.id)}</span>
              </span>
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-platform">{platform === "macos" ? "macOS" : platform || "Local"}</div>
    </aside>
  );
}
