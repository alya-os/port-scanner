import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Warning, X } from "@phosphor-icons/react";
import { Inspector } from "./components/Inspector";
import { KillDialog } from "./components/KillDialog";
import { ProtectionDialog } from "./components/ProtectionDialog";
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
  stopDockerContainer,
} from "./lib/api";
import {
  buildProcessTree,
  defaultSortDirection,
  hideProtectedProcesses,
} from "./lib/processTree";
import { createTranslator, I18nProvider, translate } from "./lib/i18n";
import { getProtectionControl } from "./lib/protectionRules";
import type { TranslationKey } from "./lib/i18n";
import type {
  AppSettings,
  NavFilter,
  PortRecord,
  ProcessNode,
  ScanResult,
  SortDirection,
  SortMode,
  StopMode,
  ThemeMode,
} from "./types";

interface ToastState {
  type: "success" | "error";
  message: string;
}

interface StopTarget {
  process: ProcessNode;
  mode: StopMode;
}

interface ProtectionTarget {
  process: ProcessNode;
  ruleIds: string[];
  affectedProcessCount: number;
  affectedPortCount: number;
}

const MINIMUM_SCAN_FEEDBACK_MS = 450;
const TOAST_DURATION_MS = 4200;

export function App() {
  const previewMode = !isTauriRuntime();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    theme: "dark",
    language: "en",
    protectSystemProcesses: true,
    rules: [],
  });
  const [filter, setFilter] = useState<NavFilter>("all");
  const [hideProtected, setHideProtected] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("evaluation");
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    defaultSortDirection("evaluation")
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [stopTarget, setStopTarget] = useState<StopTarget | null>(null);
  const [stopping, setStopping] = useState(false);
  const [protectionTarget, setProtectionTarget] =
    useState<ProtectionTarget | null>(null);
  const [protectionSaving, setProtectionSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const t = createTranslator(settings.language);

  // Sans annuler le minuteur précédent, la première notification effacerait la
  // seconde à sa propre échéance, en pleine lecture.
  const toastTimer = useRef<number | null>(null);
  const notify = useCallback((type: ToastState["type"], message: string) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = window.setTimeout(() => {
      toastTimer.current = null;
      setToast(null);
    }, TOAST_DURATION_MS);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    []
  );

  const runScan = useCallback(async () => {
    const startedAt = performance.now();
    setScanning(true);
    try {
      const result = await scanPorts();
      const remainingFeedbackTime =
        MINIMUM_SCAN_FEEDBACK_MS - (performance.now() - startedAt);
      if (remainingFeedbackTime > 0) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, remainingFeedbackTime)
        );
      }
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

  const systemScheme = useSystemColorScheme();
  const resolvedTheme =
    settings.theme === "system" ? systemScheme : settings.theme;
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    document.documentElement.lang = settings.language;
  }, [resolvedTheme, settings.language]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document
          .querySelector<HTMLInputElement>(".search-field input")
          ?.focus();
      }
      if (event.key === "Escape") {
        if (protectionTarget && !protectionSaving) setProtectionTarget(null);
        else if (stopTarget && !stopping) setStopTarget(null);
        else if (settingsOpen) setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [protectionSaving, protectionTarget, settingsOpen, stopTarget, stopping]);

  const records = useMemo(() => scan?.records ?? [], [scan?.records]);
  const matchingGroups = useMemo(
    () =>
      buildProcessTree(
        records,
        filter,
        query,
        sort,
        settings.language,
        sortDirection
      ),
    [filter, query, records, settings.language, sort, sortDirection]
  );
  const protectedProcessCount = useMemo(
    () =>
      matchingGroups
        .flatMap((group) => group.processes)
        .filter((process) => process.protected).length,
    [matchingGroups]
  );
  const groups = useMemo(
    () =>
      filter === "all" && hideProtected
        ? hideProtectedProcesses(matchingGroups)
        : matchingGroups,
    [filter, hideProtected, matchingGroups]
  );
  const processes = useMemo(
    () => groups.flatMap((group) => group.processes),
    [groups]
  );
  const selected =
    processes.find((process) => process.id === selectedId) ??
    processes[0] ??
    null;
  const selectedProtectionControl = useMemo(
    () => (selected ? getProtectionControl(selected, settings, records) : null),
    [records, selected, settings]
  );

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  const persistSettings = async (
    nextSettings: AppSettings,
    successKey: TranslationKey = "toast.settingsSaved",
    values: Record<string, string | number> = {}
  ) => {
    try {
      const saved = await saveSettings(nextSettings);
      const protectionChanged =
        protectionSignature(saved) !== protectionSignature(settings);
      setSettings(saved);
      notify("success", translate(saved.language, successKey, values));
      // Les protections sont évaluées par le moteur : seule une nouvelle analyse
      // les met à jour dans l'arbre.
      if (protectionChanged) void runScan();
    } catch (error) {
      notify("error", String(error));
      throw error;
    }
  };

  const toggleTheme = () => {
    const nextTheme: ThemeMode = resolvedTheme === "dark" ? "light" : "dark";
    void persistSettings({ ...settings, theme: nextTheme });
  };

  const handleSortChange = (nextSort: SortMode) => {
    if (nextSort === sort) {
      setSortDirection((current) =>
        current === "ascending" ? "descending" : "ascending"
      );
      return;
    }
    setSort(nextSort);
    setSortDirection(defaultSortDirection(nextSort));
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

  const handleProtectionAction = (process: ProcessNode) => {
    const control = getProtectionControl(process, settings, records);
    if (control.action === "manage") {
      setSettingsOpen(true);
      return;
    }
    if (control.action === "remove") {
      setProtectionTarget({
        process,
        ruleIds: control.removableRules.map((rule) => rule.id),
        affectedProcessCount: control.affectedProcessCount,
        affectedPortCount: control.affectedPortCount,
      });
      return;
    }

    const isDocker = Boolean(process.dockerContainerId);
    const path = process.workingDirectory ?? process.processPath;
    const kind = isDocker
      ? ("container" as const)
      : path
      ? ("path" as const)
      : ("process" as const);
    const rule = {
      id: `custom-${kind}-${Date.now()}`,
      label: t("toast.projectRule", { name: process.identification }),
      kind,
      value: isDocker ? process.identification : path ?? process.name,
      enabled: true,
      builtin: false,
    };
    void persistSettings(
      { ...settings, rules: [...settings.rules, rule] },
      "toast.protectionAdded",
      { name: process.identification }
    ).catch(() => undefined);
  };

  const confirmProtectionRemoval = async () => {
    if (!protectionTarget) return;
    setProtectionSaving(true);
    try {
      const removedIds = new Set(protectionTarget.ruleIds);
      await persistSettings(
        {
          ...settings,
          rules: settings.rules.filter((rule) => !removedIds.has(rule.id)),
        },
        "toast.protectionRemoved",
        { name: protectionTarget.process.identification }
      );
      setProtectionTarget(null);
    } catch {
      // persistSettings already surfaces the error in the app.
    } finally {
      setProtectionSaving(false);
    }
  };

  const confirmStop = async (keepPid: number | null) => {
    if (!stopTarget) return;
    const targetProcess = stopTarget.process;
    const pidsToStop =
      stopTarget.mode === "duplicates"
        ? targetProcess.pids.filter((pid) => pid !== keepPid)
        : targetProcess.pids;

    if (
      stopTarget.mode === "duplicates" &&
      (!keepPid || !targetProcess.pids.includes(keepPid))
    ) {
      notify("error", t("kill.keepSelectionRequired"));
      return;
    }

    setStopping(true);
    const failures: string[] = [];
    const stoppedPids: number[] = [];
    let stoppedContainer: string | null = null;

    if (targetProcess.dockerContainerId) {
      try {
        await stopDockerContainer({
          containerId: targetProcess.dockerContainerId,
          force: false,
        });
        stoppedContainer = targetProcess.identification;
      } catch (error) {
        failures.push(String(error));
      }
    } else {
      for (const pid of pidsToStop) {
        const matchingRecord = targetProcess.records.find(
          (record) => record.pid === pid
        );
        try {
          await killProcess({
            pid,
            expectedStartTime: matchingRecord?.startedAt ?? null,
            force: false,
          });
          stoppedPids.push(pid);
        } catch (error) {
          failures.push(`PID ${pid} : ${String(error)}`);
        }
      }
    }

    setStopping(false);
    setStopTarget(null);
    if (failures.length) notify("error", failures.join(" · "));
    else if (stoppedContainer)
      notify(
        "success",
        t("toast.containerStopped", { name: stoppedContainer })
      );
    else if (stopTarget.mode === "duplicates")
      notify(
        "success",
        t("toast.duplicatesStopped", {
          count: stoppedPids.length,
          pid: keepPid ?? "—",
        })
      );
    else
      notify(
        "success",
        t(
          stoppedPids.length === 1
            ? "toast.processStoppedOne"
            : "toast.processStoppedMany",
          { count: stoppedPids.length }
        )
      );

    if (isTauriRuntime()) {
      window.setTimeout(() => void runScan(), 500);
    }
  };

  const processCount = new Set(
    records.flatMap((record) => (record.pid ? [record.pid] : []))
  ).size;
  const protectedCount = records.filter((record) => record.protected).length;

  return (
    <I18nProvider language={settings.language}>
      <main
        className={`app-shell ${
          sidebarCollapsed ? "is-sidebar-collapsed" : ""
        }`}
      >
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
          protectedFilterAvailable={filter === "all"}
          hideProtected={hideProtected}
          protectedProcessCount={protectedProcessCount}
          onToggleProtected={() => setHideProtected((current) => !current)}
          onScan={runScan}
          scanning={scanning}
        />
        <ProcessTree
          groups={groups}
          selectedId={selected?.id ?? null}
          onSelect={(process) => setSelectedId(process.id)}
          scanning={scanning}
          platform={scan?.platform ?? "macos"}
          sort={sort}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
        />
        <Inspector
          process={selected}
          platform={scan?.platform ?? "macos"}
          rules={settings.rules}
          onReveal={(path) => void handleReveal(path)}
          onTerminal={(path) => void handleTerminal(path)}
          protectionAction={selectedProtectionControl?.action ?? "add"}
          onProtectionAction={handleProtectionAction}
          onRequestStop={(process, mode) => setStopTarget({ process, mode })}
          canStop={!previewMode}
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
        <SettingsDialog
          open={settingsOpen}
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSave={persistSettings}
        />
        <ProtectionDialog
          process={protectionTarget?.process ?? null}
          rules={settings.rules.filter((rule) =>
            protectionTarget?.ruleIds.includes(rule.id)
          )}
          affectedProcessCount={protectionTarget?.affectedProcessCount ?? 0}
          affectedPortCount={protectionTarget?.affectedPortCount ?? 0}
          saving={protectionSaving}
          onCancel={() => setProtectionTarget(null)}
          onConfirm={() => void confirmProtectionRemoval()}
        />
        <KillDialog
          process={stopTarget?.process ?? null}
          mode={stopTarget?.mode ?? "all"}
          stopping={stopping}
          onCancel={() => setStopTarget(null)}
          onConfirm={(keepPid) => void confirmStop(keepPid)}
        />
        {toast && (
          <div className={`toast toast-${toast.type}`} role="status">
            {toast.type === "success" ? (
              <Check size={18} weight="bold" />
            ) : (
              <Warning size={18} weight="fill" />
            )}
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label={t("toast.close")}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </main>
    </I18nProvider>
  );
}

const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

// Le thème « système » doit suivre le système, pas la valeur qu'il avait au
// démarrage. jsdom n'implémente pas `matchMedia`, d'où l'appel facultatif et le
// repli sur le thème clair.
function useSystemColorScheme(): "dark" | "light" {
  const [scheme, setScheme] = useState<"dark" | "light">(() =>
    window.matchMedia?.(DARK_SCHEME_QUERY).matches ? "dark" : "light"
  );

  useEffect(() => {
    const query = window.matchMedia?.(DARK_SCHEME_QUERY);
    if (!query) return;

    const update = (event: MediaQueryListEvent) =>
      setScheme(event.matches ? "dark" : "light");
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return scheme;
}

// Ce qui, dans les réglages, change le verdict du moteur. Modifier le thème ou
// la langue ne justifie pas de relancer une analyse.
function protectionSignature(settings: AppSettings): string {
  return JSON.stringify([
    settings.protectSystemProcesses,
    settings.rules
      .filter((rule) => rule.enabled)
      .map((rule) => [rule.id, rule.kind, rule.value]),
  ]);
}
