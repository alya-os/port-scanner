import {
  AppleLogo,
  BracketsCurly,
  Copy,
  Cube,
  Database,
  FilePy,
  FolderOpen,
  LinuxLogo,
  LockSimple,
  ShieldCheck,
  ShieldPlus,
  Stop,
  TerminalWindow,
  Warning,
  WindowsLogo,
} from "@phosphor-icons/react";
import { useState } from "react";
import { evaluationCopy, formatDuration, formatMemory, formatStartedAt, scopeLabel } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { ProcessNode } from "../types";

interface InspectorProps {
  process: ProcessNode | null;
  platform: string;
  onReveal: (path: string) => void;
  onTerminal: (path: string) => void;
  onProtect: (process: ProcessNode) => void;
  onRequestStop: (process: ProcessNode) => void;
  canStop: boolean;
}

export function Inspector({ process, platform, onReveal, onTerminal, onProtect, onRequestStop, canStop }: InspectorProps) {
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

  const evaluation = evaluationCopy(process.evaluation, language);
  const path = process.workingDirectory;
  const primary = process.records[0];
  const isDocker = Boolean(process.dockerContainerId);
  const startedAt = Math.min(...process.records.flatMap((record) => (record.startedAt ? [record.startedAt] : [])));
  const protectionReasons = [...new Set(process.records.flatMap((record) => record.protectionReasons))];

  const copy = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1200);
  };

  return (
    <aside className="inspector" aria-label={t("inspector.details", { name: process.identification })}>
      <div className="inspector-scroll">
        <div className="inspector-heading">
          <div className="inspector-app-icon"><InspectorIcon process={process} platform={platform} /></div>
          <div>
            <h2>{process.identification}</h2>
            <p>{process.name}</p>
          </div>
          {process.protected && <LockSimple className="heading-lock" size={19} weight="fill" />}
        </div>
        <div className={`inspector-status status-${evaluation.tone}`}>
          <i aria-hidden="true" /> {evaluation.label}
        </div>

        <section className="origin-section">
          <div className="section-label">{t("inspector.origin")}</div>
          <div className="origin-path">
            <FolderOpen size={20} weight="duotone" />
            <div>
              <strong>{process.category === "system" ? t("tree.systemServices", { platform: platformLabel(platform) }) : process.groupName}</strong>
              <span>{path ?? t("inspector.missingFolder")}</span>
            </div>
            {path && (
              <button className="copy-button" type="button" onClick={() => copy(path, "path")} aria-label={t("inspector.copyPath")}>
                {copied === "path" ? <ShieldCheck size={17} /> : <Copy size={17} />}
              </button>
            )}
          </div>
        </section>

        <section className="detail-list" aria-label={t("inspector.metadata")}>
          {isDocker && process.dockerContainerId ? (
            <Detail label={t("inspector.containerId")} value={process.dockerContainerId.slice(0, 12)} mono />
          ) : (
            <Detail label="PID" value={process.pids.length ? process.pids.join(", ") : t("common.hiddenBySystem")} mono />
          )}
          {isDocker && <Detail label={t("inspector.hostProcessPid")} value={process.pids.length ? process.pids.join(", ") : t("common.hiddenBySystem")} mono />}
          <Detail label={t("inspector.parentPid")} value={primary?.parentPid?.toString() ?? t("common.unavailable")} mono />
          <Detail label={t("inspector.startedAt")} value={Number.isFinite(startedAt) ? formatStartedAt(startedAt, language) : t("common.unavailable")} />
          <Detail label={t("inspector.uptime")} value={formatDuration(process.uptimeSeconds, language)} />
          <Detail label={t("inspector.childPorts")} value={`${process.records.length} (${process.records.map((record) => record.port).join(", ")})`} mono />
          <Detail label={t("inspector.networkExposure")} value={process.exposed ? t("inspector.localNetwork") : t("inspector.localOnly")} />
          <Detail label={t("inspector.activity")} value={`${process.cpuUsage.toFixed(1)} % CPU · ${t(process.activeConnections === 1 ? "common.connectionOne" : "common.connectionMany", { count: process.activeConnections })}`} />
          <Detail label={t("inspector.memory")} value={formatMemory(process.records.reduce((total, record) => total + record.memoryBytes, 0), language)} />
        </section>

        {process.command && (
          <section className="command-section">
            <div className="section-label">{t("inspector.command")}</div>
            <div className="command-value">
              <code>{process.command}</code>
              <button className="copy-button" type="button" onClick={() => copy(process.command!, "command")} aria-label={t("inspector.copyCommand")}>
                {copied === "command" ? <ShieldCheck size={17} /> : <Copy size={17} />}
              </button>
            </div>
          </section>
        )}

        <section className="port-list-section">
          <div className="section-label">{t("inspector.portsAddresses")}</div>
          <div className="inspector-port-list">
            {process.records.map((record) => (
              <div key={record.id}>
                <span className="mono">{record.protocol} {record.port}</span>
                <span className="mono address-value">{record.localAddress}</span>
                <span className={`scope-copy scope-${record.scope}`}>{scopeLabel(record.scope, language)}</span>
              </div>
            ))}
          </div>
        </section>

        {process.protected && (
          <section className="protection-note">
            <ShieldCheck size={19} weight="duotone" />
            <div>
              <strong>{t("inspector.protectedProcess")}</strong>
              <span>{protectionReasons.join(" · ") || t("inspector.systemProtection")}</span>
            </div>
          </section>
        )}
      </div>

      <div className="inspector-actions">
        <div className="action-grid">
          <button type="button" onClick={() => path && onReveal(path)} disabled={!path}>
            <FolderOpen size={18} /> {t("inspector.openFolder")}
          </button>
          <button type="button" onClick={() => path && onTerminal(path)} disabled={!path}>
            <TerminalWindow size={18} /> {t("inspector.terminal")}
          </button>
        </div>
        <button className="protect-button" type="button" onClick={() => onProtect(process)} disabled={process.category === "system"}>
          {process.protected ? <ShieldCheck size={19} /> : <ShieldPlus size={19} />}
          {process.protected ? t("inspector.alreadyProtected") : t("inspector.addProtection")}
        </button>
        <div className={`stop-zone ${process.protected || !canStop ? "is-disabled" : ""}`}>
          <div>
            <Warning size={19} />
            <span>
              <strong>{t(isDocker ? "inspector.stopContainerTitle" : "inspector.stopTitle")}</strong>
              <small>
                {!canStop
                  ? t("inspector.desktopRequired")
                  : t(
                    isDocker
                      ? process.records.length === 1 ? "inspector.stopContainerDescriptionOne" : "inspector.stopContainerDescriptionMany"
                      : process.records.length === 1 ? "inspector.stopDescriptionOne" : "inspector.stopDescriptionMany",
                    { count: process.records.length },
                  )}
              </small>
            </span>
          </div>
          <button type="button" onClick={() => onRequestStop(process)} disabled={!canStop || process.protected || (!isDocker && process.pids.length === 0)}>
            {process.protected ? <LockSimple size={18} /> : <Stop size={18} weight="fill" />}
            {!canStop
              ? t("inspector.desktopApp")
              : process.protected
                ? t("inspector.stopBlocked")
                : isDocker
                  ? t("inspector.stopContainer")
                  : process.pids.length > 1 ? t("inspector.stopProcesses", { count: process.pids.length }) : t("inspector.stop")}
          </button>
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

function InspectorIcon({ process, platform }: { process: ProcessNode; platform: string }) {
  const name = `${process.name} ${process.groupName}`.toLowerCase();
  if (process.category === "system" && platform === "windows") return <WindowsLogo className="icon-system" size={25} weight="fill" />;
  if (process.category === "system" && platform === "linux") return <LinuxLogo className="icon-system" size={25} weight="fill" />;
  if (process.category === "system") return <AppleLogo className="icon-system" size={25} weight="fill" />;
  if (name.includes("docker")) return <Cube className="icon-docker" size={25} weight="duotone" />;
  if (name.includes("python")) return <FilePy className="icon-python" size={25} weight="duotone" />;
  if (name.includes("postgres") || name.includes("mysql")) return <Database className="icon-database" size={25} />;
  return <BracketsCurly className="icon-node" size={25} weight="bold" />;
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong className={mono ? "mono" : ""}>{value}</strong>
    </div>
  );
}
