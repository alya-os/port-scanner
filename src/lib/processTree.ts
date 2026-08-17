import { localeFor, translate } from "./i18n.ts";
import type {
  DuplicateAssessment,
  DuplicateEvidence,
  Evaluation,
  Language,
  NavFilter,
  PortRecord,
  ProcessGroup,
  ProcessNode,
  SortDirection,
  SortMode,
} from "../types";

export function buildProcessTree(
  records: PortRecord[],
  filter: NavFilter,
  query: string,
  sort: SortMode,
  language: Language = "en",
  direction: SortDirection = defaultSortDirection(sort)
): ProcessGroup[] {
  const locale = localeFor(language);
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const visibleRecords = records.filter((record) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "protected"
        ? record.protected
        : filter === "ai"
        ? record.ai
        : record.category === filter);
    if (!matchesFilter) return false;
    if (!normalizedQuery) return true;

    return [
      record.port,
      record.pid,
      record.processName,
      record.identification,
      record.groupName,
      record.launcher,
      record.workingDirectory,
      record.processPath,
      record.command,
      record.localAddress,
    ]
      .filter(Boolean)
      .some((value) =>
        String(value).toLocaleLowerCase(locale).includes(normalizedQuery)
      );
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
    const process = toProcessNode(
      id,
      processRecords,
      language,
      sort,
      direction
    );
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
    const comparison = left.label.localeCompare(right.label, locale, {
      sensitivity: "base",
    });
    return sort === "name" ? applyDirection(comparison, direction) : comparison;
  });
}

export function hideProtectedProcesses(groups: ProcessGroup[]): ProcessGroup[] {
  return groups.flatMap((group) => {
    const processes = group.processes.filter((process) => !process.protected);
    if (processes.length === 0) return [];
    return [{ ...group, processes, protected: false }];
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

export function assessDuplicateProcesses(
  records: PortRecord[]
): DuplicateAssessment {
  const recordsByPid = new Map<number, PortRecord[]>();
  for (const record of records) {
    if (!record.pid) continue;
    const profileRecords = recordsByPid.get(record.pid) ?? [];
    profileRecords.push(record);
    recordsByPid.set(record.pid, profileRecords);
  }

  const profiles = [...recordsByPid.entries()].map(([pid, profileRecords]) => ({
    pid,
    parentPid: firstValue(profileRecords.map((record) => record.parentPid)),
    launcherPid: firstValue(profileRecords.map((record) => record.launcherPid)),
    ai: profileRecords.some((record) => record.ai),
    processPath: firstValue(profileRecords.map((record) => record.processPath)),
    workingDirectory: firstValue(
      profileRecords.map((record) => record.workingDirectory)
    ),
    command: firstValue(profileRecords.map((record) => record.command)),
    ports: [...new Set(profileRecords.map((record) => record.port))],
  }));

  if (profiles.length <= 1) return emptyDuplicateAssessment(profiles.length);

  const pids = new Set(profiles.map((profile) => profile.pid));
  const parentChild = profiles.some(
    (profile) => profile.parentPid !== null && pids.has(profile.parentPid)
  );
  const managedRuntime =
    profiles.some((profile) => isManagedRuntime(profile.command)) ||
    records.some((record) => Boolean(record.dockerContainerId));
  const sharedListener = hasSharedListener(records);
  // Un assistant lancé par un agent existe à un exemplaire par session hôte.
  // Deux serveurs MCP identiques rattachés à deux hôtes distincts ne sont donc
  // pas des doublons à nettoyer, mais des instances gérées par leur lanceur.
  const agentManaged =
    profiles.every((profile) => profile.ai && profile.launcherPid !== null) &&
    new Set(profiles.map((profile) => profile.launcherPid)).size ===
      profiles.length;
  const sameExecutable = hasOneCompleteValue(
    profiles.map((profile) => profile.processPath)
  );
  const sameWorkingDirectory = hasOneCompleteValue(
    profiles.map((profile) => profile.workingDirectory)
  );
  const normalizedCommands = profiles.map((profile) =>
    normalizeDuplicateCommand(profile.command, profile.ports)
  );
  const sameCommand = hasOneCompleteValue(normalizedCommands);
  const differentPorts =
    new Set(profiles.flatMap((profile) => profile.ports)).size > 1;
  const independentProcesses =
    !parentChild && !managedRuntime && !sharedListener && !agentManaged;

  const evidence: DuplicateEvidence[] = [];
  if (sameExecutable) evidence.push("sameExecutable");
  if (sameWorkingDirectory) evidence.push("sameWorkingDirectory");
  if (sameCommand) evidence.push("sameCommand");
  if (differentPorts) evidence.push("differentPorts");
  if (independentProcesses) evidence.push("independentProcesses");

  if (parentChild || managedRuntime || sharedListener || agentManaged) {
    if (parentChild) evidence.push("parentChild");
    if (managedRuntime) evidence.push("managedRuntime");
    if (agentManaged) evidence.push("agentManaged");
    if (sharedListener) evidence.push("sharedListener");
    return {
      confidence: "managed",
      instanceCount: profiles.length,
      evidence,
      normalizedCommand: null,
    };
  }

  if (
    sameExecutable &&
    sameWorkingDirectory &&
    sameCommand &&
    differentPorts &&
    independentProcesses
  ) {
    return {
      confidence: "confirmed",
      instanceCount: profiles.length,
      evidence,
      normalizedCommand: normalizedCommands[0],
    };
  }

  if (
    normalizedCommands.some((command) => command === null) ||
    !sameExecutable ||
    !sameWorkingDirectory
  ) {
    evidence.push("missingMetadata");
  } else if (!sameCommand) {
    evidence.push("differentCommands");
  }

  return {
    confidence: "possible",
    instanceCount: profiles.length,
    evidence,
    normalizedCommand: null,
  };
}

export function normalizeDuplicateCommand(
  command: string | null,
  ports: number[]
): string | null {
  if (!command?.trim()) return null;
  let signature = command
    .trim()
    .replace(/(^|\s)(--port|-p)(?:=|\s+)\d{1,5}(?=\s|$)/gi, "$1$2=<port>")
    .replace(/\b(PORT|HTTP_PORT|SERVER_PORT)=\d{1,5}\b/gi, "$1=<port>");

  for (const port of ports) {
    signature = signature.replace(new RegExp(`:${port}\\b`, "g"), ":<port>");
  }

  return signature.replace(/\s+/g, " ");
}

function toProcessNode(
  id: string,
  records: PortRecord[],
  language: Language,
  sort: SortMode,
  direction: SortDirection
): ProcessNode {
  const pids = [
    ...new Set(records.flatMap((record) => (record.pid ? [record.pid] : []))),
  ];
  const duplicateAssessment = assessDuplicateProcesses(records);
  const duplicate =
    duplicateAssessment.confidence === "confirmed" ||
    duplicateAssessment.confidence === "possible";
  const protectedProcess = records.every((record) => record.protected);
  const exposed =
    records.some((record) => record.scope === "network") && !protectedProcess;
  const cpuUsage = records.reduce(
    (total, record) => total + record.cpuUsage,
    0
  );
  const activeConnections = records.reduce(
    (total, record) => total + record.activeConnections,
    0
  );
  const uptimeSeconds = maximum(records.map((record) => record.uptimeSeconds));

  return {
    id,
    name: records[0]?.processName ?? translate(language, "tree.unknownProcess"),
    identification:
      records[0]?.identification ?? translate(language, "tree.unknown"),
    groupName: records[0]?.groupName ?? translate(language, "tree.noFolder"),
    category: records[0]?.category ?? "other",
    records: sortRecords(records, sort, direction),
    pids,
    workingDirectory: firstValue(
      records.map((record) => record.workingDirectory)
    ),
    processPath: firstValue(records.map((record) => record.processPath)),
    command: firstValue(records.map((record) => record.command)),
    launcher: firstValue(records.map((record) => record.launcher)),
    launcherPid: firstValue(records.map((record) => record.launcherPid)),
    ai: records.some((record) => record.ai),
    dockerContainerId: firstValue(
      records.map((record) => record.dockerContainerId)
    ),
    evaluation: evaluate(
      records,
      duplicateAssessment,
      protectedProcess,
      exposed
    ),
    protected: protectedProcess,
    duplicate,
    duplicateAssessment,
    exposed,
    activityScore: Math.min(
      5,
      Math.ceil(
        cpuUsage / 2 +
          activeConnections +
          (uptimeSeconds && uptimeSeconds < 1800 ? 2 : 0)
      )
    ),
    cpuUsage,
    activeConnections,
    uptimeSeconds,
  };
}

function evaluate(
  records: PortRecord[],
  duplicateAssessment: DuplicateAssessment,
  protectedProcess: boolean,
  exposed: boolean
): Evaluation {
  if (protectedProcess) return "protected";
  if (duplicateAssessment.confidence === "confirmed")
    return "duplicateConfirmed";
  if (exposed) return "exposed";
  if (duplicateAssessment.confidence === "possible") return "duplicatePossible";
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
  locale: string
): ProcessNode[] {
  const priorities: Record<Evaluation, number> = {
    duplicateConfirmed: 6,
    exposed: 5,
    duplicatePossible: 4,
    review: 3,
    active: 2,
    ok: 1,
    protected: 0,
  };

  return [...processes].sort((left, right) => {
    const comparison =
      sort === "name"
        ? left.identification.localeCompare(right.identification, locale, {
            sensitivity: "base",
          })
        : sort === "port"
        ? minimumPort(left) - minimumPort(right)
        : sort === "scope"
        ? scopeRank(left) - scopeRank(right)
        : sort === "activity"
        ? compareActivity(left, right)
        : priorities[left.evaluation] - priorities[right.evaluation];

    return (
      applyDirection(comparison, direction) ||
      left.identification.localeCompare(right.identification, locale, {
        sensitivity: "base",
      })
    );
  });
}

function sortRecords(
  records: PortRecord[],
  sort: SortMode,
  direction: SortDirection
): PortRecord[] {
  return [...records].sort((left, right) => {
    const comparison =
      sort === "scope"
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
  return (
    left.activityScore - right.activityScore ||
    left.activeConnections - right.activeConnections ||
    left.cpuUsage - right.cpuUsage
  );
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

function emptyDuplicateAssessment(instanceCount: number): DuplicateAssessment {
  return {
    confidence: "none",
    instanceCount,
    evidence: [],
    normalizedCommand: null,
  };
}

function hasOneCompleteValue(values: Array<string | null>): boolean {
  return values.every((value) => Boolean(value)) && new Set(values).size === 1;
}

function isManagedRuntime(command: string | null): boolean {
  if (!command) return false;
  return (
    /\b(pm2-runtime|supervisord|circusd)\b/i.test(command) ||
    /(^|\s)--workers(?:=|\s+)[2-9]\d*(?=\s|$)/i.test(command)
  );
}

function hasSharedListener(records: PortRecord[]): boolean {
  const ownersByListener = new Map<string, Set<number>>();
  for (const record of records) {
    if (!record.pid) continue;
    const listener = `${record.protocol}:${record.localAddress}:${record.port}`;
    const owners = ownersByListener.get(listener) ?? new Set<number>();
    owners.add(record.pid);
    ownersByListener.set(listener, owners);
  }
  return [...ownersByListener.values()].some((owners) => owners.size > 1);
}
