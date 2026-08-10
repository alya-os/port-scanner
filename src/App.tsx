import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Warning, X } from "@phosphor-icons/react";
import { Inspector } from "./components/Inspector";
import { KillDialog } from "./components/KillDialog";
import { ProcessTree } from "./components/ProcessTree";
import { SettingsDialog } from "./components/SettingsDialog";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { Toolbar } from "./components/Toolbar";
import {
  getSettings,
  isTauriRuntime,
  killProcess,
  openTerminal,
  revealFolder,
  saveSettings,
  scanPorts,
} from "./lib/api";
import { buildProcessTree } from "./lib/processTree";
import { createTranslator, I18nProvider, localizeRuleLabel, translate } from "./lib/i18n";
import type {
  AppSettings,
  NavFilter,
  PortRecord,
  ProcessNode,
  ScanResult,
  SortMode,
  ThemeMode,
} from "./types";

interface ToastState {
  type: "success" | "error";
  message: string;
}

export function App() {
  const previewMode = !isTauriRuntime();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [settings, setSettings] = useState<AppSettings>({ theme: "dark", language: "fr", protectSystemProcesses: true, rules: [] });
  const [filter, setFilter] = useState<NavFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("evaluation");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [stopTarget, setStopTarget] = useState<ProcessNode | null>(null);
  const [stopping, setStopping] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const t = createTranslator(settings.language);

  const notify = useCallback((type: ToastState["type"], message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      const result = await scanPorts();
      setScan(result);
    } catch (error) {
      notify("error", String(error));
    } finally {
      setScanning(false);
    }
  }, [notify]);

  useEffect(() => {
    void getSettings()
      .then(setSettings)
      .catch((error) => notify("error", String(error)));
    void runScan();
  }, [notify, runScan]);

  const resolvedTheme = resolveTheme(settings.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    document.documentElement.lang = settings.language;
  }, [resolvedTheme, settings.language]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".search-field input")?.focus();
      }
      if (event.key === "Escape") {
        if (stopTarget && !stopping) setStopTarget(null);
        else if (settingsOpen) setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [settingsOpen, stopTarget, stopping]);

  const records = useMemo(
    () => applyProtectionSettings(scan?.records ?? [], settings),
    [scan?.records, settings],
  );
  const groups = useMemo(
    () => buildProcessTree(records, filter, query, sort, settings.language),
    [filter, query, records, settings.language, sort],
  );
  const processes = useMemo(() => groups.flatMap((group) => group.processes), [groups]);
  const selected = processes.find((process) => process.id === selectedId) ?? processes[0] ?? null;

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  const persistSettings = async (nextSettings: AppSettings) => {
    try {
      const saved = await saveSettings(nextSettings);
      setSettings(saved);
      notify("success", translate(saved.language, "toast.settingsSaved"));
    } catch (error) {
      notify("error", String(error));
      throw error;
    }
  };

  const toggleTheme = () => {
    const nextTheme: ThemeMode = resolvedTheme === "dark" ? "light" : "dark";
    void persistSettings({ ...settings, theme: nextTheme });
  };

  const handleReveal = async (path: string) => {
    try {
      await revealFolder(path);
      notify("success", t("toast.folderOpened", { path }));
    } catch (error) {
      notify("error", String(error));
    }
  };

  const handleTerminal = async (path: string) => {
    try {
      await openTerminal(path);
      notify("success", t("toast.terminalOpened", { path }));
    } catch (error) {
      notify("error", String(error));
    }
  };

  const handleProtect = async (process: ProcessNode) => {
    if (process.protected) return;
    const path = process.workingDirectory ?? process.processPath;
    const rule = {
      id: `custom-${path ? "path" : "process"}-${Date.now()}`,
      label: path ? t("toast.projectRule", { name: process.identification }) : process.identification,
      kind: path ? ("path" as const) : ("process" as const),
      value: path ?? process.name,
      enabled: true,
      builtin: false,
    };
    await persistSettings({ ...settings, rules: [...settings.rules, rule] });
  };

  const confirmStop = async () => {
    if (!stopTarget) return;
    setStopping(true);
    const failures: string[] = [];
    const stoppedPids: number[] = [];

    for (const pid of stopTarget.pids) {
      const matchingRecord = stopTarget.records.find((record) => record.pid === pid);
      try {
        await killProcess({ pid, expectedStartTime: matchingRecord?.startedAt ?? null, force: false });
        stoppedPids.push(pid);
      } catch (error) {
        failures.push(`PID ${pid} : ${String(error)}`);
      }
    }

    setStopping(false);
    setStopTarget(null);
    if (failures.length) notify("error", failures.join(" · "));
    else notify("success", t(stoppedPids.length === 1 ? "toast.processStoppedOne" : "toast.processStoppedMany", { count: stoppedPids.length }));

    if (isTauriRuntime()) {
      window.setTimeout(() => void runScan(), 500);
    } else if (stoppedPids.length) {
      setScan((current) =>
        current
          ? { ...current, records: current.records.filter((record) => !record.pid || !stoppedPids.includes(record.pid)) }
          : current,
      );
    }
  };

  const processCount = new Set(records.flatMap((record) => (record.pid ? [record.pid] : []))).size;
  const protectedCount = records.filter((record) => record.protected).length;

  return (
    <I18nProvider language={settings.language}>
      <main className={`app-shell ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
      <Sidebar
        active={filter}
        onChange={setFilter}
        records={records}
        platform={scan?.platform ?? "macos"}
        theme={resolvedTheme}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <Toolbar
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        onScan={runScan}
        scanning={scanning}
      />
      <ProcessTree groups={groups} selectedId={selected?.id ?? null} onSelect={(process) => setSelectedId(process.id)} scanning={scanning} platform={scan?.platform ?? "macos"} />
      <Inspector
        process={selected}
        platform={scan?.platform ?? "macos"}
        onReveal={(path) => void handleReveal(path)}
        onTerminal={(path) => void handleTerminal(path)}
        onProtect={(process) => void handleProtect(process)}
        onRequestStop={setStopTarget}
      />
      <StatusBar
        scannedAt={scan?.scannedAt ?? null}
        processCount={processCount}
        portCount={records.length}
        protectedCount={protectedCount}
        permissionLimited={scan?.permissionLimited ?? false}
        scanning={scanning}
        demoMode={previewMode}
      />
      <SettingsDialog open={settingsOpen} settings={settings} onClose={() => setSettingsOpen(false)} onSave={persistSettings} />
      <KillDialog process={stopTarget} stopping={stopping} onCancel={() => setStopTarget(null)} onConfirm={() => void confirmStop()} />
      {toast && (
        <div className={`toast toast-${toast.type}`} role="status">
          {toast.type === "success" ? <Check size={18} weight="bold" /> : <Warning size={18} weight="fill" />}
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} aria-label={t("toast.close")}><X size={16} /></button>
        </div>
      )}
      </main>
    </I18nProvider>
  );
}

function resolveTheme(theme: ThemeMode): "dark" | "light" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyProtectionSettings(records: PortRecord[], settings: AppSettings): PortRecord[] {
  const t = createTranslator(settings.language);
  return records.map((record) => {
    const reasons: string[] = [];
    if (settings.protectSystemProcesses && record.category === "system") reasons.push(t("protection.systemDefault"));
    if (record.pid === 1) reasons.push(t("protection.systemMain"));
    for (const rule of settings.rules.filter((candidate) => candidate.enabled)) {
      const matches =
        (rule.kind === "port" && Number(rule.value) === record.port) ||
        (rule.kind === "process" && rule.value.toLocaleLowerCase() === record.processName.toLocaleLowerCase()) ||
        (rule.kind === "path" && [record.processPath, record.workingDirectory]
          .filter((path): path is string => Boolean(path))
          .some((path) => path.toLocaleLowerCase().startsWith(rule.value.toLocaleLowerCase())));
      if (matches) reasons.push(localizeRuleLabel(rule, settings.language));
    }
    return { ...record, protected: reasons.length > 0, protectionReasons: [...new Set(reasons)] };
  });
}
