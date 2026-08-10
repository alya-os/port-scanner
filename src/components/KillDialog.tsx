import { LockSimple, Stop, Warning, X } from "@phosphor-icons/react";
import { useI18n } from "../lib/i18n";
import { useDialogFocus } from "../lib/useDialogFocus";
import type { ProcessNode } from "../types";

interface KillDialogProps {
  process: ProcessNode | null;
  stopping: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function KillDialog({ process, stopping, onCancel, onConfirm }: KillDialogProps) {
  const { t } = useI18n();
  const dialogRef = useDialogFocus<HTMLElement>(Boolean(process));
  if (!process) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !stopping && onCancel()}>
      <section ref={dialogRef} className="kill-dialog" role="alertdialog" aria-modal="true" aria-labelledby="kill-title" aria-describedby="kill-description" tabIndex={-1}>
        <button className="dialog-close" type="button" onClick={onCancel} disabled={stopping} aria-label={t("kill.close")}><X size={20} /></button>
        <div className="kill-icon"><Warning size={26} weight="duotone" /></div>
        <h2 id="kill-title">{t("kill.title", { name: process.identification })}</h2>
        <p id="kill-description">
          {t("kill.description", {
            processes: process.pids.length,
            processLabel: t(process.pids.length === 1 ? "unit.process" : "unit.processes"),
            ports: process.records.length,
            portLabel: t(process.records.length === 1 ? "unit.port" : "unit.ports"),
          })}
        </p>
        <div className="kill-summary">
          <span><strong>PID</strong><code>{process.pids.join(", ")}</code></span>
          <span><strong>Ports</strong><code>{process.records.map((record) => record.port).join(", ")}</code></span>
          <span><strong>{t("kill.folder")}</strong><code>{process.workingDirectory ?? t("common.unavailable")}</code></span>
        </div>
        <div className="kill-safety"><LockSimple size={17} /> {t("kill.safety")}</div>
        <footer>
          <button className="secondary-button" type="button" onClick={onCancel} disabled={stopping} data-initial-focus>{t("kill.cancel")}</button>
          <button className="danger-button" type="button" onClick={onConfirm} disabled={stopping}>
            <Stop size={18} weight="fill" /> {stopping ? t("kill.stopping") : t("kill.confirm")}
          </button>
        </footer>
      </section>
    </div>
  );
}
