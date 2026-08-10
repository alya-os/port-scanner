import {
  AppleLogo,
  Desktop,
  GearSix,
  LinuxLogo,
  LockSimple,
  Moon,
  PuzzlePiece,
  SidebarSimple,
  SquaresFour,
  Sun,
  WindowsLogo,
  type Icon,
} from "@phosphor-icons/react";
import type { NavFilter, PortRecord } from "../types";

interface SidebarProps {
  active: NavFilter;
  onChange: (filter: NavFilter) => void;
  records: PortRecord[];
  platform: string;
  theme: "dark" | "light";
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
}

const navItems: Array<{ id: NavFilter; label: string; icon: Icon }> = [
  { id: "all", label: "Tous", icon: SquaresFour },
  { id: "application", label: "Applications", icon: Desktop },
  { id: "system", label: "macOS", icon: AppleLogo },
  { id: "other", label: "Autres", icon: PuzzlePiece },
  { id: "protected", label: "Protégés", icon: LockSimple },
];

export function Sidebar({
  active,
  onChange,
  records,
  platform,
  theme,
  collapsed,
  onToggleCollapsed,
  onToggleTheme,
  onOpenSettings,
}: SidebarProps) {
  const SystemIcon = platform === "macos" ? AppleLogo : platform === "windows" ? WindowsLogo : LinuxLogo;
  const processCount = (filter: NavFilter) => {
    const selected = records.filter((record) => {
      if (filter === "all") return true;
      if (filter === "protected") return record.protected;
      return record.category === filter;
    });
    return new Set(selected.map((record) => `${record.processName}:${record.pid ?? record.port}`)).size;
  };

  return (
    <aside className="sidebar" aria-label="Navigation principale">
      <button
        className="sidebar-collapse-button"
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Déployer la barre latérale" : "Réduire la barre latérale"}
        aria-expanded={!collapsed}
        aria-controls="primary-navigation"
        title={collapsed ? "Déployer la barre latérale" : "Réduire la barre latérale"}
      >
        <SidebarSimple size={22} weight="regular" />
      </button>
      <nav className="sidebar-nav" id="primary-navigation">
        {navItems.map((item) => {
          const IconComponent = item.id === "system" ? SystemIcon : item.icon;
          const label = item.id === "system" ? systemLabel(platform) : item.label;
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
              <span className="sidebar-label">{label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-utilities" aria-label="Affichage et réglages">
          <button
            className="sidebar-utility-button"
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre"}
            title={theme === "dark" ? "Thème clair" : "Thème sombre"}
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            className="sidebar-utility-button"
            type="button"
            onClick={onOpenSettings}
            aria-label="Ouvrir les réglages"
            title="Réglages"
          >
            <GearSix size={21} />
          </button>
        </div>
        <div className="sidebar-platform">{platform === "macos" ? "macOS" : platform || "Local"}</div>
      </div>
    </aside>
  );
}

function systemLabel(platform: string): string {
  if (platform === "macos") return "macOS";
  if (platform === "windows") return "Windows";
  if (platform === "linux") return "Linux";
  return "Système";
}
