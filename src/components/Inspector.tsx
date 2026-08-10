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
import type { ProcessNode } from "../types";

interface InspectorProps {
  process: ProcessNode | null;
  platform: string;
  onReveal: (path: string) => void;
  onTerminal: (path: string) => void;
  onProtect: (process: ProcessNode) => void;
  onRequestStop: (process: ProcessNode) => void;
}

export function Inspector({ process, platform, onReveal, onTerminal, onProtect, onRequestStop }: InspectorProps) {
  const [copied, setCopied] = useState<string | null>(null);

  if (!process) {
    return (
      <aside className="inspector inspector-empty">
        <BracketsCurly size={34} weight="duotone" />
        <h2>Sélectionnez un processus</h2>
        <p>Son dossier, sa commande et ses ports apparaîtront ici.</p>
      </aside>
    );
  }

  const evaluation = evaluationCopy[process.evaluation];
  const path = process.workingDirectory;
  const primary = process.records[0];
  const startedAt = Math.min(...process.records.flatMap((record) => (record.startedAt ? [record.startedAt] : [])));
  const protectionReasons = [...new Set(process.records.flatMap((record) => record.protectionReasons))];

  const copy = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1200);
  };

  return (
    <aside className="inspector" aria-label={`Détails de ${process.identification}`}>
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
          <div className="section-label">Origine du processus</div>
          <div className="origin-path">
            <FolderOpen size={20} weight="duotone" />
            <div>
              <strong>{process.groupName}</strong>
              <span>{path ?? "Dossier de travail indisponible"}</span>
            </div>
            {path && (
              <button className="copy-button" type="button" onClick={() => copy(path, "path")} aria-label="Copier le chemin">
                {copied === "path" ? <ShieldCheck size={17} /> : <Copy size={17} />}
              </button>
            )}
          </div>
        </section>

        <section className="detail-list" aria-label="Métadonnées du processus">
          <Detail label="PID" value={process.pids.length ? process.pids.join(", ") : "Masqué par le système"} mono />
          <Detail label="PID parent" value={primary?.parentPid?.toString() ?? "Indisponible"} mono />
          <Detail label="Démarré le" value={Number.isFinite(startedAt) ? formatStartedAt(startedAt) : "Indisponible"} />
          <Detail label="Durée d’exécution" value={formatDuration(process.uptimeSeconds)} />
          <Detail label="Ports enfants" value={`${process.records.length} (${process.records.map((record) => record.port).join(", ")})`} mono />
          <Detail label="Exposition réseau" value={process.exposed ? "Réseau local" : "Locale uniquement"} />
          <Detail label="Activité" value={`${process.cpuUsage.toFixed(1)} % CPU · ${process.activeConnections} connexion(s)`} />
          <Detail label="Mémoire" value={formatMemory(process.records.reduce((total, record) => total + record.memoryBytes, 0))} />
        </section>

        {process.command && (
          <section className="command-section">
            <div className="section-label">Commande</div>
            <div className="command-value">
              <code>{process.command}</code>
              <button className="copy-button" type="button" onClick={() => copy(process.command!, "command")} aria-label="Copier la commande">
                {copied === "command" ? <ShieldCheck size={17} /> : <Copy size={17} />}
              </button>
            </div>
          </section>
        )}

        <section className="port-list-section">
          <div className="section-label">Ports et adresses</div>
          <div className="inspector-port-list">
            {process.records.map((record) => (
              <div key={record.id}>
                <span className="mono">{record.protocol} {record.port}</span>
                <span className="mono address-value">{record.localAddress}</span>
                <span className={`scope-copy scope-${record.scope}`}>{scopeLabel(record.scope)}</span>
              </div>
            ))}
          </div>
        </section>

        {process.protected && (
          <section className="protection-note">
            <ShieldCheck size={19} weight="duotone" />
            <div>
              <strong>Processus protégé</strong>
              <span>{protectionReasons.join(" · ") || "Protection système active"}</span>
            </div>
          </section>
        )}
      </div>

      <div className="inspector-actions">
        <div className="action-grid">
          <button type="button" onClick={() => path && onReveal(path)} disabled={!path}>
            <FolderOpen size={18} /> Ouvrir le dossier
          </button>
          <button type="button" onClick={() => path && onTerminal(path)} disabled={!path}>
            <TerminalWindow size={18} /> Terminal
          </button>
        </div>
        <button className="protect-button" type="button" onClick={() => onProtect(process)} disabled={process.category === "system"}>
          {process.protected ? <ShieldCheck size={19} /> : <ShieldPlus size={19} />}
          {process.protected ? "Déjà protégé" : "Ajouter aux protections"}
        </button>
        <div className={`stop-zone ${process.protected ? "is-disabled" : ""}`}>
          <div>
            <Warning size={19} />
            <span>
              <strong>Arrêt du processus</strong>
              <small>Fermera {process.records.length} port(s) et les connexions associées.</small>
            </span>
          </div>
          <button type="button" onClick={() => onRequestStop(process)} disabled={process.protected || process.pids.length === 0}>
            {process.protected ? <LockSimple size={18} /> : <Stop size={18} weight="fill" />}
            {process.protected ? "Arrêt bloqué" : process.pids.length > 1 ? `Arrêter ${process.pids.length} processus` : "Arrêter"}
          </button>
        </div>
      </div>
    </aside>
  );
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
