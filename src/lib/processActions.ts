import type { PortRecord, ProcessNode } from "../types";

export interface ProcessInstance {
  pid: number;
  records: PortRecord[];
  ports: number[];
  startedAt: number | null;
  protected: boolean;
}

export function getProcessInstances(process: ProcessNode): ProcessInstance[] {
  return process.pids.map((pid) => {
    const records = process.records.filter((record) => record.pid === pid);
    const startTimes = records.flatMap((record) => record.startedAt === null ? [] : [record.startedAt]);

    return {
      pid,
      records,
      ports: [...new Set(records.map((record) => record.port))].sort((left, right) => left - right),
      startedAt: startTimes.length ? Math.min(...startTimes) : null,
      protected: records.some((record) => record.protected),
    };
  });
}

export function getSuggestedKeepPid(process: ProcessNode): number | null {
  const instances = getProcessInstances(process);
  if (!instances.length) return null;

  return [...instances].sort((left, right) => {
    if (left.protected !== right.protected) return left.protected ? -1 : 1;
    return (right.startedAt ?? Number.NEGATIVE_INFINITY) - (left.startedAt ?? Number.NEGATIVE_INFINITY)
      || right.pid - left.pid;
  })[0]?.pid ?? null;
}
