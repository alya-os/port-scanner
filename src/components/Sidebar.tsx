import {
  AppleLogo,
  Desktop,
  GearSix,
  LinuxLogo,
  LockSimple,
  Moon,
  PuzzlePiece,
  Robot,
  SidebarSimple,
  SquaresFour,
  Sun,
  WindowsLogo,
  type Icon,
} from "@phosphor-icons/react";
import { useI18n, type TranslationKey, type Translator } from "../lib/i18n";
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

const navItems: Array<{ id: NavFilter; label: TranslationKey; icon: Icon }> = [
  { id: "all", label: "sidebar.all", icon: SquaresFour },
  { id: "application", label: "sidebar.applications", icon: Desktop },
  { id: "system", label: "sidebar.system", icon: AppleLogo },
  { id: "other", label: "sidebar.other", icon: PuzzlePiece },
  { id: "ai", label: "sidebar.ai", icon: Robot },
  { id: "protected", label: "sidebar.protected", icon: LockSimple },
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
  const { t } = useI18n();
  const SystemIcon =
    platform === "macos"
      ? AppleLogo
      : platform === "windows"
      ? WindowsLogo
      : LinuxLogo;
  const processCount = (filter: NavFilter) => {
    const selected = records.filter((record) => {
      if (filter === "all") return true;
      if (filter === "protected") return record.protected;
      if (filter === "ai") return record.ai;
      return record.category === filter;
    });
    return new Set(
      selected.map(
        (record) => `${record.processName}:${record.pid ?? record.port}`
      )
    ).size;
  };

  return (
    <aside className="sidebar" aria-label={t("sidebar.navigation")}>
      <button
        className="sidebar-collapse-button"
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
        aria-expanded={!collapsed}
        aria-controls="primary-navigation"
        title={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
      >
        <SidebarSimple size={22} weight="regular" />
      </button>
      <nav className="sidebar-nav" id="primary-navigation">
        {navItems.map((item) => {
          const IconComponent = item.id === "system" ? SystemIcon : item.icon;
          const label =
            item.id === "system" ? systemLabel(platform, t) : t(item.label);
          return (
            <button
              key={item.id}
              className={`sidebar-item ${
                active === item.id ? "is-active" : ""
              }`}
              type="button"
              onClick={() => onChange(item.id)}
              aria-pressed={active === item.id}
              title={label}
            >
              <span className="sidebar-icon-wrap">
                <IconComponent
                  size={24}
                  weight={active === item.id ? "fill" : "regular"}
                />
                <span className="sidebar-count">{processCount(item.id)}</span>
              </span>
              <span className="sidebar-label">{label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-utilities" aria-label={t("sidebar.utilities")}>
          <button
            className="sidebar-utility-button"
            type="button"
            onClick={onToggleTheme}
            aria-label={
              theme === "dark"
                ? t("sidebar.switchLight")
                : t("sidebar.switchDark")
            }
            title={
              theme === "dark"
                ? t("sidebar.lightTheme")
                : t("sidebar.darkTheme")
            }
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            className="sidebar-utility-button"
            type="button"
            onClick={onOpenSettings}
            aria-label={t("sidebar.openSettings")}
            title={t("sidebar.settings")}
          >
            <GearSix size={21} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function systemLabel(platform: string, t: Translator): string {
  if (platform === "macos") return "macOS";
  if (platform === "windows") return "Windows";
  if (platform === "linux") return "Linux";
  return t("sidebar.system");
}
