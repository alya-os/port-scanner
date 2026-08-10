import { Flask, LockSimple, Network, Warning } from "@phosphor-icons/react";
import { formatScannedAt } from "../lib/format";

interface StatusBarProps {
  scannedAt: number | null;
  processCount: number;
  portCount: number;
  protectedCount: number;
  permissionLimited: boolean;
  scanning: boolean;
  demoMode: boolean;
}

export function StatusBar({ scannedAt, processCount, portCount, protectedCount, permissionLimited, scanning, demoMode }: StatusBarProps) {
  return (
    <footer className="status-bar" aria-live="polite">
      <span className={scanning ? "status-scanning" : "status-ready"}>
        <i aria-hidden="true" /> {scanning ? "Analyse en cours" : "Analyse terminée"}
      </span>
      <span>{formatScannedAt(scannedAt)}</span>
      {demoMode && <span className="demo-status" title="L’aperçu web utilise un jeu de données fictif. L’application installée analyse la machine."><Flask size={16} /> Données de démonstration</span>}
      <span className="status-spacer" />
      <span><Network size={16} /> {processCount} processus</span>
      <span>{portCount} ports</span>
      <span className="status-spacer" />
      {permissionLimited && <span className="permission-warning" title="Certains propriétaires de sockets sont masqués par le système"><Warning size={16} /> Accès partiel</span>}
      <span className="protected-status"><LockSimple size={16} weight="fill" /> {protectedCount} ports protégés</span>
    </footer>
  );
}
