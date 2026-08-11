import { processIdentityKey } from "./processTree.ts";
import type {
  AppSettings,
  PortRecord,
  ProcessNode,
  ProtectionAction,
  ProtectionRule,
} from "../types";

export interface ProtectionControl {
  action: ProtectionAction;
  removableRules: ProtectionRule[];
  affectedProcessCount: number;
  affectedPortCount: number;
}

export function ruleMatchesRecord(rule: ProtectionRule, record: PortRecord): boolean {
  const value = rule.value.trim();
  if (!value) return false;

  if (rule.kind === "port") return Number(value) === record.port;
  if (rule.kind === "process") return equalsCaseInsensitive(value, record.processName);
  if (rule.kind === "container") {
    return Boolean(record.dockerContainerId) && equalsCaseInsensitive(value, record.identification);
  }

  return [record.processPath, record.workingDirectory]
    .filter((path): path is string => Boolean(path))
    .some((path) => path.toLocaleLowerCase().startsWith(value.toLocaleLowerCase()));
}

export function getProtectionControl(
  process: ProcessNode,
  settings: AppSettings,
  allRecords: PortRecord[],
): ProtectionControl {
  if (!process.protected) return emptyControl("add");

  const enabledRules = settings.rules.filter((rule) => rule.enabled);
  const matchingRules = enabledRules.filter((rule) =>
    process.records.some((record) => ruleMatchesRecord(rule, record))
  );
  const hasHardProtection =
    (settings.protectSystemProcesses && process.records.some((record) => record.category === "system")) ||
    process.records.some((record) => record.pid === 1) ||
    matchingRules.some((rule) => rule.builtin);

  const removableRules = matchingRules.filter((rule) => !rule.builtin);
  if (hasHardProtection || removableRules.length === 0) return emptyControl("manage");

  const affectedRecords = allRecords.filter((record) =>
    removableRules.some((rule) => ruleMatchesRecord(rule, record))
  );
  const processKeys = new Set(affectedRecords.map(processIdentityKey));
  const portKeys = new Set(affectedRecords.map((record) => [
    record.protocol,
    record.localAddress,
    record.port,
    record.pid ?? "hidden",
    record.dockerContainerId ?? "host",
  ].join("::")));

  return {
    action: "remove",
    removableRules,
    affectedProcessCount: processKeys.size,
    affectedPortCount: portKeys.size,
  };
}

function emptyControl(action: ProtectionAction): ProtectionControl {
  return { action, removableRules: [], affectedProcessCount: 0, affectedPortCount: 0 };
}

function equalsCaseInsensitive(left: string, right: string): boolean {
  return left.toLocaleLowerCase() === right.toLocaleLowerCase();
}
