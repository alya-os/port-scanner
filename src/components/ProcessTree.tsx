import { useEffect, useMemo, useState } from "react";
import {
  AppleLogo,
  BracketsCurly,
  CaretDown,
  CaretRight,
  Cube,
  Database,
  FilePy,
  Folder,
  GlobeHemisphereWest,
  LockSimple,
  LinuxLogo,
  Network,
  TerminalWindow,
  WindowsLogo,
} from "@phosphor-icons/react";
import { ActivityBars } from "./ActivityBars";
import { evaluationCopy, formatDuration, shortAddress } from "../lib/format";
import { useI18n, type Translator } from "../lib/i18n";
import type { ProcessGroup, ProcessNode } from "../types";

interface ProcessTreeProps {
  groups: ProcessGroup[];
  selectedId: string | null;
  onSelect: (process: ProcessNode) => void;
  scanning: boolean;
  platform: string;
}

export function ProcessTree({ groups, selectedId, onSelect, scanning, platform }: ProcessTreeProps) {
  const { language, t } = useI18n();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(new Set());

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
    [groups],
  );

  const toggle = (values: Set<string>, value: string, update: (next: Set<string>) => void) => {
    const next = new Set(values);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    update(next);
  };

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
    <section className="process-tree" aria-label={t("tree.families", { count: totalVisible })}>
      <div className="tree-scroll">
        <div className="tree-columns tree-header" role="row">
          <span>{t("tree.element")}</span>
          <span>{t("tree.port")}</span>
          <span>{t("tree.scope")}</span>
          <span>{t("tree.activity")}</span>
          <span>{t("tree.evaluation")}</span>
        </div>
        {groups.map((group) => {
          const groupOpen = expandedGroups.has(group.id);
          return (
            <div className="tree-group" key={group.id}>
              <button
                className="tree-group-row"
                type="button"
                onClick={() => toggle(expandedGroups, group.id, setExpandedGroups)}
                aria-expanded={groupOpen}
              >
                {groupOpen ? <CaretDown size={15} /> : <CaretRight size={15} />}
                {group.category === "system" ? (
                  <SystemIcon platform={platform} className="group-system-icon" size={21} />
                ) : (
                  <Folder className="group-folder-icon" size={21} weight="duotone" />
                )}
                <strong>{group.category === "system" ? t("tree.systemServices", { platform: platformLabel(platform) }) : group.label}</strong>
                <span className="group-summary">
                  {t(group.processes.length === 1 ? "common.processOne" : "common.processMany", { count: group.processes.length })}
                  {group.protected && (
                    <span className="protected-summary">
                      <LockSimple size={14} weight="fill" /> {t("tree.protected")}
                    </span>
                  )}
                </span>
              </button>
              {groupOpen && (
                <div className="group-children">
                  {group.processes.map((process) => {
                    const processOpen = expandedProcesses.has(process.id);
                    const selected = selectedId === process.id;
                    const evaluation = evaluationCopy(process.evaluation, language);
                    return (
                      <div className="process-branch" key={process.id}>
                        <div className={`tree-columns process-row ${selected ? "is-selected" : ""}`}>
                          <div className="tree-name-cell">
                            <button
                              className="expand-button"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggle(expandedProcesses, process.id, setExpandedProcesses);
                              }}
                              aria-label={processOpen ? t("tree.collapsePorts") : t("tree.showPorts")}
                              aria-expanded={processOpen}
                            >
                              {processOpen ? <CaretDown size={13} /> : <CaretRight size={13} />}
                            </button>
                            <button className="process-select" type="button" onClick={() => onSelect(process)}>
                              <ProcessIcon process={process} platform={platform} />
                              <span>
                                <strong>{friendlyProcessName(process)}</strong>
                                <small>
                                  {process.dockerContainerId
                                    ? t("tree.containerShort", { id: process.dockerContainerId.slice(0, 12) })
                                    : process.pids.length > 1
                                    ? t("tree.instancesPorts", { instances: process.pids.length, ports: process.records.length })
                                    : `PID ${process.pids[0] ?? t("tree.hiddenPid")}`}
                                </small>
                              </span>
                            </button>
                          </div>
                          <span className="mono">{process.records.length === 1 ? process.records[0].port : "—"}</span>
                          <span>{scopeSummary(process, t)}</span>
                          <span className="activity-cell">
                            <ActivityBars score={process.activityScore} />
                            <small>{activityCopy(process, t)}</small>
                          </span>
                          <span className={`evaluation evaluation-${evaluation.tone}`}>
                            {process.protected && <LockSimple size={14} weight="fill" />}
                            <i aria-hidden="true" /> {evaluation.label}
                          </span>
                        </div>
                        {processOpen && (
                          <div className="port-children">
                            {process.records.map((record) => (
                              <button
                                className="tree-columns port-row"
                                key={record.id}
                                type="button"
                                onClick={() => onSelect(process)}
                              >
                                <span className="port-name-cell">
                                  <GlobeHemisphereWest size={17} />
                                  <span>{record.protocol}</span>
                                  {record.dockerContainerId
                                    ? <small>{t("tree.containerShort", { id: record.dockerContainerId.slice(0, 12) })}</small>
                                    : record.pid && <small>PID {record.pid}</small>}
                                </span>
                                <span className="mono">{record.port}</span>
                                <span title={record.localAddress}>{shortAddress(record.localAddress, language)}</span>
                                <span className="activity-cell">
                                  <ActivityBars score={Math.max(1, Math.min(5, Math.ceil(record.cpuUsage + record.activeConnections)))} />
                                  <small>{formatDuration(record.uptimeSeconds, language)}</small>
                                </span>
                                <span className={`port-scope scope-${record.scope}`}>
                                  <i aria-hidden="true" />
                                  {record.scope === "local" ? t("common.local") : t("common.exposed")}
                                </span>
                              </button>
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
    </section>
  );
}

function ProcessIcon({ process, platform }: { process: ProcessNode; platform: string }) {
  const name = `${process.name} ${process.groupName}`.toLowerCase();
  if (process.category === "system") return <SystemIcon platform={platform} className="process-icon icon-system" size={22} />;
  if (name.includes("docker") || process.groupName === "Docker Desktop") return <Cube className="process-icon icon-docker" size={22} weight="duotone" />;
  if (name.includes("python")) return <FilePy className="process-icon icon-python" size={22} weight="duotone" />;
  if (name.includes("postgres") || name.includes("mysql")) return <Database className="process-icon icon-database" size={22} />;
  if (name.includes("node") || name.includes("vite")) return <BracketsCurly className="process-icon icon-node" size={22} weight="bold" />;
  return <TerminalWindow className="process-icon" size={22} weight="duotone" />;
}

function SystemIcon({ platform, className, size }: { platform: string; className: string; size: number }) {
  if (platform === "windows") return <WindowsLogo className={className} size={size} weight="fill" />;
  if (platform === "linux") return <LinuxLogo className={className} size={size} weight="fill" />;
  return <AppleLogo className={className} size={size} weight="fill" />;
}

function friendlyProcessName(process: ProcessNode): string {
  if (process.dockerContainerId) return process.identification;
  if (process.identification === process.name) return process.name;
  return `${process.name} · ${process.identification}`;
}

function scopeSummary(process: ProcessNode, t: Translator): string {
  const scopes = new Set(process.records.map((record) => record.scope));
  if (scopes.size > 1) return t("common.mixed");
  return scopes.has("network") ? t("common.network") : t("common.local");
}

function activityCopy(process: ProcessNode, t: Translator): string {
  if (process.activeConnections > 0) return t(process.activeConnections === 1 ? "common.connectionOne" : "common.connectionMany", { count: process.activeConnections });
  if (process.uptimeSeconds && process.uptimeSeconds < 3600) return t("common.recent");
  return `${process.cpuUsage.toFixed(1)} % CPU`;
}

function TreeSkeleton() {
  const { t } = useI18n();
  return (
    <section className="process-tree" aria-label={t("tree.scanning")} aria-busy="true">
      <div className="tree-scroll">
        <div className="tree-columns tree-header">
          <span>{t("tree.element")}</span><span>{t("tree.port")}</span><span>{t("tree.scope")}</span><span>{t("tree.activity")}</span><span>{t("tree.evaluation")}</span>
        </div>
        <div className="skeleton-list">
          {[0, 1, 2, 3, 4, 5, 6].map((item) => <span key={item} />)}
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
