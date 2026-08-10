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
  Network,
  TerminalWindow,
} from "@phosphor-icons/react";
import { ActivityBars } from "./ActivityBars";
import { evaluationCopy, formatDuration, shortAddress } from "../lib/format";
import type { ProcessGroup, ProcessNode } from "../types";

interface ProcessTreeProps {
  groups: ProcessGroup[];
  selectedId: string | null;
  onSelect: (process: ProcessNode) => void;
  scanning: boolean;
}

export function ProcessTree({ groups, selectedId, onSelect, scanning }: ProcessTreeProps) {
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
        <h2>Aucune connexion ne correspond</h2>
        <p>Modifiez les filtres ou relancez l’analyse pour actualiser les processus.</p>
      </section>
    );
  }

  return (
    <section className="process-tree" aria-label={`${totalVisible} familles de processus`}>
      <div className="tree-columns tree-header" role="row">
        <span>Élément</span>
        <span>Port</span>
        <span>Portée</span>
        <span>Activité</span>
        <span>Évaluation</span>
      </div>
      <div className="tree-scroll">
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
                  <AppleLogo className="group-system-icon" size={21} weight="fill" />
                ) : (
                  <Folder className="group-folder-icon" size={21} weight="duotone" />
                )}
                <strong>{group.label}</strong>
                <span className="group-summary">
                  {group.processes.length} processus
                  {group.protected && (
                    <span className="protected-summary">
                      <LockSimple size={14} weight="fill" /> Protégé
                    </span>
                  )}
                </span>
              </button>
              {groupOpen && (
                <div className="group-children">
                  {group.processes.map((process) => {
                    const processOpen = expandedProcesses.has(process.id);
                    const selected = selectedId === process.id;
                    const evaluation = evaluationCopy[process.evaluation];
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
                              aria-label={processOpen ? "Replier les ports" : "Afficher les ports"}
                              aria-expanded={processOpen}
                            >
                              {processOpen ? <CaretDown size={13} /> : <CaretRight size={13} />}
                            </button>
                            <button className="process-select" type="button" onClick={() => onSelect(process)}>
                              <ProcessIcon process={process} />
                              <span>
                                <strong>{friendlyProcessName(process)}</strong>
                                <small>
                                  {process.pids.length > 1
                                    ? `${process.pids.length} instances · ${process.records.length} ports`
                                    : `PID ${process.pids[0] ?? "masqué"}`}
                                </small>
                              </span>
                            </button>
                          </div>
                          <span className="mono">{process.records.length === 1 ? process.records[0].port : "—"}</span>
                          <span>{scopeSummary(process)}</span>
                          <span className="activity-cell">
                            <ActivityBars score={process.activityScore} />
                            <small>{activityCopy(process)}</small>
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
                                  {record.pid && <small>PID {record.pid}</small>}
                                </span>
                                <span className="mono">{record.port}</span>
                                <span title={record.localAddress}>{shortAddress(record.localAddress)}</span>
                                <span className="activity-cell">
                                  <ActivityBars score={Math.max(1, Math.min(5, Math.ceil(record.cpuUsage + record.activeConnections)))} />
                                  <small>{formatDuration(record.uptimeSeconds)}</small>
                                </span>
                                <span className={`port-scope scope-${record.scope}`}>
                                  <i aria-hidden="true" />
                                  {record.scope === "local" ? "Local" : "Exposé"}
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

function ProcessIcon({ process }: { process: ProcessNode }) {
  const name = `${process.name} ${process.groupName}`.toLowerCase();
  if (process.category === "system") return <AppleLogo className="process-icon icon-system" size={22} weight="fill" />;
  if (name.includes("docker") || process.groupName === "Docker Desktop") return <Cube className="process-icon icon-docker" size={22} weight="duotone" />;
  if (name.includes("python")) return <FilePy className="process-icon icon-python" size={22} weight="duotone" />;
  if (name.includes("postgres") || name.includes("mysql")) return <Database className="process-icon icon-database" size={22} />;
  if (name.includes("node") || name.includes("vite")) return <BracketsCurly className="process-icon icon-node" size={22} weight="bold" />;
  return <TerminalWindow className="process-icon" size={22} weight="duotone" />;
}

function friendlyProcessName(process: ProcessNode): string {
  if (process.identification === process.name) return process.name;
  return `${process.name} · ${process.identification}`;
}

function scopeSummary(process: ProcessNode): string {
  const scopes = new Set(process.records.map((record) => record.scope));
  if (scopes.size > 1) return "Mixte";
  return scopes.has("network") ? "Réseau" : "Local";
}

function activityCopy(process: ProcessNode): string {
  if (process.activeConnections > 0) return `${process.activeConnections} connexion${process.activeConnections > 1 ? "s" : ""}`;
  if (process.uptimeSeconds && process.uptimeSeconds < 3600) return "Récent";
  return `${process.cpuUsage.toFixed(1)} % CPU`;
}

function TreeSkeleton() {
  return (
    <section className="process-tree" aria-label="Analyse en cours" aria-busy="true">
      <div className="tree-columns tree-header">
        <span>Élément</span><span>Port</span><span>Portée</span><span>Activité</span><span>Évaluation</span>
      </div>
      <div className="skeleton-list">
        {[0, 1, 2, 3, 4, 5, 6].map((item) => <span key={item} />)}
      </div>
    </section>
  );
}
