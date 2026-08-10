import { FloppyDisk, LockSimple, Plus, ShieldCheck, Trash, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { createTranslator, localizeRuleLabel, type Translator } from "../lib/i18n";
import { useDialogFocus } from "../lib/useDialogFocus";
import type { AppSettings, Language, ProtectionRule, ThemeMode } from "../types";

interface SettingsDialogProps {
  open: boolean;
  settings: AppSettings;
  onClose: () => void;
  onSave: (settings: AppSettings) => Promise<void>;
}

export function SettingsDialog({ open, settings, onClose, onSave }: SettingsDialogProps) {
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [newKind, setNewKind] = useState<ProtectionRule["kind"]>("process");
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const dialogRef = useDialogFocus<HTMLElement>(open);
  const t = createTranslator(draft.language);

  useEffect(() => setDraft(settings), [settings, open]);
  if (!open) return null;

  const addRule = () => {
    const value = newValue.trim();
    if (!value) return;
    setDraft((current) => ({
      ...current,
      rules: [
        ...current.rules,
        {
          id: `custom-${Date.now()}`,
          label: newLabel.trim() || value,
          kind: newKind,
          value,
          enabled: true,
          builtin: false,
        },
      ],
    }));
    setNewValue("");
    setNewLabel("");
  };

  const commit = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabIndex={-1}>
        <header className="dialog-header">
          <div>
            <h2 id="settings-title">{t("settings.title")}</h2>
            <p>{t("settings.description")}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={t("settings.close")} data-initial-focus><X size={20} /></button>
        </header>

        <div className="settings-content">
          <section className="settings-section">
            <div className="settings-section-title">
              <div><strong>{t("settings.appearanceTitle")}</strong><span>{t("settings.appearanceDescription")}</span></div>
            </div>
            <div className="theme-picker" role="radiogroup" aria-label={t("settings.themeAria")}>
              {(["dark", "light", "system"] as ThemeMode[]).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  className={draft.theme === theme ? "is-selected" : ""}
                  onClick={() => setDraft((current) => ({ ...current, theme }))}
                  role="radio"
                  aria-checked={draft.theme === theme}
                >
                  {theme === "dark" ? t("settings.themeDark") : theme === "light" ? t("settings.themeLight") : t("settings.themeSystem")}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-title">
              <div><strong>{t("settings.languageTitle")}</strong><span>{t("settings.languageDescription")}</span></div>
            </div>
            <div className="language-picker" role="radiogroup" aria-label={t("settings.languageAria")}>
              {(["fr", "en"] as Language[]).map((language) => (
                <button
                  key={language}
                  type="button"
                  className={draft.language === language ? "is-selected" : ""}
                  onClick={() => setDraft((current) => ({ ...current, language }))}
                  role="radio"
                  aria-checked={draft.language === language}
                  lang={language}
                >
                  {language === "fr" ? t("settings.languageFrench") : t("settings.languageEnglish")}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-title protection-toggle-row">
              <ShieldCheck size={23} weight="duotone" />
              <div>
                <strong>{t("settings.autoProtectTitle")}</strong>
                <span>{t("settings.autoProtectDescription")}</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  aria-label={t("settings.autoProtectTitle")}
                  checked={draft.protectSystemProcesses}
                  onChange={(event) => setDraft((current) => ({ ...current, protectSystemProcesses: event.target.checked }))}
                />
                <span />
              </label>
            </div>
          </section>

          <section className="settings-section rules-section">
            <div className="settings-section-title">
              <div><strong>{t("settings.rulesTitle")}</strong><span>{t("settings.rulesDescription")}</span></div>
              <span className="rule-count"><LockSimple size={14} /> {t(draft.rules.filter((rule) => rule.enabled).length === 1 ? "settings.activeRule" : "settings.activeRules", { count: draft.rules.filter((rule) => rule.enabled).length })}</span>
            </div>
            <div className="rules-list">
              {draft.rules.map((rule) => {
                const ruleLabel = localizeRuleLabel(rule, draft.language);
                return <div className="rule-row" key={rule.id}>
                  <label className="rule-enabled">
                    <input
                      type="checkbox"
                      aria-label={t(rule.enabled ? "settings.disableRule" : "settings.enableRule", { label: ruleLabel })}
                      checked={rule.enabled}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          rules: current.rules.map((candidate) =>
                            candidate.id === rule.id ? { ...candidate, enabled: event.target.checked } : candidate,
                          ),
                        }))
                      }
                    />
                    <span />
                  </label>
                  <span className="rule-kind">{ruleKindLabel(rule.kind, t)}</span>
                  <div><strong>{ruleLabel}</strong><code>{rule.value}</code></div>
                  {rule.builtin ? (
                    <span className="builtin-label">{t("settings.builtin")}</span>
                  ) : (
                    <button
                      className="delete-rule"
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, rules: current.rules.filter((candidate) => candidate.id !== rule.id) }))}
                      aria-label={t("settings.deleteRule", { label: ruleLabel })}
                    >
                      <Trash size={17} />
                    </button>
                  )}
                </div>;
              })}
            </div>
            <div className="add-rule-form">
              <select value={newKind} onChange={(event) => setNewKind(event.target.value as ProtectionRule["kind"])} aria-label={t("settings.ruleType")}>
                <option value="process">{t("settings.kindProcess")}</option>
                <option value="port">{t("settings.kindPort")}</option>
                <option value="path">{t("settings.kindPath")}</option>
              </select>
              <input value={newValue} onChange={(event) => setNewValue(event.target.value)} placeholder={newKind === "port" ? "ex. 3000" : newKind === "path" ? "ex. /System/Library/" : "ex. launchd"} aria-label={t("settings.ruleValue")} />
              <input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder={t("settings.optionalLabel")} aria-label={t("settings.ruleLabel")} />
              <button type="button" onClick={addRule} disabled={!newValue.trim()}><Plus size={17} /> {t("settings.add")}</button>
            </div>
          </section>
        </div>

        <footer className="dialog-footer">
          <button className="secondary-button" type="button" onClick={onClose}>{t("settings.cancel")}</button>
          <button className="primary-button" type="button" onClick={commit} disabled={saving}>
            <FloppyDisk size={18} /> {saving ? t("settings.saving") : t("settings.save")}
          </button>
        </footer>
      </section>
    </div>
  );
}

function ruleKindLabel(kind: ProtectionRule["kind"], t: Translator): string {
  if (kind === "port") return t("settings.kindPort");
  if (kind === "path") return t("settings.kindPath");
  return t("settings.kindProcess");
}
