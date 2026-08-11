import { invoke } from "@tauri-apps/api/core";
import { mockScan, mockSettings } from "../data/mock";
import type { ActionResult, AppSettings, DockerStopRequest, KillRequest, ScanResult } from "../types";

export const isTauriRuntime = () => "__TAURI_INTERNALS__" in window;

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
const SETTINGS_STORAGE_KEY = "portroot-settings";
const LEGACY_SETTINGS_STORAGE_KEY = "connexions-locales-settings";

export async function scanPorts(): Promise<ScanResult> {
  if (isTauriRuntime()) return invoke<ScanResult>("scan_ports");
  await wait(420);
  return { ...mockScan, scannedAt: Math.floor(Date.now() / 1000) };
}

export async function getSettings(): Promise<AppSettings> {
  if (isTauriRuntime()) return normalizeSettings(await invoke<AppSettings>("get_settings"));
  const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  const legacy = stored ? null : window.localStorage.getItem(LEGACY_SETTINGS_STORAGE_KEY);
  if (legacy) {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, legacy);
    window.localStorage.removeItem(LEGACY_SETTINGS_STORAGE_KEY);
  }
  const serialized = stored ?? legacy;
  return serialized ? normalizeSettings(JSON.parse(serialized) as Partial<AppSettings>) : structuredClone(mockSettings);
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const normalized = normalizeSettings(settings);
  if (isTauriRuntime()) return invoke<AppSettings>("save_settings", { settings: normalized });
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function normalizeSettings(settings: Partial<AppSettings>): AppSettings {
  return {
    ...structuredClone(mockSettings),
    ...settings,
    language: settings.language === "en" ? "en" : "fr",
    rules: settings.rules ?? structuredClone(mockSettings.rules),
  };
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
  throw new Error("L’arrêt réel nécessite l’application de bureau PortRoot.");
}

export async function stopDockerContainer(request: DockerStopRequest): Promise<ActionResult> {
  if (isTauriRuntime()) return invoke<ActionResult>("stop_docker_container", { request });
  await wait(260);
  throw new Error("L’arrêt réel nécessite l’application de bureau PortRoot.");
}
