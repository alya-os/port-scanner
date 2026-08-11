import { localeFor, translate, type TranslationKey } from "./i18n.ts";
import type { Evaluation, Language, Scope } from "../types";

const evaluationMeta: Record<Evaluation, { label: TranslationKey; tone: string }> = {
  protected: { label: "evaluation.protected", tone: "protected" },
  duplicateConfirmed: { label: "evaluation.duplicateConfirmed", tone: "warning" },
  duplicatePossible: { label: "evaluation.duplicatePossible", tone: "warning" },
  exposed: { label: "evaluation.exposed", tone: "danger" },
  review: { label: "evaluation.review", tone: "warning" },
  active: { label: "evaluation.active", tone: "success" },
  ok: { label: "evaluation.ok", tone: "success" },
};

export function evaluationCopy(
  evaluation: Evaluation,
  language: Language,
  values: Record<string, string | number> = {},
): { label: string; tone: string } {
  const meta = evaluationMeta[evaluation];
  return { label: translate(language, meta.label, values), tone: meta.tone };
}

export function formatDuration(totalSeconds: number | null, language: Language = "en"): string {
  if (totalSeconds === null) return translate(language, "common.unavailable");
  if (totalSeconds < 60) return `${totalSeconds} s`;
  if (totalSeconds < 3600) return `${Math.floor(totalSeconds / 60)} min`;
  if (totalSeconds < 86_400) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours} h ${minutes} min`;
  }
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  return `${days} ${language === "fr" ? "j" : "d"} ${hours} h`;
}

export function formatStartedAt(seconds: number | null, language: Language = "en"): string {
  if (!seconds) return translate(language, "common.unavailable");
  return new Intl.DateTimeFormat(localeFor(language), {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(seconds * 1000));
}

export function formatScannedAt(seconds: number | null, language: Language = "en"): string {
  if (!seconds) return translate(language, "common.never");
  return new Intl.DateTimeFormat(localeFor(language), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(seconds * 1000));
}

export function formatMemory(bytes: number, language: Language = "en"): string {
  if (!bytes) return translate(language, "common.unavailable");
  const megabytes = bytes / 1_000_000;
  if (language === "en") return megabytes >= 1000 ? `${(megabytes / 1000).toFixed(1)} GB` : `${Math.round(megabytes)} MB`;
  return megabytes >= 1000 ? `${(megabytes / 1000).toFixed(1)} Go` : `${Math.round(megabytes)} Mo`;
}

export function scopeLabel(scope: Scope, language: Language = "en"): string {
  return translate(language, scope === "local" ? "inspector.localOnly" : "inspector.localNetwork");
}

export function shortAddress(address: string, language: Language = "en"): string {
  if (address === "0.0.0.0" || address === "::") return translate(language, "common.allAddresses");
  if (address === "127.0.0.1" || address === "::1") return translate(language, "common.loopback");
  return address;
}
