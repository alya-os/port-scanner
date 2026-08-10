import { Flask, LockSimple, Network, Warning } from "@phosphor-icons/react";
import { formatScannedAt } from "../lib/format";
import { useI18n } from "../lib/i18n";

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
  const { language, t } = useI18n();
  return (
    <footer className="status-bar" aria-live="polite">
      <span className={scanning ? "status-scanning" : "status-ready"}>
        <i aria-hidden="true" /> {scanning ? t("status.scanning") : t("status.complete")}
      </span>
      <span>{formatScannedAt(scannedAt, language)}</span>
      {demoMode && <span className="demo-status" title={t("status.demoTitle")}><Flask size={16} /> {t("status.demo")}</span>}
      <span className="status-spacer" />
      <span><Network size={16} /> {t(processCount === 1 ? "common.processOne" : "common.processMany", { count: processCount })}</span>
      <span>{t(portCount === 1 ? "common.portOne" : "common.portMany", { count: portCount })}</span>
      <span className="status-spacer" />
      {permissionLimited && <span className="permission-warning" title={t("status.partialTitle")}><Warning size={16} /> {t("status.partial")}</span>}
      <span className="protected-status"><LockSimple size={16} weight="fill" /> {t(protectedCount === 1 ? "status.protectedPort" : "status.protectedPorts", { count: protectedCount })}</span>
    </footer>
  );
}
