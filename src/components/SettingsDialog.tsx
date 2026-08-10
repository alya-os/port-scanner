import { FloppyDisk, LockSimple, Plus, ShieldCheck, Trash, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useDialogFocus } from "../lib/useDialogFocus";
import type { AppSettings, ProtectionRule, ThemeMode } from "../types";

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
            <h2 id="settings-title">Réglages</h2>
            <p>Personnalisez l’apparence et les barrières de sécurité.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fermer les réglages" data-initial-focus><X size={20} /></button>
        </header>

        <div className="settings-content">
          <section className="settings-section">
            <div className="settings-section-title">
              <div><strong>Apparence</strong><span>Le thème sombre reste le mode par défaut.</span></div>
            </div>
            <div className="theme-picker" role="radiogroup" aria-label="Thème">
              {(["dark", "light", "system"] as ThemeMode[]).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  className={draft.theme === theme ? "is-selected" : ""}
                  onClick={() => setDraft((current) => ({ ...current, theme }))}
                  role="radio"
                  aria-checked={draft.theme === theme}
                >
                  {theme === "dark" ? "Sombre" : theme === "light" ? "Clair" : "Système"}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-title protection-toggle-row">
              <ShieldCheck size={23} weight="duotone" />
              <div>
                <strong>Protéger automatiquement les services système</strong>
                <span>Empêche l’arrêt des processus reconnus comme appartenant au système.</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  aria-label="Protéger automatiquement les services système"
                  checked={draft.protectSystemProcesses}
                  onChange={(event) => setDraft((current) => ({ ...current, protectSystemProcesses: event.target.checked }))}
                />
                <span />
              </label>
            </div>
          </section>

          <section className="settings-section rules-section">
            <div className="settings-section-title">
              <div><strong>Règles de protection</strong><span>Un chemin peut viser le dossier de travail ou l’exécutable d’un projet.</span></div>
              <span className="rule-count"><LockSimple size={14} /> {draft.rules.filter((rule) => rule.enabled).length} actives</span>
            </div>
            <div className="rules-list">
              {draft.rules.map((rule) => (
                <div className="rule-row" key={rule.id}>
                  <label className="rule-enabled">
                    <input
                      type="checkbox"
                      aria-label={`${rule.enabled ? "Désactiver" : "Activer"} la règle ${rule.label}`}
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
                  <span className="rule-kind">{rule.kind === "port" ? "Port" : rule.kind === "path" ? "Chemin" : "Processus"}</span>
                  <div><strong>{rule.label}</strong><code>{rule.value}</code></div>
                  {rule.builtin ? (
                    <span className="builtin-label">Par défaut</span>
                  ) : (
                    <button
                      className="delete-rule"
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, rules: current.rules.filter((candidate) => candidate.id !== rule.id) }))}
                      aria-label={`Supprimer ${rule.label}`}
                    >
                      <Trash size={17} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="add-rule-form">
              <select value={newKind} onChange={(event) => setNewKind(event.target.value as ProtectionRule["kind"])} aria-label="Type de règle">
                <option value="process">Processus</option>
                <option value="port">Port</option>
                <option value="path">Chemin</option>
              </select>
              <input value={newValue} onChange={(event) => setNewValue(event.target.value)} placeholder={newKind === "port" ? "ex. 3000" : newKind === "path" ? "ex. /System/Library/" : "ex. launchd"} aria-label="Valeur de la règle" />
              <input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="Libellé facultatif" aria-label="Libellé de la règle" />
              <button type="button" onClick={addRule} disabled={!newValue.trim()}><Plus size={17} /> Ajouter</button>
            </div>
          </section>
        </div>

        <footer className="dialog-footer">
          <button className="secondary-button" type="button" onClick={onClose}>Annuler</button>
          <button className="primary-button" type="button" onClick={commit} disabled={saving}>
            <FloppyDisk size={18} /> {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </footer>
      </section>
    </div>
  );
}
