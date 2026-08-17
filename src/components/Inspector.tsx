import {
  AppleLogo,
  BracketsCurly,
  CheckCircle,
  Copy,
  Cube,
  Database,
  FilePy,
  FolderOpen,
  LinuxLogo,
  LockSimple,
  Info,
  ShieldCheck,
  ShieldPlus,
  ShieldSlash,
  StackSimple,
  Stop,
  TerminalWindow,
  Warning,
  WindowsLogo,
} from "@phosphor-icons/react";
import { useState } from "react";
import {
  evaluationCopy,
  formatDuration,
  formatMemory,
  formatStartedAt,
  scopeLabel,
} from "../lib/format";
import { useI18n, type TranslationKey, type Translator } from "../lib/i18n";
import { getProcessInstances } from "../lib/processActions";
import { describeProtectionReasons } from "../lib/protectionRules";
import type {
  DuplicateConfidence,
  DuplicateEvidence,
  ProcessNode,
  ProtectionAction,
  ProtectionRule,
  StopMode,
} from "../types";

interface InspectorProps {
  process: ProcessNode | null;
  platform: string;
  rules: ProtectionRule[];
  onReveal: (path: string) => void;
  onTerminal: (path: string) => void;
  protectionAction: ProtectionAction;
  onProtectionAction: (process: ProcessNode) => void;
  onRequestStop: (process: ProcessNode, mode: StopMode) => void;
  canStop: boolean;
}

export function Inspector({
  process,
  platform,
  rules,
  onReveal,
  onTerminal,
  protectionAction,
  onProtectionAction,
  onRequestStop,
  canStop,
}: InspectorProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const { language, t } = useI18n();

  if (!process) {
    return (
      <aside className="inspector inspector-empty">
        <BracketsCurly size={34} weight="duotone" />
        <h2>{t("inspector.selectProcess")}</h2>
        <p>{t("inspector.selectDescription")}</p>
      </aside>
    );
  }

  const evaluation = evaluationCopy(process.evaluation, language, {
    count: process.duplicateAssessment.instanceCount,
  });
  const path = process.workingDirectory;
  const primary = process.records[0];
  const isDocker = Boolean(process.dockerContainerId);
  const instances = getProcessInstances(process);
  const protectedInstanceCount = instances.filter(
    (instance) => instance.protected
  ).length;
  const confirmedDuplicates =
    !isDocker &&
    process.duplicateAssessment.confidence === "confirmed" &&
    process.pids.length > 1;
  const canCleanDuplicates = protectedInstanceCount <= 1;
  const startedAt = Math.min(
    ...process.records.flatMap((record) =>
      record.startedAt ? [record.startedAt] : []
    )
  );
  // Un nœud peut regrouper plusieurs instances lancées par des hôtes distincts :
  // un seul PID de lanceur ne serait alors vrai que pour l'une d'entre elles.
  const launcherPids = [
    ...new Set(
      process.records.flatMap((record) =>
        record.launcherPid ? [record.launcherPid] : []
      )
    ),
  ];
  const protectionReasons = describeProtectionReasons(
    process.records,
    rules,
    language
  );

  const copy = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1200);
  };

  return (
    <aside
      className="inspector"
      aria-label={t("inspector.details", { name: process.identification })}
    >
      <div className="inspector-scroll">
        <div className="inspector-heading">
          <div className="inspector-app-icon">
            <InspectorIcon process={process} platform={platform} />
          </div>
          <div>
            <h2>{process.identification}</h2>
            <p>{process.name}</p>
          </div>
          {process.protected && (
            <LockSimple className="heading-lock" size={19} weight="fill" />
          )}
        </div>
        <div className={`inspector-status status-${evaluation.tone}`}>
          <i aria-hidden="true" /> {evaluation.label}
        </div>
        {process.duplicateAssessment.confidence !== "none" && (
          <DuplicateAnalysis process={process} t={t} />
        )}

        <section className="origin-section">
          <div className="section-label">{t("inspector.origin")}</div>
          <div className="origin-path">
            <FolderOpen size={20} weight="duotone" />
            <div>
              <strong>
                {process.category === "system"
                  ? t("tree.systemServices", {
                      platform: platformLabel(platform),
                    })
                  : process.groupName}
              </strong>
              <span>{path ?? t("inspector.missingFolder")}</span>
            </div>
            {path && (
              <button
                className="copy-button"
                type="button"
                onClick={() => copy(path, "path")}
                aria-label={t("inspector.copyPath")}
              >
                {copied === "path" ? (
                  <ShieldCheck size={17} />
                ) : (
                  <Copy size={17} />
                )}
              </button>
            )}
          </div>
          {process.ai && process.launcher && (
            <p className="origin-note">
              {t("inspector.inheritedFolder", { launcher: process.launcher })}
            </p>
          )}
        </section>

        <section className="detail-list" aria-label={t("inspector.metadata")}>
          {isDocker && process.dockerContainerId ? (
            <Detail
              label={t("inspector.containerId")}
              value={process.dockerContainerId.slice(0, 12)}
              mono
            />
          ) : (
            <Detail
              label="PID"
              value={
                process.pids.length
                  ? process.pids.join(", ")
                  : t("common.hiddenBySystem")
              }
              mono
            />
          )}
          {isDocker && (
            <Detail
              label={t("inspector.hostProcessPid")}
              value={
                process.pids.length
                  ? process.pids.join(", ")
                  : t("common.hiddenBySystem")
              }
              mono
            />
          )}
          <Detail
            label={t("inspector.parentPid")}
            value={primary?.parentPid?.toString() ?? t("common.unavailable")}
            mono
          />
          {process.launcher && (
            <Detail
              label={t("inspector.launcher")}
              value={
                launcherPids.length === 1
                  ? t("inspector.launcherValue", {
                      launcher: process.launcher,
                      pid: launcherPids[0],
                    })
                  : process.launcher
              }
            />
          )}
          <Detail
            label={t("inspector.startedAt")}
            value={
              Number.isFinite(startedAt)
                ? formatStartedAt(startedAt, language)
                : t("common.unavailable")
            }
          />
          <Detail
            label={t("inspector.uptime")}
            value={formatDuration(process.uptimeSeconds, language)}
          />
          <Detail
            label={t("inspector.childPorts")}
            value={`${process.records.length} (${process.records
              .map((record) => record.port)
              .join(", ")})`}
            mono
          />
          <Detail
            label={t("inspector.networkExposure")}
            value={
              process.exposed
                ? t("inspector.localNetwork")
                : t("inspector.localOnly")
            }
          />
          <Detail
            label={t("inspector.activity")}
            value={`${process.cpuUsage.toFixed(1)} % CPU · ${t(
              process.activeConnections === 1
                ? "common.connectionOne"
                : "common.connectionMany",
              { count: process.activeConnections }
            )}`}
          />
          <Detail
            label={t("inspector.memory")}
            value={formatMemory(
              process.records.reduce(
                (total, record) => total + record.memoryBytes,
                0
              ),
              language
            )}
          />
        </section>

        {process.command && (
          <section className="command-section">
            <div className="section-label">{t("inspector.command")}</div>
            <div className="command-value">
              <code>{process.command}</code>
              <button
                className="copy-button"
                type="button"
                onClick={() => copy(process.command!, "command")}
                aria-label={t("inspector.copyCommand")}
              >
                {copied === "command" ? (
                  <ShieldCheck size={17} />
                ) : (
                  <Copy size={17} />
                )}
              </button>
            </div>
          </section>
        )}

        <section className="port-list-section">
          <div className="section-label">{t("inspector.portsAddresses")}</div>
          <div className="inspector-port-list">
            {process.records.map((record) => (
              <div key={record.id}>
                <span className="mono">
                  {record.protocol} {record.port}
                </span>
                <span className="mono address-value">
                  {record.localAddress}
                </span>
                <span className={`scope-copy scope-${record.scope}`}>
                  {scopeLabel(record.scope, language)}
                </span>
              </div>
            ))}
          </div>
        </section>

        {process.protected && (
          <section className="protection-note">
            <ShieldCheck size={19} weight="duotone" />
            <div>
              <strong>{t("inspector.protectedProcess")}</strong>
              <span>
                {protectionReasons.join(" · ") ||
                  t("inspector.systemProtection")}
              </span>
            </div>
          </section>
        )}
      </div>

      <div className="inspector-actions">
        <div className="action-grid">
          <button
            type="button"
            onClick={() => path && onReveal(path)}
            disabled={!path}
          >
            <FolderOpen size={18} /> {t("inspector.openFolder")}
          </button>
          <button
            type="button"
            onClick={() => path && onTerminal(path)}
            disabled={!path}
          >
            <TerminalWindow size={18} /> {t("inspector.terminal")}
          </button>
        </div>
        <button
          className={`protect-button is-${protectionAction}`}
          type="button"
          onClick={() => onProtectionAction(process)}
        >
          {protectionAction === "add" ? (
            <ShieldPlus size={19} />
          ) : protectionAction === "remove" ? (
            <ShieldSlash size={19} />
          ) : (
            <ShieldCheck size={19} />
          )}
          {t(
            protectionAction === "add"
              ? "inspector.addProtection"
              : protectionAction === "remove"
              ? "inspector.removeProtection"
              : "inspector.manageProtection"
          )}
        </button>
        <div
          className={`stop-zone ${
            process.protected || !canStop ? "is-disabled" : ""
          }`}
        >
          <div className="stop-zone-heading">
            <Warning size={19} />
            <span>
              <strong>
                {t(
                  confirmedDuplicates
                    ? "inspector.stopDuplicatesTitle"
                    : isDocker
                    ? "inspector.stopContainerTitle"
                    : "inspector.stopTitle"
                )}
              </strong>
              <small>
                {!canStop
                  ? t("inspector.desktopRequired")
                  : confirmedDuplicates
                  ? protectedInstanceCount > 1
                    ? t("inspector.duplicateProtectionConflict")
                    : t("inspector.stopDuplicatesDescription", {
                        count: process.pids.length,
                      })
                  : t(
                      isDocker
                        ? process.records.length === 1
                          ? "inspector.stopContainerDescriptionOne"
                          : "inspector.stopContainerDescriptionMany"
                        : process.records.length === 1
                        ? "inspector.stopDescriptionOne"
                        : "inspector.stopDescriptionMany",
                      { count: process.records.length }
                    )}
              </small>
            </span>
          </div>
          <div
            className={`stop-action-buttons ${
              confirmedDuplicates ? "has-duplicates" : ""
            }`}
          >
            {confirmedDuplicates && (
              <button
                className="stop-duplicates-button"
                type="button"
                onClick={() => onRequestStop(process, "duplicates")}
                disabled={!canStop || process.protected || !canCleanDuplicates}
              >
                {process.protected || !canCleanDuplicates ? (
                  <LockSimple size={18} />
                ) : (
                  <StackSimple size={18} weight="duotone" />
                )}
                {process.protected || !canCleanDuplicates
                  ? t("inspector.stopBlocked")
                  : t("inspector.stopDuplicates", {
                      count: process.pids.length - 1,
                    })}
              </button>
            )}
            <button
              className={confirmedDuplicates ? "stop-all-button" : ""}
              type="button"
              onClick={() => onRequestStop(process, "all")}
              disabled={
                !canStop ||
                process.protected ||
                protectedInstanceCount > 0 ||
                (!isDocker && process.pids.length === 0)
              }
            >
              {process.protected || protectedInstanceCount > 0 ? (
                <LockSimple size={18} />
              ) : (
                <Stop size={18} weight="fill" />
              )}
              {confirmedDuplicates
                ? process.protected || protectedInstanceCount > 0
                  ? t("inspector.stopBlocked")
                  : t("inspector.stopAll", { count: process.pids.length })
                : !canStop
                ? t("inspector.desktopApp")
                : process.protected || protectedInstanceCount > 0
                ? t("inspector.stopBlocked")
                : isDocker
                ? t("inspector.stopContainer")
                : process.pids.length > 1
                ? t("inspector.stopProcesses", { count: process.pids.length })
                : t("inspector.stop")}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function platformLabel(platform: string): string {
  if (platform === "macos") return "macOS";
  if (platform === "windows") return "Windows";
  if (platform === "linux") return "Linux";
  return platform || "System";
}

function InspectorIcon({
  process,
  platform,
}: {
  process: ProcessNode;
  platform: string;
}) {
  const name = `${process.name} ${process.groupName}`.toLowerCase();
  if (process.category === "system" && platform === "windows")
    return <WindowsLogo className="icon-system" size={25} weight="fill" />;
  if (process.category === "system" && platform === "linux")
    return <LinuxLogo className="icon-system" size={25} weight="fill" />;
  if (process.category === "system")
    return <AppleLogo className="icon-system" size={25} weight="fill" />;
  if (name.includes("docker"))
    return <Cube className="icon-docker" size={25} weight="duotone" />;
  if (name.includes("python"))
    return <FilePy className="icon-python" size={25} weight="duotone" />;
  if (name.includes("postgres") || name.includes("mysql"))
    return <Database className="icon-database" size={25} />;
  return <BracketsCurly className="icon-node" size={25} weight="bold" />;
}

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong className={mono ? "mono" : ""}>{value}</strong>
    </div>
  );
}

const duplicateCopy: Record<
  Exclude<DuplicateConfidence, "none">,
  { badge: TranslationKey; description: TranslationKey }
> = {
  confirmed: {
    badge: "inspector.duplicateConfirmedBadge",
    description: "inspector.duplicateConfirmedDescription",
  },
  possible: {
    badge: "inspector.duplicatePossibleBadge",
    description: "inspector.duplicatePossibleDescription",
  },
  managed: {
    badge: "inspector.duplicateManagedBadge",
    description: "inspector.duplicateManagedDescription",
  },
};

const duplicateEvidenceCopy: Record<DuplicateEvidence, TranslationKey> = {
  sameExecutable: "inspector.evidenceSameExecutable",
  sameWorkingDirectory: "inspector.evidenceSameWorkingDirectory",
  sameCommand: "inspector.evidenceSameCommand",
  differentPorts: "inspector.evidenceDifferentPorts",
  independentProcesses: "inspector.evidenceIndependentProcesses",
  differentCommands: "inspector.evidenceDifferentCommands",
  missingMetadata: "inspector.evidenceMissingMetadata",
  parentChild: "inspector.evidenceParentChild",
  managedRuntime: "inspector.evidenceManagedRuntime",
  agentManaged: "inspector.evidenceAgentManaged",
  sharedListener: "inspector.evidenceSharedListener",
};

function DuplicateAnalysis({
  process,
  t,
}: {
  process: ProcessNode;
  t: Translator;
}) {
  const assessment = process.duplicateAssessment;
  if (assessment.confidence === "none") return null;
  const copy = duplicateCopy[assessment.confidence];
  const confirmed = assessment.confidence === "confirmed";

  return (
    <section
      className={`duplicate-analysis is-${assessment.confidence}`}
      aria-label={t("inspector.duplicateAnalysisTitle")}
    >
      <div className="duplicate-analysis-heading">
        <StackSimple size={19} weight="duotone" aria-hidden="true" />
        <div>
          <strong>{t("inspector.duplicateAnalysisTitle")}</strong>
          <span>
            {t(copy.description, { count: assessment.instanceCount })}
          </span>
        </div>
        <span className="duplicate-confidence">{t(copy.badge)}</span>
      </div>
      <ul>
        {assessment.evidence.map((evidence) => (
          <li key={evidence}>
            {confirmed ? (
              <CheckCircle size={14} weight="fill" />
            ) : (
              <Info size={14} weight="fill" />
            )}
            <span>{t(duplicateEvidenceCopy[evidence])}</span>
          </li>
        ))}
      </ul>
      {assessment.normalizedCommand && (
        <div className="duplicate-signature">
          <span>{t("inspector.duplicateSignature")}</span>
          <code>{assessment.normalizedCommand}</code>
        </div>
      )}
      {confirmed && (
        <p className="duplicate-safety">
          <Info size={14} weight="fill" /> {t("inspector.duplicateSafety")}
        </p>
      )}
    </section>
  );
}
