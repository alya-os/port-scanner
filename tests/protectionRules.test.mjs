import assert from "node:assert/strict";
import test from "node:test";
import { buildProcessTree } from "../src/lib/processTree.ts";
import { getProtectionControl, ruleMatchesRecord } from "../src/lib/protectionRules.ts";

const dockerContainers = [
  ["brandtracker-staging-db", "1ce9aee0c916", 55432],
  ["gaio-local-db", "ecb10d01ce9b", 5439],
  ["llm_api", "532041d742d5", 8000],
  ["llm_postgres", "7fcb8e20e3db", 5432],
].map(([name, containerId, port], index) => dockerRecord(String(name), String(containerId), Number(port), index));

test("reports the full impact of a shared custom Docker path rule", () => {
  const sharedRule = {
    id: "custom-docker-path",
    label: "Docker Desktop",
    kind: "path",
    value: "/Users/jp/Library/Containers/com.docker.docker/Data",
    enabled: true,
    builtin: false,
  };
  const settings = { theme: "dark", language: "en", protectSystemProcesses: true, rules: [sharedRule] };
  const process = findProcess(dockerContainers, "llm_api");

  const control = getProtectionControl(process, settings, dockerContainers);

  assert.equal(control.action, "remove");
  assert.deepEqual(control.removableRules.map((rule) => rule.id), [sharedRule.id]);
  assert.equal(control.affectedProcessCount, 4);
  assert.equal(control.affectedPortCount, 4);
});

test("matches a container rule by stable container name without protecting its neighbors", () => {
  const containerRule = {
    id: "container-llm-api",
    label: "LLM API",
    kind: "container",
    value: "llm_api",
    enabled: true,
    builtin: false,
  };

  assert.equal(ruleMatchesRecord(containerRule, dockerContainers[2]), true);
  assert.equal(ruleMatchesRecord(containerRule, dockerContainers[3]), false);

  const settings = { theme: "dark", language: "en", protectSystemProcesses: true, rules: [containerRule] };
  const control = getProtectionControl(findProcess(dockerContainers, "llm_api"), settings, dockerContainers);
  assert.equal(control.action, "remove");
  assert.equal(control.affectedProcessCount, 1);
  assert.equal(control.affectedPortCount, 1);
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
  const settings = { theme: "dark", language: "en", protectSystemProcesses: true, rules: [builtinRule] };

  const control = getProtectionControl(findProcess(dockerContainers, "llm_api"), settings, dockerContainers);
  assert.equal(control.action, "manage");
  assert.equal(control.removableRules.length, 0);
});

function findProcess(records, identification) {
  const groups = buildProcessTree(records, "all", "", "name", "en", "ascending");
  const process = groups.flatMap((group) => group.processes).find((candidate) => candidate.identification === identification);
  assert.ok(process);
  return process;
}

function dockerRecord(identification, dockerContainerId, port, index) {
  return {
    id: `tcp-${port}-${dockerContainerId}`,
    protocol: "TCP",
    localAddress: "0.0.0.0",
    port,
    scope: "network",
    pid: 4141,
    parentPid: 4119,
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
    protected: true,
    protectionReasons: ["Docker Desktop"],
  };
}
