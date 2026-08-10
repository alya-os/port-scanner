import { LockSimple, Stop, Warning, X } from "@phosphor-icons/react";
import { useDialogFocus } from "../lib/useDialogFocus";
import type { ProcessNode } from "../types";

interface KillDialogProps {
  process: ProcessNode | null;
  stopping: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function KillDialog({ process, stopping, onCancel, onConfirm }: KillDialogProps) {
  const dialogRef = useDialogFocus<HTMLElement>(Boolean(process));
  if (!process) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !stopping && onCancel()}>
      <section ref={dialogRef} className="kill-dialog" role="alertdialog" aria-modal="true" aria-labelledby="kill-title" aria-describedby="kill-description" tabIndex={-1}>
        <button className="dialog-close" type="button" onClick={onCancel} disabled={stopping} aria-label="Fermer"><X size={20} /></button>
        <div className="kill-icon"><Warning size={26} weight="duotone" /></div>
        <h2 id="kill-title">Arrêter {process.identification} ?</h2>
        <p id="kill-description">
          Cette action demandera l’arrêt de {process.pids.length} processus et fermera {process.records.length} port(s). Les connexions actives seront interrompues.
        </p>
        <div className="kill-summary">
          <span><strong>PID</strong><code>{process.pids.join(", ")}</code></span>
          <span><strong>Ports</strong><code>{process.records.map((record) => record.port).join(", ")}</code></span>
          <span><strong>Dossier</strong><code>{process.workingDirectory ?? "Indisponible"}</code></span>
        </div>
        <div className="kill-safety"><LockSimple size={17} /> Les protections seront revérifiées par le moteur avant chaque arrêt.</div>
        <footer>
          <button className="secondary-button" type="button" onClick={onCancel} disabled={stopping} data-initial-focus>Annuler</button>
          <button className="danger-button" type="button" onClick={onConfirm} disabled={stopping}>
            <Stop size={18} weight="fill" /> {stopping ? "Arrêt en cours…" : "Arrêter les processus"}
          </button>
        </footer>
      </section>
    </div>
  );
}
