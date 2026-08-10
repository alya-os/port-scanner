import type { Evaluation, Scope } from "../types";

export const evaluationCopy: Record<Evaluation, { label: string; tone: string }> = {
  protected: { label: "Protégé", tone: "protected" },
  duplicate: { label: "Doublons possibles", tone: "warning" },
  exposed: { label: "Exposé au réseau", tone: "danger" },
  review: { label: "À vérifier", tone: "warning" },
  active: { label: "Actif maintenant", tone: "success" },
  ok: { label: "OK", tone: "success" },
};

export function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds === null) return "Indisponible";
  if (totalSeconds < 60) return `${totalSeconds} s`;
  if (totalSeconds < 3600) return `${Math.floor(totalSeconds / 60)} min`;
  if (totalSeconds < 86_400) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours} h ${minutes} min`;
  }
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  return `${days} j ${hours} h`;
}

export function formatStartedAt(seconds: number | null): string {
  if (!seconds) return "Indisponible";
  return new Intl.DateTimeFormat("fr-CA", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(seconds * 1000));
}

export function formatScannedAt(seconds: number | null): string {
  if (!seconds) return "Jamais";
  return new Intl.DateTimeFormat("fr-CA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(seconds * 1000));
}

export function formatMemory(bytes: number): string {
  if (!bytes) return "Indisponible";
  const megabytes = bytes / 1_000_000;
  return megabytes >= 1000 ? `${(megabytes / 1000).toFixed(1)} Go` : `${Math.round(megabytes)} Mo`;
}

export function scopeLabel(scope: Scope): string {
  return scope === "local" ? "Local uniquement" : "Réseau local";
}

export function shortAddress(address: string): string {
  if (address === "0.0.0.0" || address === "::") return "Toutes";
  if (address === "127.0.0.1" || address === "::1") return "Boucle locale";
  return address;
}
