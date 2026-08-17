import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppleLogo,
  BracketsCurly,
  CaretDown,
  CaretRight,
  CaretUp,
  Cube,
  Database,
  FilePy,
  Folder,
  GlobeHemisphereWest,
  LockSimple,
  LinuxLogo,
  Network,
  SpinnerGap,
  TerminalWindow,
  WindowsLogo,
} from "@phosphor-icons/react";
import { ActivityBars } from "./ActivityBars";
import { evaluationCopy, formatDuration, shortAddress } from "../lib/format";
import { useI18n, type Translator } from "../lib/i18n";
import type {
  ProcessGroup,
  ProcessNode,
  SortDirection,
  SortMode,
} from "../types";

interface TreeRow {
  id: string;
  level: number;
  expandable: boolean;
  expanded: boolean;
  parentId: string | null;
}

// Un dossier, un processus et un port peuvent porter la même chaîne : le genre
// préfixe l'identifiant pour que deux lignes ne se confondent jamais.
const groupRowId = (id: string) => `group:${id}`;
const processRowId = (id: string) => `process:${id}`;
const portRowId = (id: string) => `port:${id}`;

function splitRowId(rowId: string): [string, string] {
  const separator = rowId.indexOf(":");
  return [rowId.slice(0, separator), rowId.slice(separator + 1)];
}

interface ProcessTreeProps {
  groups: ProcessGroup[];
  selectedId: string | null;
  onSelect: (process: ProcessNode) => void;
  scanning: boolean;
  platform: string;
  sort: SortMode;
  sortDirection: SortDirection;
  onSortChange: (sort: SortMode) => void;
}

export function ProcessTree({
  groups,
  selectedId,
  onSelect,
  scanning,
  platform,
  sort,
  sortDirection,
  onSortChange,
}: ProcessTreeProps) {
  const { language, t } = useI18n();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      for (const group of groups) {
        if (group.category !== "system") next.add(group.id);
      }
      return next;
    });
  }, [groups]);

  useEffect(() => {
    if (!selectedId) return;
    setExpandedProcesses((current) => new Set(current).add(selectedId));
  }, [selectedId]);

  const totalVisible = useMemo(
    () => groups.reduce((total, group) => total + group.processes.length, 0),
    [groups]
  );

  const toggle = (
    values: Set<string>,
    value: string,
    update: (next: Set<string>) => void
  ) => {
    const next = new Set(values);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    update(next);
  };

  // Le rendu reste imbriqué, parce que le trait de parenté et les décalages sont
  // dessinés par le CSS des conteneurs. La navigation, elle, a besoin de l'ordre
  // visuel : cette liste plate est la même hiérarchie, vue comme on la parcourt.
  const rows = useMemo(() => {
    const visible: TreeRow[] = [];
    for (const group of groups) {
      const groupOpen = expandedGroups.has(group.id);
      visible.push({
        id: groupRowId(group.id),
        level: 1,
        expandable: group.processes.length > 0,
        expanded: groupOpen,
        parentId: null,
      });
      if (!groupOpen) continue;

      for (const process of group.processes) {
        const processOpen = expandedProcesses.has(process.id);
        visible.push({
          id: processRowId(process.id),
          level: 2,
          expandable: process.records.length > 0,
          expanded: processOpen,
          parentId: groupRowId(group.id),
        });
        if (!processOpen) continue;

        for (const record of process.records) {
          visible.push({
            id: portRowId(record.id),
            level: 3,
            expandable: false,
            expanded: false,
            parentId: processRowId(process.id),
          });
        }
      }
    }
    return visible;
  }, [expandedGroups, expandedProcesses, groups]);

  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const rowElements = useRef(new Map<string, HTMLElement>());
  // jsdom n'a pas de `CSS.escape`, et un identifiant de ligne contient des
  // chemins : on retient les éléments plutôt que de reconstruire un sélecteur.
  const registerRow = useCallback((id: string, element: HTMLElement | null) => {
    if (element) rowElements.current.set(id, element);
    else rowElements.current.delete(id);
  }, []);

  const activeRow = rows.some((row) => row.id === activeRowId)
    ? activeRowId
    : rows[0]?.id ?? null;

  const focusRow = (id: string | undefined) => {
    if (!id) return;
    setActiveRowId(id);
    rowElements.current.get(id)?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = rows.findIndex((row) => row.id === activeRow);
    if (index < 0) return;
    const row = rows[index];

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusRow(rows[index + 1]?.id);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusRow(rows[index - 1]?.id);
        break;
      case "ArrowRight":
        event.preventDefault();
        if (row.expandable && !row.expanded) toggleRow(row);
        else focusRow(rows[index + 1]?.id);
        break;
      case "ArrowLeft":
        event.preventDefault();
        if (row.expandable && row.expanded) toggleRow(row);
        else focusRow(row.parentId ?? undefined);
        break;
      case "Home":
        event.preventDefault();
        focusRow(rows[0]?.id);
        break;
      case "End":
        event.preventDefault();
        focusRow(rows[rows.length - 1]?.id);
        break;
      default:
        break;
    }
  };

  const toggleRow = (row: TreeRow) => {
    const [kind, id] = splitRowId(row.id);
    if (kind === "group") toggle(expandedGroups, id, setExpandedGroups);
    if (kind === "process") toggle(expandedProcesses, id, setExpandedProcesses);
  };

  const rowProps = (id: string, level: number) => ({
    ref: (element: HTMLElement | null) => registerRow(id, element),
    role: "treeitem",
    "aria-level": level,
    tabIndex: activeRow === id ? 0 : -1,
    onFocus: () => setActiveRowId(id),
  });

  if (scanning && groups.length === 0) return <TreeSkeleton />;

  if (groups.length === 0) {
    return (
      <section className="process-tree empty-state" aria-live="polite">
        <Network size={38} weight="duotone" />
        <h2>{t("tree.emptyTitle")}</h2>
        <p>{t("tree.emptyDescription")}</p>
      </section>
    );
  }

  return (
    <section className="process-tree" aria-busy={scanning}>
      <div className="tree-scroll" inert={scanning ? true : undefined}>
        {/* Les en-têtes ne sont pas des `columnheader` : sans grille au-dessus
            d'eux le rôle serait orphelin, donc ignoré. Chaque bouton de tri
            porte lui-même son état dans son nom accessible. */}
        <div className="tree-columns tree-header" role="presentation">
          <SortableHeader
            label={t("tree.element")}
            mode="name"
            activeSort={sort}
            direction={sortDirection}
            onSort={onSortChange}
          />
          <SortableHeader
            label={t("tree.port")}
            mode="port"
            activeSort={sort}
            direction={sortDirection}
            onSort={onSortChange}
          />
          <SortableHeader
            label={t("tree.scope")}
            mode="scope"
            activeSort={sort}
            direction={sortDirection}
            onSort={onSortChange}
          />
          <SortableHeader
            label={t("tree.activity")}
            mode="activity"
            activeSort={sort}
            direction={sortDirection}
            onSort={onSortChange}
          />
          <SortableHeader
            label={t("tree.evaluation")}
            mode="evaluation"
            activeSort={sort}
            direction={sortDirection}
            onSort={onSortChange}
          />
        </div>
        <div
          role="tree"
          aria-label={t("tree.families", { count: totalVisible })}
          onKeyDown={handleKeyDown}
        >
          {groups.map((group) => {
            const groupOpen = expandedGroups.has(group.id);
            return (
              <div className="tree-group" role="presentation" key={group.id}>
                <div
                  className="tree-group-row"
                  onClick={() =>
                    toggle(expandedGroups, group.id, setExpandedGroups)
                  }
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    toggle(expandedGroups, group.id, setExpandedGroups);
                  }}
                  aria-expanded={groupOpen}
                  {...rowProps(groupRowId(group.id), 1)}
                >
                  {groupOpen ? (
                    <CaretDown size={15} />
                  ) : (
                    <CaretRight size={15} />
                  )}
                  {group.category === "system" ? (
                    <SystemIcon
                      platform={platform}
                      className="group-system-icon"
                      size={21}
                    />
                  ) : (
                    <Folder
                      className="group-folder-icon"
                      size={21}
                      weight="duotone"
                    />
                  )}
                  <strong>
                    {group.category === "system"
                      ? t("tree.systemServices", {
                          platform: platformLabel(platform),
                        })
                      : group.label}
                  </strong>
                  <span className="group-summary">
                    {t(
                      group.processes.length === 1
                        ? "common.processOne"
                        : "common.processMany",
                      { count: group.processes.length }
                    )}
                    {group.protected && (
                      <span className="protected-summary">
                        <LockSimple size={14} weight="fill" />{" "}
                        {t("tree.protected")}
                      </span>
                    )}
                  </span>
                </div>
                {groupOpen && (
                  <div className="group-children" role="presentation">
                    {group.processes.map((process) => {
                      const processOpen = expandedProcesses.has(process.id);
                      const selected = selectedId === process.id;
                      const evaluation = evaluationCopy(
                        process.evaluation,
                        language,
                        {
                          count: process.duplicateAssessment.instanceCount,
                        }
                      );
                      return (
                        <div
                          className="process-branch"
                          role="presentation"
                          key={process.id}
                        >
                          <div
                            className={`tree-columns process-row ${
                              selected ? "is-selected" : ""
                            }`}
                            aria-expanded={processOpen}
                            aria-selected={selected}
                            onClick={() => onSelect(process)}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter" && event.key !== " ")
                                return;
                              event.preventDefault();
                              onSelect(process);
                            }}
                            {...rowProps(processRowId(process.id), 2)}
                          >
                            <div className="tree-name-cell">
                              {/* Les commandes internes restent cliquables mais
                                  sortent du parcours de tabulation : la ligne
                                  elle-même est le point d'entrée au clavier. */}
                              <button
                                className="expand-button"
                                type="button"
                                tabIndex={-1}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggle(
                                    expandedProcesses,
                                    process.id,
                                    setExpandedProcesses
                                  );
                                }}
                                aria-label={
                                  processOpen
                                    ? t("tree.collapsePorts")
                                    : t("tree.showPorts")
                                }
                                aria-expanded={processOpen}
                              >
                                {processOpen ? (
                                  <CaretDown size={13} />
                                ) : (
                                  <CaretRight size={13} />
                                )}
                              </button>
                              <button
                                className="process-select"
                                type="button"
                                tabIndex={-1}
                                onClick={() => onSelect(process)}
                              >
                                <ProcessIcon
                                  process={process}
                                  platform={platform}
                                />
                                <span>
                                  <strong>
                                    <span className="process-title">
                                      {friendlyProcessName(process, t)}
                                    </span>
                                    {process.ai && (
                                      <span
                                        className="ai-tag"
                                        title={t("tree.aiTagTitle")}
                                      >
                                        {t("tree.aiTag")}
                                      </span>
                                    )}
                                  </strong>
                                  <small>
                                    {process.dockerContainerId
                                      ? t("tree.containerShort", {
                                          id: process.dockerContainerId.slice(
                                            0,
                                            12
                                          ),
                                        })
                                      : process.pids.length > 1
                                      ? t("tree.instancesPorts", {
                                          instances: process.pids.length,
                                          ports: process.records.length,
                                        })
                                      : `PID ${
                                          process.pids[0] ?? t("tree.hiddenPid")
                                        }`}
                                  </small>
                                </span>
                              </button>
                            </div>
                            <span className="mono">
                              {process.records.length === 1
                                ? process.records[0].port
                                : "—"}
                            </span>
                            <span>{scopeSummary(process, t)}</span>
                            <span className="activity-cell">
                              <ActivityBars score={process.activityScore} />
                              <small>{activityCopy(process, t)}</small>
                            </span>
                            <span
                              className={`evaluation evaluation-${evaluation.tone}`}
                            >
                              {process.protected && (
                                <LockSimple size={14} weight="fill" />
                              )}
                              <i aria-hidden="true" /> {evaluation.label}
                            </span>
                          </div>
                          {processOpen && (
                            <div className="port-children" role="presentation">
                              {process.records.map((record) => (
                                <div
                                  className="tree-columns port-row"
                                  key={record.id}
                                  onClick={() => onSelect(process)}
                                  onKeyDown={(event) => {
                                    if (
                                      event.key !== "Enter" &&
                                      event.key !== " "
                                    )
                                      return;
                                    event.preventDefault();
                                    onSelect(process);
                                  }}
                                  {...rowProps(portRowId(record.id), 3)}
                                >
                                  <span className="port-name-cell">
                                    <GlobeHemisphereWest size={17} />
                                    <span>{record.protocol}</span>
                                    {record.dockerContainerId ? (
                                      <small>
                                        {t("tree.containerShort", {
                                          id: record.dockerContainerId.slice(
                                            0,
                                            12
                                          ),
                                        })}
                                      </small>
                                    ) : (
                                      record.pid && (
                                        <small>PID {record.pid}</small>
                                      )
                                    )}
                                  </span>
                                  <span className="mono">{record.port}</span>
                                  <span title={record.localAddress}>
                                    {shortAddress(
                                      record.localAddress,
                                      language
                                    )}
                                  </span>
                                  <span className="activity-cell">
                                    <ActivityBars
                                      score={Math.max(
                                        1,
                                        Math.min(
                                          5,
                                          Math.ceil(
                                            record.cpuUsage +
                                              record.activeConnections
                                          )
                                        )
                                      )}
                                    />
                                    <small>
                                      {formatDuration(
                                        record.uptimeSeconds,
                                        language
                                      )}
                                    </small>
                                  </span>
                                  <span
                                    className={`port-scope scope-${record.scope}`}
                                  >
                                    <i aria-hidden="true" />
                                    {record.scope === "local"
                                      ? t("common.local")
                                      : t("common.exposed")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {scanning && (
        <div className="tree-refresh-overlay">
          <div className="tree-refresh-status" role="status" aria-live="polite">
            <SpinnerGap
              className="is-spinning"
              size={20}
              weight="bold"
              aria-hidden="true"
            />
            <span>{t("tree.refreshing")}</span>
          </div>
        </div>
      )}
    </section>
  );
}

function SortableHeader({
  label,
  mode,
  activeSort,
  direction,
  onSort,
}: {
  label: string;
  mode: SortMode;
  activeSort: SortMode;
  direction: SortDirection;
  onSort: (sort: SortMode) => void;
}) {
  const { t } = useI18n();
  const active = mode === activeSort;
  // Le tri courant voyage dans le nom du bouton : sans grille, « aria-sort » ne
  // serait porté par rien et ne serait donc jamais annoncé.
  const description = active
    ? t(
        direction === "ascending"
          ? "tree.sortedAscending"
          : "tree.sortedDescending",
        { column: label }
      )
    : t("tree.sortBy", { column: label });

  return (
    <span className="tree-header-cell">
      <button
        className={`tree-sort-button ${active ? "is-active" : ""}`}
        type="button"
        onClick={() => onSort(mode)}
        aria-label={description}
        title={description}
      >
        <span>{label}</span>
        {active &&
          (direction === "ascending" ? (
            <CaretUp size={13} weight="bold" />
          ) : (
            <CaretDown size={13} weight="bold" />
          ))}
      </button>
    </span>
  );
}

function ProcessIcon({
  process,
  platform,
}: {
  process: ProcessNode;
  platform: string;
}) {
  const name = `${process.name} ${process.groupName}`.toLowerCase();
  if (process.category === "system")
    return (
      <SystemIcon
        platform={platform}
        className="process-icon icon-system"
        size={22}
      />
    );
  if (name.includes("docker") || process.groupName === "Docker Desktop")
    return (
      <Cube className="process-icon icon-docker" size={22} weight="duotone" />
    );
  if (name.includes("python"))
    return (
      <FilePy className="process-icon icon-python" size={22} weight="duotone" />
    );
  if (name.includes("postgres") || name.includes("mysql"))
    return <Database className="process-icon icon-database" size={22} />;
  if (name.includes("node") || name.includes("vite"))
    return (
      <BracketsCurly
        className="process-icon icon-node"
        size={22}
        weight="bold"
      />
    );
  return <TerminalWindow className="process-icon" size={22} weight="duotone" />;
}

function SystemIcon({
  platform,
  className,
  size,
}: {
  platform: string;
  className: string;
  size: number;
}) {
  if (platform === "windows")
    return <WindowsLogo className={className} size={size} weight="fill" />;
  if (platform === "linux")
    return <LinuxLogo className={className} size={size} weight="fill" />;
  return <AppleLogo className={className} size={size} weight="fill" />;
}

function friendlyProcessName(process: ProcessNode, t: Translator): string {
  if (process.dockerContainerId) return process.identification;
  // Le dossier d'un assistant d'agent est hérité de son lanceur et répète déjà
  // le nom du groupe. Nommer le lanceur dit ce que le dossier ne dit pas.
  if (process.ai && process.launcher && process.launcher !== process.name) {
    return t("tree.launchedBy", {
      name: process.name,
      launcher: process.launcher,
    });
  }
  if (process.identification === process.name) return process.name;
  return `${process.name} · ${process.identification}`;
}

function scopeSummary(process: ProcessNode, t: Translator): string {
  const scopes = new Set(process.records.map((record) => record.scope));
  if (scopes.size > 1) return t("common.mixed");
  return scopes.has("network") ? t("common.network") : t("common.local");
}

function activityCopy(process: ProcessNode, t: Translator): string {
  if (process.activeConnections > 0)
    return t(
      process.activeConnections === 1
        ? "common.connectionOne"
        : "common.connectionMany",
      { count: process.activeConnections }
    );
  if (process.uptimeSeconds && process.uptimeSeconds < 3600)
    return t("common.recent");
  return `${process.cpuUsage.toFixed(1)} % CPU`;
}

function TreeSkeleton() {
  const { t } = useI18n();
  return (
    <section
      className="process-tree"
      aria-label={t("tree.scanning")}
      aria-busy="true"
    >
      <div className="tree-scroll">
        <div className="tree-columns tree-header">
          <span>{t("tree.element")}</span>
          <span>{t("tree.port")}</span>
          <span>{t("tree.scope")}</span>
          <span>{t("tree.activity")}</span>
          <span>{t("tree.evaluation")}</span>
        </div>
        <div className="skeleton-list">
          {[0, 1, 2, 3, 4, 5, 6].map((item) => (
            <span key={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function platformLabel(platform: string): string {
  if (platform === "macos") return "macOS";
  if (platform === "windows") return "Windows";
  if (platform === "linux") return "Linux";
  return platform || "System";
}
