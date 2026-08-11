import { LockSimple, ShieldCheck, Stop, Warning, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { formatStartedAt } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { getProcessInstances, getSuggestedKeepPid } from "../lib/processActions";
import { useDialogFocus } from "../lib/useDialogFocus";
import type { ProcessNode, StopMode } from "../types";

interface KillDialogProps {
  process: ProcessNode | null;
  mode: StopMode;
  stopping: boolean;
  onCancel: () => void;
  onConfirm: (keepPid: number | null) => void;
}

export function KillDialog({ process, mode, stopping, onCancel, onConfirm }: KillDialogProps) {
  const { language, t } = useI18n();
  const dialogRef = useDialogFocus<HTMLElement>(Boolean(process));
  const suggestedKeepPid = process ? getSuggestedKeepPid(process) : null;
  const [keepPid, setKeepPid] = useState<number | null>(suggestedKeepPid);

  useEffect(() => {
    setKeepPid(suggestedKeepPid);
  }, [mode, process?.id, process?.pids.join(","), suggestedKeepPid]);

  if (!process) return null;
  const isDocker = Boolean(process.dockerContainerId);
  const instances = getProcessInstances(process);
  const protectedInstanceCount = instances.filter((instance) => instance.protected).length;
  const newestStartedAt = Math.max(...instances.flatMap((instance) => instance.startedAt === null ? [] : [instance.startedAt]));
  const pidsToStop = mode === "duplicates" ? process.pids.filter((pid) => pid !== keepPid) : process.pids;
  const recordsToStop = process.records.filter((record) => record.pid !== null && pidsToStop.includes(record.pid));
  const keptInstance = mode === "duplicates" ? instances.find((instance) => instance.pid === keepPid) ?? null : null;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !stopping && onCancel()}>
      <section ref={dialogRef} className={`kill-dialog ${mode === "duplicates" ? "has-instance-picker" : ""}`} role="alertdialog" aria-modal="true" aria-labelledby="kill-title" aria-describedby="kill-description" tabIndex={-1}>
        <button className="dialog-close" type="button" onClick={onCancel} disabled={stopping} aria-label={t("kill.close")}><X size={20} /></button>
        <div className="kill-icon"><Warning size={26} weight="duotone" /></div>
        <h2 id="kill-title">
          {t(mode === "duplicates" ? "kill.duplicatesTitle" : "kill.title", {
            name: process.identification,
            count: pidsToStop.length,
          })}
        </h2>
        <p id="kill-description">
          {mode === "duplicates"
            ? t("kill.duplicatesDescription", { name: process.identification, count: pidsToStop.length })
            : isDocker
            ? t("kill.containerDescription", {
              name: process.identification,
              ports: process.records.length,
              portLabel: t(process.records.length === 1 ? "unit.port" : "unit.ports"),
            })
            : t("kill.description", {
              processes: process.pids.length,
              processLabel: t(process.pids.length === 1 ? "unit.process" : "unit.processes"),
              ports: process.records.length,
              portLabel: t(process.records.length === 1 ? "unit.port" : "unit.ports"),
            })}
        </p>
        {mode === "duplicates" && (
          <fieldset className="keep-instance-picker" disabled={stopping}>
            <legend>{t("kill.keepInstance")}</legend>
            <p>{t(protectedInstanceCount === 1 ? "kill.keepProtectedDescription" : "kill.keepInstanceDescription")}</p>
            <div className="keep-instance-list">
              {instances.map((instance) => {
                const canSelect = protectedInstanceCount === 0 || instance.protected;
                const isNewest = instance.startedAt !== null && instance.startedAt === newestStartedAt;
                return (
                  <label key={instance.pid} className={`${keepPid === instance.pid ? "is-selected" : ""} ${!canSelect ? "is-disabled" : ""}`}>
                    <input
                      type="radio"
                      name="keep-process-instance"
                      value={instance.pid}
                      checked={keepPid === instance.pid}
                      onChange={() => setKeepPid(instance.pid)}
                      disabled={!canSelect || stopping}
                    />
                    <span className="instance-radio" aria-hidden="true" />
                    <span className="instance-copy">
                      <strong>{t(instance.ports.length === 1 ? "kill.instancePortOne" : "kill.instancePortMany", { ports: instance.ports.join(", ") })}</strong>
                      <small>PID {instance.pid}{instance.startedAt !== null ? ` · ${t("kill.instanceStarted", { date: formatStartedAt(instance.startedAt, language) })}` : ""}</small>
                    </span>
                    <span className="instance-badges">
                      {isNewest && <em>{t("kill.newest")}</em>}
                      {instance.protected && <em className="is-protected"><ShieldCheck size={12} weight="fill" /> {t("kill.protected")}</em>}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        <div className="kill-summary">
          {isDocker ? (
            <>
              <span><strong>{t("kill.container")}</strong><code>{process.identification}</code></span>
              <span><strong>{t("kill.containerId")}</strong><code>{process.dockerContainerId?.slice(0, 12)}</code></span>
            </>
          ) : (
            <span><strong>{t(mode === "duplicates" ? "kill.willStop" : "kill.processes")}</strong><code>PID {pidsToStop.join(", ")}</code></span>
          )}
          <span><strong>Ports</strong><code>{(mode === "duplicates" ? recordsToStop : process.records).map((record) => record.port).join(", ")}</code></span>
          {keptInstance && (
            <span><strong>{t("kill.remainsOpen")}</strong><code>PID {keptInstance.pid} · {t(keptInstance.ports.length === 1 ? "kill.instancePortOne" : "kill.instancePortMany", { ports: keptInstance.ports.join(", ") })}</code></span>
          )}
          {!isDocker && <span><strong>{t("kill.folder")}</strong><code>{process.workingDirectory ?? t("common.unavailable")}</code></span>}
        </div>
        <div className="kill-safety"><LockSimple size={17} /> {t("kill.safety")}</div>
        <footer>
          <button className="secondary-button" type="button" onClick={onCancel} disabled={stopping} data-initial-focus>{t("kill.cancel")}</button>
          <button className="danger-button" type="button" onClick={() => onConfirm(mode === "duplicates" ? keepPid : null)} disabled={stopping || (mode === "duplicates" && keepPid === null)}>
            <Stop size={18} weight="fill" /> {stopping
              ? t("kill.stopping")
              : t(
                mode === "duplicates"
                  ? "kill.confirmDuplicates"
                  : isDocker
                    ? "kill.confirmContainer"
                    : process.pids.length === 1
                      ? "kill.confirmProcess"
                      : "kill.confirmAllProcesses",
                { count: pidsToStop.length },
              )}
          </button>
        </footer>
      </section>
    </div>
  );
}
