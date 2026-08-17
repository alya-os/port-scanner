import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// L'API native est le seul point de sortie destructeur de l'application : on la
// remplace pour observer exactement quels PID lui sont confiés.
vi.mock("../src/lib/api", () => ({
  isTauriRuntime: () => true,
  scanPorts: vi.fn(),
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  killProcess: vi.fn(),
  stopDockerContainer: vi.fn(),
  revealFolder: vi.fn(),
  openTerminal: vi.fn(),
}));

const api = await import("../src/lib/api");
const { App } = await import("../src/App.tsx");

const SETTINGS = {
  theme: "dark",
  language: "en",
  protectSystemProcesses: true,
  rules: [],
};

// Trois serveurs indépendants, même exécutable, même dossier, même commande au
// port près : c'est la situation que l'inspecteur qualifie de doublon confirmé.
const INSTANCES = [
  { pid: 4001, port: 3000, startedAt: 1_700_000_300 },
  { pid: 4002, port: 3001, startedAt: 1_700_000_200 },
  { pid: 4003, port: 3002, startedAt: 1_700_000_100 },
];

function record({ pid, port, startedAt }, overrides = {}) {
  return {
    id: `tcp-127.0.0.1-${port}-${pid}`,
    protocol: "TCP",
    localAddress: "127.0.0.1",
    port,
    scope: "local",
    pid,
    parentPid: 1,
    launcher: null,
    launcherPid: null,
    ai: false,
    processName: "node",
    processPath: "/opt/homebrew/bin/node",
    command: `node server.js --port ${port}`,
    workingDirectory: "/Users/jp/Projects/client-a/api",
    groupName: "api",
    identification: "api",
    dockerContainerId: null,
    category: "other",
    startedAt,
    uptimeSeconds: 7200,
    cpuUsage: 0.4,
    memoryBytes: 64_000_000,
    activeConnections: 0,
    protected: false,
    protectionReasons: [],
    ...overrides,
  };
}

function scanResult(records) {
  return {
    records,
    scannedAt: 1_700_000_400,
    platform: "macos",
    permissionLimited: false,
    warnings: [],
  };
}

async function openApp(records = INSTANCES.map((instance) => record(instance))) {
  api.scanPorts.mockResolvedValue(scanResult(records));
  api.getSettings.mockResolvedValue(SETTINGS);
  render(<App />);
  // Le scan s'accorde un minimum de temps d'affichage avant de rendre l'arbre.
  await screen.findByRole("button", { name: /node/i }, { timeout: 3000 });
}

function confirmDialog() {
  return screen.getByRole("alertdialog");
}

beforeEach(() => {
  api.killProcess.mockResolvedValue({ success: true, message: "stopped" });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("arrêter tout un groupe", () => {
  test("envoie au moteur chaque PID de la famille, une fois", async () => {
    const user = userEvent.setup();
    await openApp();

    await user.click(screen.getByRole("button", { name: /stop all/i }));
    await user.click(
      within(confirmDialog()).getByRole("button", { name: /^stop/i }),
    );

    await waitFor(() => expect(api.killProcess).toHaveBeenCalledTimes(3));
    expect(api.killProcess.mock.calls.map(([request]) => request.pid).sort()).toEqual([
      4001, 4002, 4003,
    ]);
  });

  test("joint l'heure de démarrage attendue, pour que le moteur détecte un PID réutilisé", async () => {
    const user = userEvent.setup();
    await openApp();

    await user.click(screen.getByRole("button", { name: /stop all/i }));
    await user.click(
      within(confirmDialog()).getByRole("button", { name: /^stop/i }),
    );

    await waitFor(() => expect(api.killProcess).toHaveBeenCalledTimes(3));
    const sent = new Map(
      api.killProcess.mock.calls.map(([request]) => [request.pid, request.expectedStartTime]),
    );
    for (const instance of INSTANCES) {
      expect(sent.get(instance.pid)).toBe(instance.startedAt);
    }
  });
});

describe("nettoyer les doublons", () => {
  test("épargne l'instance choisie et n'arrête que les autres", async () => {
    const user = userEvent.setup();
    await openApp();

    await user.click(screen.getByRole("button", { name: /stop 2 duplicates/i }));

    // L'instance la plus récente est préselectionnée; on en choisit une autre
    // pour vérifier que c'est bien la sélection qui décide, pas le défaut.
    const dialog = confirmDialog();
    await user.click(within(dialog).getByRole("radio", { name: /3002/ }));
    await user.click(within(dialog).getByRole("button", { name: /^stop 2 duplicates/i }));

    await waitFor(() => expect(api.killProcess).toHaveBeenCalledTimes(2));
    const stopped = api.killProcess.mock.calls.map(([request]) => request.pid).sort();
    expect(stopped).toEqual([4001, 4002]);
    expect(stopped).not.toContain(4003);
  });

  test("garde par défaut l'instance la plus récente", async () => {
    const user = userEvent.setup();
    await openApp();

    await user.click(screen.getByRole("button", { name: /stop 2 duplicates/i }));
    await user.click(
      within(confirmDialog()).getByRole("button", { name: /^stop 2 duplicates/i }),
    );

    await waitFor(() => expect(api.killProcess).toHaveBeenCalledTimes(2));
    expect(api.killProcess.mock.calls.map(([request]) => request.pid).sort()).toEqual([
      4002, 4003,
    ]);
  });
});

describe("garde-fous", () => {
  test("annuler ne touche à rien", async () => {
    const user = userEvent.setup();
    await openApp();

    await user.click(screen.getByRole("button", { name: /stop all/i }));
    await user.click(within(confirmDialog()).getByRole("button", { name: /cancel/i }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull(),
    );
    expect(api.killProcess).not.toHaveBeenCalled();
  });

  test("un processus protégé n'offre aucun arrêt", async () => {
    await openApp(
      INSTANCES.map((instance) =>
        record(instance, {
          protected: true,
          protectionReasons: [{ kind: "systemDefault", ruleId: null }],
        }),
      ),
    );

    // L'action destructrice n'est pas seulement désactivée : elle disparaît au
    // profit d'un libellé qui dit pourquoi.
    expect(screen.queryByRole("button", { name: /stop all/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /stop 2 duplicates/i })).toBeNull();

    const blocked = screen.getAllByRole("button", { name: /stop blocked/i });
    expect(blocked).toHaveLength(2);
    for (const button of blocked) {
      expect(button.disabled).toBe(true);
    }
  });

  test("un échec sur un PID est signalé sans empêcher les autres", async () => {
    const user = userEvent.setup();
    api.killProcess.mockImplementation(({ pid }) =>
      pid === 4002
        ? Promise.reject(new Error("Processus protégé"))
        : Promise.resolve({ success: true, message: "stopped" }),
    );
    await openApp();

    await user.click(screen.getByRole("button", { name: /stop all/i }));
    await user.click(
      within(confirmDialog()).getByRole("button", { name: /^stop/i }),
    );

    await waitFor(() => expect(api.killProcess).toHaveBeenCalledTimes(3));
    expect(await screen.findByText(/Processus protégé/)).toBeTruthy();
  });
});
