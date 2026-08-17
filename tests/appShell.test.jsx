import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

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

const RECORD = {
  id: "tcp-127.0.0.1-3000-41",
  protocol: "TCP",
  localAddress: "127.0.0.1",
  port: 3000,
  scope: "local",
  pid: 41,
  parentPid: 1,
  launcher: null,
  launcherPid: null,
  ai: false,
  processName: "node",
  processPath: "/opt/homebrew/bin/node",
  command: "node server.js",
  workingDirectory: "/Users/jp/Projects/api",
  groupName: "api",
  identification: "api",
  dockerContainerId: null,
  category: "other",
  startedAt: 1_700_000_000,
  uptimeSeconds: 600,
  cpuUsage: 0.2,
  memoryBytes: 1024,
  activeConnections: 0,
  protected: false,
  protectionReasons: [],
};

function scanResult() {
  return {
    records: [RECORD],
    scannedAt: 1_700_000_400,
    platform: "macos",
    permissionLimited: false,
    warnings: [],
  };
}

/** Remplace `matchMedia`, absent de jsdom, par un pilote dont on tient la valeur. */
function installMatchMedia(initialDark) {
  let dark = initialDark;
  const listeners = new Set();

  window.matchMedia = (query) => ({
    media: query,
    get matches() {
      return dark;
    },
    addEventListener: (_event, listener) => listeners.add(listener),
    removeEventListener: (_event, listener) => listeners.delete(listener),
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
    dispatchEvent: () => false,
  });

  return (nextDark) => {
    dark = nextDark;
    for (const listener of listeners) listener({ matches: dark });
  };
}

beforeEach(() => {
  api.scanPorts.mockResolvedValue(scanResult());
  api.revealFolder.mockResolvedValue({ success: true, message: "ok" });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  delete window.matchMedia;
});

test("une notification n'est pas effacée par le minuteur de la précédente", async () => {
  vi.useFakeTimers();
  api.getSettings.mockResolvedValue({
    theme: "dark",
    language: "en",
    protectSystemProcesses: true,
    rules: [],
  });

  render(<App />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(600);
  });

  // `fireEvent` plutôt que `userEvent` : ce dernier attend de vrais délais, que
  // les minuteurs simulés de ce test empêchent d'échoir.
  const open = screen.getByRole("button", { name: /open folder/i });
  const click = async () => {
    fireEvent.click(open);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  };

  await click();
  expect(screen.queryByRole("status")).not.toBeNull();

  // Trois secondes plus tard, la première notification a encore 1,2 s à vivre.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  await click();

  // Deux secondes après la seconde : l'échéance de la première est passée, et
  // c'est elle qui effaçait l'affichage avant la correction.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(screen.queryByRole("status")).not.toBeNull();

  // Puis la seconde s'efface à sa propre échéance, pas plus tôt.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2500);
  });
  expect(screen.queryByRole("status")).toBeNull();
});

test("le thème système suit un changement de préférence sans redémarrage", async () => {
  const setDark = installMatchMedia(true);
  api.getSettings.mockResolvedValue({
    theme: "system",
    language: "en",
    protectSystemProcesses: true,
    rules: [],
  });

  render(<App />);
  await waitFor(() =>
    expect(document.documentElement.dataset.theme).toBe("dark"),
  );

  await act(async () => setDark(false));

  expect(document.documentElement.dataset.theme).toBe("light");
  expect(document.documentElement.style.colorScheme).toBe("light");
});

test("un thème explicite ignore la préférence du système", async () => {
  const setDark = installMatchMedia(true);
  api.getSettings.mockResolvedValue({
    theme: "light",
    language: "en",
    protectSystemProcesses: true,
    rules: [],
  });

  render(<App />);
  await waitFor(() =>
    expect(document.documentElement.dataset.theme).toBe("light"),
  );

  await act(async () => setDark(false));

  expect(document.documentElement.dataset.theme).toBe("light");
});
