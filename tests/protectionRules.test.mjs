import assert from "node:assert/strict";
import test from "node:test";
import { buildProcessTree } from "../src/lib/processTree.ts";
import { describeProtectionReasons, getProtectionControl, matchedRuleIds } from "../src/lib/protectionRules.ts";

// Les correspondances sont décidées par le moteur Rust : ces enregistrements
// représentent ce qu'il renvoie, et l'interface n'a plus qu'à les lire.
const containerNames = [
  ["brandtracker-staging-db", "1ce9aee0c916", 55432],
  ["gaio-local-db", "ecb10d01ce9b", 5439],
  ["llm_api", "532041d742d5", 8000],
  ["llm_postgres", "7fcb8e20e3db", 5432],
];

function containersProtectedBy(ruleId, onlyIdentification = null) {
  return containerNames.map(([name, containerId, port], index) =>
    dockerRecord(String(name), String(containerId), Number(port), index, {
      protectionReasons:
        !onlyIdentification || onlyIdentification === name
          ? [{ kind: "rule", ruleId }]
          : [],
    }),
  );
}

test("reports the full impact of a shared custom Docker path rule", () => {
  const sharedRule = {
    id: "custom-docker-path",
    label: "Docker Desktop",
    kind: "path",
    value: "/Users/jp/Library/Containers/com.docker.docker/Data",
    enabled: true,
    builtin: false,
  };
  const records = containersProtectedBy(sharedRule.id);
  const settings = { theme: "dark", language: "en", protectSystemProcesses: true, rules: [sharedRule] };
  const process = findProcess(records, "llm_api");

  const control = getProtectionControl(process, settings, records);

  assert.equal(control.action, "remove");
  assert.deepEqual(control.removableRules.map((rule) => rule.id), [sharedRule.id]);
  assert.equal(control.affectedProcessCount, 4);
  assert.equal(control.affectedPortCount, 4);
});

test("limits the impact to the containers the engine actually flagged", () => {
  const containerRule = {
    id: "container-llm-api",
    label: "LLM API",
    kind: "container",
    value: "llm_api",
    enabled: true,
    builtin: false,
  };
  const records = containersProtectedBy(containerRule.id, "llm_api");
  const settings = { theme: "dark", language: "en", protectSystemProcesses: true, rules: [containerRule] };

  const control = getProtectionControl(findProcess(records, "llm_api"), settings, records);

  assert.equal(control.action, "remove");
  assert.equal(control.affectedProcessCount, 1);
  assert.equal(control.affectedPortCount, 1);
  assert.deepEqual([...matchedRuleIds(records)], [containerRule.id]);
});

test("routes built-in protections to settings instead of offering direct removal", () => {
  const builtinRule = {
    id: "builtin-docker-path",
    label: "Protected by default",
    kind: "path",
    value: "/Users/jp/Library/Containers/com.docker.docker/Data",
    enabled: true,
    builtin: true,
  };
  const records = containersProtectedBy(builtinRule.id);
  const settings = { theme: "dark", language: "en", protectSystemProcesses: true, rules: [builtinRule] };

  const control = getProtectionControl(findProcess(records, "llm_api"), settings, records);
  assert.equal(control.action, "manage");
  assert.equal(control.removableRules.length, 0);
});

test("a system reason cannot be removed from the inspector", () => {
  const records = containerNames.map(([name, containerId, port], index) =>
    dockerRecord(String(name), String(containerId), Number(port), index, {
      protectionReasons: [{ kind: "systemDefault", ruleId: null }],
    }),
  );
  const settings = { theme: "dark", language: "en", protectSystemProcesses: true, rules: [] };

  assert.equal(getProtectionControl(findProcess(records, "llm_api"), settings, records).action, "manage");
});

test("translates engine reason identifiers in both languages", () => {
  const rules = [
    { id: "port-53", label: "DNS et découverte locale", kind: "port", value: "53", enabled: true, builtin: true },
    { id: "custom-1", label: "My dev server", kind: "port", value: "3000", enabled: true, builtin: false },
  ];
  const records = [
    dockerRecord("llm_api", "532041d742d5", 8000, 0, {
      protectionReasons: [
        { kind: "systemDefault", ruleId: null },
        { kind: "rule", ruleId: "port-53" },
        { kind: "rule", ruleId: "custom-1" },
        { kind: "rule", ruleId: "disparue" },
      ],
    }),
  ];

  assert.deepEqual(describeProtectionReasons(records, rules, "en"), [
    "System service protected by default",
    "DNS and local discovery",
    "My dev server",
    "Protection rule",
  ]);
  assert.deepEqual(describeProtectionReasons(records, rules, "fr").slice(0, 2), [
    "Service du système protégé par défaut",
    "DNS et découverte locale",
  ]);
});

function findProcess(records, identification) {
  const groups = buildProcessTree(records, "all", "", "name", "en", "ascending");
  const process = groups.flatMap((group) => group.processes).find((candidate) => candidate.identification === identification);
  assert.ok(process);
  return process;
}

function dockerRecord(identification, dockerContainerId, port, index, overrides = {}) {
  const protectionReasons = overrides.protectionReasons ?? [];
  return {
    id: `tcp-${port}-${dockerContainerId}`,
    protocol: "TCP",
    localAddress: "0.0.0.0",
    port,
    scope: "network",
    pid: 4141,
    parentPid: 4119,
    launcher: null,
    launcherPid: null,
    ai: false,
    processName: "com.docker.backend",
    processPath: "/Applications/Docker.app/Contents/MacOS/com.docker.backend",
    command: `Docker container · ${identification}`,
    workingDirectory: "/Users/jp/Library/Containers/com.docker.docker/Data",
    groupName: "Docker Desktop",
    identification,
    dockerContainerId,
    category: "application",
    startedAt: 1_700_000_000_000 + index,
    uptimeSeconds: 10_000,
    cpuUsage: 0.1,
    memoryBytes: 64_000_000,
    activeConnections: 2,
    protected: protectionReasons.length > 0,
    protectionReasons,
  };
}
