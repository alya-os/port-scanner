import { LockSimple, ShieldSlash, X } from "@phosphor-icons/react";
import { localizeRuleLabel, useI18n } from "../lib/i18n";
import { useDialogFocus } from "../lib/useDialogFocus";
import type { ProcessNode, ProtectionRule } from "../types";

interface ProtectionDialogProps {
  process: ProcessNode | null;
  rules: ProtectionRule[];
  affectedProcessCount: number;
  affectedPortCount: number;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ProtectionDialog({
  process,
  rules,
  affectedProcessCount,
  affectedPortCount,
  saving,
  onCancel,
  onConfirm,
}: ProtectionDialogProps) {
  const { language, t } = useI18n();
  const dialogRef = useDialogFocus<HTMLElement>(Boolean(process));

  if (!process) return null;

  const shared = affectedProcessCount > 1;
  const processScope = t(affectedProcessCount === 1 ? "common.processOne" : "common.processMany", { count: affectedProcessCount });
  const portScope = t(affectedPortCount === 1 ? "common.portOne" : "common.portMany", { count: affectedPortCount });
  const ruleLabels = rules.map((rule) => localizeRuleLabel(rule, language)).join(" · ");

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && onCancel()}>
      <section
        ref={dialogRef}
        className="protection-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="protection-title"
        aria-describedby="protection-description"
        tabIndex={-1}
      >
        <button className="dialog-close" type="button" onClick={onCancel} disabled={saving} aria-label={t("protection.close")}>
          <X size={20} />
        </button>
        <div className="protection-dialog-icon"><ShieldSlash size={26} weight="duotone" /></div>
        <h2 id="protection-title">{t("protection.removeTitle", { name: process.identification })}</h2>
        <p id="protection-description">
          {t(shared ? "protection.removeDescriptionMany" : "protection.removeDescriptionOne", {
            processes: processScope,
            ports: portScope,
          })}
        </p>

        <div className="protection-summary">
          <span><strong>{t("protection.selected")}</strong><code>{process.identification}</code></span>
          <span><strong>{t("protection.rules")}</strong><code>{ruleLabels}</code></span>
          <span><strong>{t("protection.scope")}</strong><code>{processScope} · {portScope}</code></span>
        </div>

        <div className="protection-safety"><LockSimple size={17} /> {t("protection.safety")}</div>
        <footer>
          <button className="secondary-button" type="button" onClick={onCancel} disabled={saving} data-initial-focus>
            {t("protection.cancel")}
          </button>
          <button className="protection-remove-button" type="button" onClick={onConfirm} disabled={saving}>
            <ShieldSlash size={18} weight="duotone" /> {saving ? t("protection.removing") : t("protection.confirm")}
          </button>
        </footer>
      </section>
    </div>
  );
}
