import { localizeRuleLabel, translate } from "./i18n.ts";
import { processIdentityKey } from "./processTree.ts";
import type {
  AppSettings,
  Language,
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

// Les règles ne sont évaluées qu'une fois, dans le moteur Rust. L'interface lit
// les motifs qu'il attache à chaque port : réimplémenter la correspondance ici
// reviendrait à afficher un cadenas que le backend n'honorerait pas forcément.
export function matchedRuleIds(records: PortRecord[]): Set<string> {
  return new Set(
    records.flatMap((record) =>
      record.protectionReasons.flatMap((reason) =>
        reason.kind === "rule" && reason.ruleId ? [reason.ruleId] : []
      )
    )
  );
}

// La traduction des motifs vit ici, du côté qui connaît la langue. Le moteur ne
// renvoie que des identifiants, il ne sait pas dans quelle langue on l'affiche.
export function describeProtectionReasons(
  records: PortRecord[],
  rules: ProtectionRule[],
  language: Language
): string[] {
  const described = records.flatMap((record) =>
    record.protectionReasons.map((reason) => {
      if (reason.kind === "systemDefault")
        return translate(language, "protection.systemDefault");
      if (reason.kind === "systemMain")
        return translate(language, "protection.systemMain");
      const rule = rules.find((candidate) => candidate.id === reason.ruleId);
      return rule
        ? localizeRuleLabel(rule, language)
        : translate(language, "protection.unknownRule");
    })
  );

  return [...new Set(described)];
}

export function getProtectionControl(
  process: ProcessNode,
  settings: AppSettings,
  allRecords: PortRecord[]
): ProtectionControl {
  if (!process.protected) return emptyControl("add");

  const ruleIds = matchedRuleIds(process.records);
  const matchingRules = settings.rules.filter((rule) => ruleIds.has(rule.id));
  const hasHardProtection =
    process.records.some((record) =>
      record.protectionReasons.some((reason) => reason.kind !== "rule")
    ) || matchingRules.some((rule) => rule.builtin);

  const removableRules = matchingRules.filter((rule) => !rule.builtin);
  if (hasHardProtection || removableRules.length === 0)
    return emptyControl("manage");

  const removableIds = new Set(removableRules.map((rule) => rule.id));
  const affectedRecords = allRecords.filter((record) =>
    record.protectionReasons.some(
      (reason) => reason.ruleId !== null && removableIds.has(reason.ruleId)
    )
  );
  const processKeys = new Set(affectedRecords.map(processIdentityKey));
  const portKeys = new Set(
    affectedRecords.map((record) =>
      [
        record.protocol,
        record.localAddress,
        record.port,
        record.pid ?? "hidden",
        record.dockerContainerId ?? "host",
      ].join("::")
    )
  );

  return {
    action: "remove",
    removableRules,
    affectedProcessCount: processKeys.size,
    affectedPortCount: portKeys.size,
  };
}

function emptyControl(action: ProtectionAction): ProtectionControl {
  return {
    action,
    removableRules: [],
    affectedProcessCount: 0,
    affectedPortCount: 0,
  };
}
