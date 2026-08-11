import { localeFor, translate } from "./i18n.ts";
import type { Evaluation, Language, NavFilter, PortRecord, ProcessGroup, ProcessNode, SortDirection, SortMode } from "../types";

export function buildProcessTree(
  records: PortRecord[],
  filter: NavFilter,
  query: string,
  sort: SortMode,
  language: Language = "fr",
  direction: SortDirection = defaultSortDirection(sort),
): ProcessGroup[] {
  const locale = localeFor(language);
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const visibleRecords = records.filter((record) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "protected" ? record.protected : record.category === filter);
    if (!matchesFilter) return false;
    if (!normalizedQuery) return true;

    return [
      record.port,
      record.pid,
      record.processName,
      record.identification,
      record.groupName,
      record.workingDirectory,
      record.processPath,
      record.command,
      record.localAddress,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase(locale).includes(normalizedQuery));
  });

  const processMap = new Map<string, PortRecord[]>();
  for (const record of visibleRecords) {
    const key = processIdentityKey(record);
    const values = processMap.get(key) ?? [];
    values.push(record);
    processMap.set(key, values);
  }

  const groupMap = new Map<string, ProcessNode[]>();
  for (const [id, processRecords] of processMap) {
    const process = toProcessNode(id, processRecords, language, sort, direction);
    const groupId = `${process.category}::${process.groupName}`;
    const processes = groupMap.get(groupId) ?? [];
    processes.push(process);
    groupMap.set(groupId, processes);
  }

  const groups = [...groupMap.entries()].map(([id, processes]) => ({
    id,
    label: processes[0]?.groupName ?? translate(language, "tree.noFolder"),
    category: processes[0]?.category ?? "other",
    processes: sortProcesses(processes, sort, direction, locale),
    protected: processes.every((process) => process.protected),
  }));

  return groups.sort((left, right) => {
    if (left.category === "system" && right.category !== "system") return 1;
    if (right.category === "system" && left.category !== "system") return -1;
    return left.label.localeCompare(right.label, locale, { sensitivity: "base" });
  });
}

export function processIdentityKey(record: PortRecord): string {
  return [
    record.category,
    record.groupName,
    record.processName,
    record.identification,
    record.dockerContainerId ?? "<conteneur-inconnu>",
    record.processPath ?? "<executable-inconnu>",
    record.workingDirectory ?? "<dossier-inconnu>",
  ].join("::");
}

function toProcessNode(
  id: string,
  records: PortRecord[],
  language: Language,
  sort: SortMode,
  direction: SortDirection,
): ProcessNode {
  const pids = [...new Set(records.flatMap((record) => (record.pid ? [record.pid] : [])))];
  const duplicate = pids.length > 1;
  const protectedProcess = records.every((record) => record.protected);
  const exposed = records.some((record) => record.scope === "network") && !protectedProcess;
  const cpuUsage = records.reduce((total, record) => total + record.cpuUsage, 0);
  const activeConnections = records.reduce((total, record) => total + record.activeConnections, 0);
  const uptimeSeconds = maximum(records.map((record) => record.uptimeSeconds));

  return {
    id,
    name: records[0]?.processName ?? translate(language, "tree.unknownProcess"),
    identification: records[0]?.identification ?? translate(language, "tree.unknown"),
    groupName: records[0]?.groupName ?? translate(language, "tree.noFolder"),
    category: records[0]?.category ?? "other",
    records: sortRecords(records, sort, direction),
    pids,
    workingDirectory: firstValue(records.map((record) => record.workingDirectory)),
    processPath: firstValue(records.map((record) => record.processPath)),
    command: firstValue(records.map((record) => record.command)),
    dockerContainerId: firstValue(records.map((record) => record.dockerContainerId)),
    evaluation: evaluate(records, duplicate, protectedProcess, exposed),
    protected: protectedProcess,
    duplicate,
    exposed,
    activityScore: Math.min(5, Math.ceil(cpuUsage / 2 + activeConnections + (uptimeSeconds && uptimeSeconds < 1800 ? 2 : 0))),
    cpuUsage,
    activeConnections,
    uptimeSeconds,
  };
}

function evaluate(
  records: PortRecord[],
  duplicate: boolean,
  protectedProcess: boolean,
  exposed: boolean,
): Evaluation {
  if (protectedProcess) return "protected";
  if (duplicate) return "duplicate";
  if (exposed) return "exposed";
  const uptime = maximum(records.map((record) => record.uptimeSeconds));
  if (uptime && uptime > 7 * 86_400) return "review";
  if (uptime && uptime < 1800) return "active";
  return "ok";
}

export function defaultSortDirection(sort: SortMode): SortDirection {
  return sort === "name" || sort === "port" ? "ascending" : "descending";
}

function sortProcesses(
  processes: ProcessNode[],
  sort: SortMode,
  direction: SortDirection,
  locale: string,
): ProcessNode[] {
  const priorities: Record<Evaluation, number> = {
    exposed: 5,
    duplicate: 4,
    review: 3,
    active: 2,
    ok: 1,
    protected: 0,
  };

  return [...processes].sort((left, right) => {
    const comparison = sort === "name"
      ? left.identification.localeCompare(right.identification, locale, { sensitivity: "base" })
      : sort === "port"
        ? minimumPort(left) - minimumPort(right)
        : sort === "scope"
          ? scopeRank(left) - scopeRank(right)
          : sort === "activity"
            ? compareActivity(left, right)
            : priorities[left.evaluation] - priorities[right.evaluation];

    return applyDirection(comparison, direction)
      || left.identification.localeCompare(right.identification, locale, { sensitivity: "base" });
  });
}

function sortRecords(records: PortRecord[], sort: SortMode, direction: SortDirection): PortRecord[] {
  return [...records].sort((left, right) => {
    const comparison = sort === "scope"
      ? Number(left.scope === "network") - Number(right.scope === "network")
      : sort === "activity"
        ? recordActivity(left) - recordActivity(right)
        : sort === "evaluation"
          ? recordEvaluationRank(left) - recordEvaluationRank(right)
          : left.port - right.port;
    return applyDirection(comparison, direction) || left.port - right.port;
  });
}

function minimumPort(process: ProcessNode): number {
  return Math.min(...process.records.map((record) => record.port));
}

function scopeRank(process: ProcessNode): number {
  const scopes = new Set(process.records.map((record) => record.scope));
  if (scopes.size > 1) return 1;
  return scopes.has("network") ? 2 : 0;
}

function compareActivity(left: ProcessNode, right: ProcessNode): number {
  return left.activityScore - right.activityScore
    || left.activeConnections - right.activeConnections
    || left.cpuUsage - right.cpuUsage;
}

function recordActivity(record: PortRecord): number {
  return record.cpuUsage + record.activeConnections;
}

function recordEvaluationRank(record: PortRecord): number {
  if (record.protected) return 0;
  return record.scope === "network" ? 2 : 1;
}

function applyDirection(comparison: number, direction: SortDirection): number {
  return direction === "ascending" ? comparison : -comparison;
}

function firstValue<T>(values: Array<T | null>): T | null {
  return values.find((value): value is T => value !== null) ?? null;
}

function maximum(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length ? Math.max(...present) : null;
}
