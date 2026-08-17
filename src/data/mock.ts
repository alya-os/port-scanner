import type { AppSettings, PortRecord, ScanResult } from "../types";

const now = Math.floor(Date.now() / 1000);

function record(
  overrides: Partial<PortRecord> &
    Pick<
      PortRecord,
      "id" | "port" | "processName" | "groupName" | "identification"
    >
): PortRecord {
  return {
    protocol: "TCP",
    localAddress: "127.0.0.1",
    scope: "local",
    pid: 1000,
    parentPid: 1,
    launcher: null,
    launcherPid: null,
    processPath: null,
    command: null,
    workingDirectory: null,
    category: "other",
    ai: false,
    dockerContainerId: null,
    startedAt: now - 3600,
    uptimeSeconds: 3600,
    cpuUsage: 0.8,
    memoryBytes: 64_000_000,
    activeConnections: 0,
    protected: false,
    protectionReasons: [],
    ...overrides,
  };
}

const brandtrackerDirectory =
  "/Users/jp/Documents/Dev/Projet/IndexWebMarketing/interne/2025/alya-genai-brandtracker";

export const mockScan: ScanResult = {
  scannedAt: now,
  platform: "macos",
  permissionLimited: true,
  warnings: [
    "3 sockets système sont visibles sans PID. Les permissions peuvent masquer leur propriétaire.",
  ],
  records: [
    ...[5304, 5305, 5306, 5307, 5308].map((port, index) =>
      record({
        id: `brandtracker-${port}`,
        port,
        pid: 16159 + index * 1000,
        processName: index === 0 ? "python3.12" : "python",
        groupName: "alya-genai-brandtracker",
        identification: "alya-genai-brandtracker",
        processPath: `${brandtrackerDirectory}/.venv/bin/${
          index === 0 ? "python3.12" : "python"
        }`,
        command:
          index === 0
            ? ".venv/bin/python scratchpad/run_gaio.py"
            : `.venv/bin/python -m uvicorn app.main:app --port ${port}`,
        workingDirectory: brandtrackerDirectory,
        startedAt: now - (index === 0 ? 8 * 86_400 : 3 * 86_400) - index * 4000,
        uptimeSeconds: (index === 0 ? 8 * 86_400 : 3 * 86_400) + index * 4000,
        cpuUsage: 0.2 + index * 0.25,
      })
    ),
    record({
      id: "lifebudget-5173",
      port: 5173,
      pid: 27006,
      processName: "node",
      groupName: "LifeBudget",
      identification: "LifeBudget",
      processPath: "/opt/homebrew/bin/node",
      command: "node node_modules/.bin/vite",
      workingDirectory:
        "/Users/jp/Documents/Dev/Projet/Perso/portfolio/2026/LifeBudget",
      uptimeSeconds: 680,
      startedAt: now - 680,
      cpuUsage: 3.4,
      activeConnections: 2,
    }),
    record({
      id: "docker-5432",
      port: 5432,
      pid: 4141,
      processName: "com.docker.backend",
      groupName: "Docker Desktop",
      identification: "llm_postgres",
      dockerContainerId: "7fcb8e20e3db",
      category: "application",
      localAddress: "0.0.0.0",
      scope: "network",
      processPath: "/Applications/Docker.app/Contents/MacOS/com.docker.backend",
      command: "Conteneur Docker · product-database-db",
      uptimeSeconds: 28 * 86_400,
      startedAt: now - 28 * 86_400,
      activeConnections: 3,
    }),
    record({
      id: "docker-4401",
      port: 4401,
      pid: 4141,
      processName: "com.docker.backend",
      groupName: "Docker Desktop",
      identification: "guessly-mig",
      dockerContainerId: "86e7b3b652fb",
      category: "application",
      localAddress: "0.0.0.0",
      scope: "network",
      processPath: "/Applications/Docker.app/Contents/MacOS/com.docker.backend",
      command: "Conteneur Docker · guessly-web:mig",
      uptimeSeconds: 14 * 86_400,
      startedAt: now - 14 * 86_400,
    }),
    record({
      id: "docker-8000",
      port: 8000,
      pid: 4141,
      processName: "com.docker.backend",
      groupName: "Docker Desktop",
      identification: "llm_api",
      dockerContainerId: "532041d742d5",
      category: "application",
      localAddress: "0.0.0.0",
      scope: "network",
      processPath: "/Applications/Docker.app/Contents/MacOS/com.docker.backend",
      command: "Conteneur Docker · product-database-api",
      uptimeSeconds: 2 * 86_400,
      startedAt: now - 2 * 86_400,
      activeConnections: 1,
    }),
    ...[80, 443].map((port) =>
      record({
        id: `local-nginx-${port}`,
        port,
        pid: 28715,
        processName: "nginx",
        groupName: "Local",
        identification: "alyafront hub",
        category: "application",
        localAddress: "0.0.0.0",
        scope: "network",
        processPath:
          "/Users/jp/Library/Application Support/Local/lightning-services/nginx/sbin/nginx",
        command: "nginx -c Local/run/router/nginx.conf",
        uptimeSeconds: 31 * 86_400,
        startedAt: now - 31 * 86_400,
      })
    ),
    ...[10000, 10001].map((port) =>
      record({
        id: `local-mailpit-${port}`,
        port,
        pid: 28563,
        processName: "mailpit",
        groupName: "Local",
        identification: "alyafront hub",
        category: "application",
        localAddress: "0.0.0.0",
        scope: "network",
        processPath:
          "/Users/jp/Library/Application Support/Local/lightning-services/mailpit/bin/mailpit",
        uptimeSeconds: 31 * 86_400,
        startedAt: now - 31 * 86_400,
      })
    ),
    record({
      id: "system-22",
      port: 22,
      pid: 1,
      processName: "launchd",
      groupName: "Services macOS",
      identification: "SSH",
      category: "system",
      localAddress: "0.0.0.0",
      scope: "network",
      processPath: "/sbin/launchd",
      uptimeSeconds: 32 * 86_400,
      startedAt: now - 32 * 86_400,
      protected: true,
      protectionReasons: [
        { kind: "systemDefault", ruleId: null },
        { kind: "rule", ruleId: "port-22" },
      ],
    }),
    record({
      id: "system-53",
      port: 53,
      pid: 414,
      processName: "mDNSResponder",
      groupName: "Services macOS",
      identification: "DNS local",
      category: "system",
      localAddress: "0.0.0.0",
      scope: "network",
      processPath: "/usr/sbin/mDNSResponder",
      protected: true,
      protectionReasons: [
        { kind: "systemDefault", ruleId: null },
        { kind: "rule", ruleId: "port-53" },
      ],
    }),
    ...[5000, 7000].map((port) =>
      record({
        id: `system-control-${port}`,
        port,
        pid: 785,
        processName: "ControlCenter",
        groupName: "Services macOS",
        identification: "AirPlay",
        category: "system",
        localAddress: "0.0.0.0",
        scope: "network",
        processPath:
          "/System/Library/CoreServices/ControlCenter.app/Contents/MacOS/ControlCenter",
        protected: true,
        protectionReasons: [{ kind: "systemDefault", ruleId: null }],
      })
    ),
    // Deux serveurs MCP identiques, un par session d'agent : même dossier hérité,
    // lanceurs distincts. Ni des doublons à nettoyer, ni des projets Sillage.
    ...[24186, 21857].map((port, index) =>
      record({
        id: `mcp-toolbox-${port}`,
        port,
        pid: 79388 + index * 9253,
        parentPid: 79329 + index * 9234,
        launcher: "Claude Code",
        launcherPid: 79329 + index * 9234,
        ai: true,
        processName: "toolbox",
        groupName: "Sillage",
        identification: "Sillage",
        processPath: "/usr/local/bin/toolbox",
        command: `/usr/local/bin/toolbox --prebuilt bigquery --stdio -p ${port}`,
        workingDirectory:
          "/Users/jp/Documents/Dev/Projet/Perso/portfolio/2026/Sillage",
        uptimeSeconds: 240 + index * 90,
        cpuUsage: 0,
      })
    ),
  ],
};

export const mockSettings: AppSettings = {
  theme: "dark",
  language: "en",
  protectSystemProcesses: true,
  rules: [
    {
      id: "port-22",
      label: "SSH",
      kind: "port",
      value: "22",
      enabled: true,
      builtin: true,
    },
    {
      id: "port-53",
      label: "DNS et découverte locale",
      kind: "port",
      value: "53",
      enabled: true,
      builtin: true,
    },
    {
      id: "process-launchd",
      label: "launchd",
      kind: "process",
      value: "launchd",
      enabled: true,
      builtin: true,
    },
    {
      id: "process-mdns",
      label: "mDNSResponder",
      kind: "process",
      value: "mDNSResponder",
      enabled: true,
      builtin: true,
    },
    {
      id: "path-system",
      label: "Chemin système",
      kind: "path",
      value: "/System/Library/",
      enabled: true,
      builtin: true,
    },
  ],
};
