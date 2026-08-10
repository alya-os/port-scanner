import { invoke } from "@tauri-apps/api/core";
import { mockScan, mockSettings } from "../data/mock";
import type { ActionResult, AppSettings, KillRequest, ScanResult } from "../types";

export const isTauriRuntime = () => "__TAURI_INTERNALS__" in window;

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export async function scanPorts(): Promise<ScanResult> {
  if (isTauriRuntime()) return invoke<ScanResult>("scan_ports");
  await wait(420);
  return { ...mockScan, scannedAt: Math.floor(Date.now() / 1000) };
}

export async function getSettings(): Promise<AppSettings> {
  if (isTauriRuntime()) return invoke<AppSettings>("get_settings");
  const stored = window.localStorage.getItem("connexions-locales-settings");
  return stored ? (JSON.parse(stored) as AppSettings) : structuredClone(mockSettings);
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  if (isTauriRuntime()) return invoke<AppSettings>("save_settings", { settings });
  window.localStorage.setItem("connexions-locales-settings", JSON.stringify(settings));
  return settings;
}

export async function revealFolder(path: string): Promise<ActionResult> {
  if (isTauriRuntime()) return invoke<ActionResult>("reveal_folder", { path });
  await wait(180);
  return { success: true, message: `Dossier prêt à être ouvert : ${path}` };
}

export async function openTerminal(path: string): Promise<ActionResult> {
  if (isTauriRuntime()) return invoke<ActionResult>("open_terminal", { path });
  await wait(180);
  return { success: true, message: `Terminal prêt à être ouvert : ${path}` };
}

export async function killProcess(request: KillRequest): Promise<ActionResult> {
  if (isTauriRuntime()) return invoke<ActionResult>("kill_process", { request });
  await wait(260);
  return { success: true, message: `Demande d’arrêt simulée pour le PID ${request.pid}.` };
}
