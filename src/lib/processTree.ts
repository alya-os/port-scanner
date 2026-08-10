import type { Evaluation, NavFilter, PortRecord, ProcessGroup, ProcessNode, SortMode } from "../types";

export function buildProcessTree(
  records: PortRecord[],
  filter: NavFilter,
  query: string,
  sort: SortMode,
): ProcessGroup[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
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
      .some((value) => String(value).toLocaleLowerCase("fr").includes(normalizedQuery));
  });

  const processMap = new Map<string, PortRecord[]>();
  for (const record of visibleRecords) {
    const key = [record.category, record.groupName, record.processName, record.identification].join("::");
    const values = processMap.get(key) ?? [];
    values.push(record);
    processMap.set(key, values);
  }

  const groupMap = new Map<string, ProcessNode[]>();
  for (const [id, processRecords] of processMap) {
    const process = toProcessNode(id, processRecords);
    const groupId = `${process.category}::${process.groupName}`;
    const processes = groupMap.get(groupId) ?? [];
    processes.push(process);
    groupMap.set(groupId, processes);
  }

  const groups = [...groupMap.entries()].map(([id, processes]) => ({
    id,
    label: processes[0]?.groupName ?? "Sans dossier",
    category: processes[0]?.category ?? "other",
    processes: sortProcesses(processes, sort),
    protected: processes.every((process) => process.protected),
  }));

  return groups.sort((left, right) => {
    if (left.category === "system" && right.category !== "system") return 1;
    if (right.category === "system" && left.category !== "system") return -1;
    return left.label.localeCompare(right.label, "fr", { sensitivity: "base" });
  });
}

function toProcessNode(id: string, records: PortRecord[]): ProcessNode {
  const pids = [...new Set(records.flatMap((record) => (record.pid ? [record.pid] : [])))];
  const duplicate = pids.length > 1;
  const protectedProcess = records.every((record) => record.protected);
  const exposed = records.some((record) => record.scope === "network") && !protectedProcess;
  const cpuUsage = records.reduce((total, record) => total + record.cpuUsage, 0);
  const activeConnections = records.reduce((total, record) => total + record.activeConnections, 0);
  const uptimeSeconds = maximum(records.map((record) => record.uptimeSeconds));

  return {
    id,
    name: records[0]?.processName ?? "Processus inconnu",
    identification: records[0]?.identification ?? "Inconnu",
    groupName: records[0]?.groupName ?? "Sans dossier",
    category: records[0]?.category ?? "other",
    records: [...records].sort((left, right) => left.port - right.port),
    pids,
    workingDirectory: firstValue(records.map((record) => record.workingDirectory)),
    processPath: firstValue(records.map((record) => record.processPath)),
    command: firstValue(records.map((record) => record.command)),
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

function sortProcesses(processes: ProcessNode[], sort: SortMode): ProcessNode[] {
  const priorities: Record<Evaluation, number> = {
    exposed: 0,
    duplicate: 1,
    review: 2,
    active: 3,
    ok: 4,
    protected: 5,
  };

  return [...processes].sort((left, right) => {
    if (sort === "port") return (left.records[0]?.port ?? 0) - (right.records[0]?.port ?? 0);
    if (sort === "activity") return right.activityScore - left.activityScore;
    if (sort === "age") return (right.uptimeSeconds ?? 0) - (left.uptimeSeconds ?? 0);
    return priorities[left.evaluation] - priorities[right.evaluation];
  });
}

function firstValue<T>(values: Array<T | null>): T | null {
  return values.find((value): value is T => value !== null) ?? null;
}

function maximum(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length ? Math.max(...present) : null;
}
