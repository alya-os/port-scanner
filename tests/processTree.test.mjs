import assert from "node:assert/strict";
import test from "node:test";
import { buildProcessTree, defaultSortDirection, processIdentityKey } from "../src/lib/processTree.ts";

function record(overrides = {}) {
  return {
    id: "tcp-127.0.0.1-3000-42",
    protocol: "TCP",
    localAddress: "127.0.0.1",
    port: 3000,
    scope: "local",
    pid: 42,
    parentPid: 1,
    processName: "node",
    processPath: "/opt/homebrew/bin/node",
    command: "node server.js",
    workingDirectory: "/Users/jp/Projects/client-a/api",
    groupName: "api",
    identification: "Node · api",
    dockerContainerId: null,
    category: "other",
    startedAt: 1,
    uptimeSeconds: 60,
    cpuUsage: 0.2,
    memoryBytes: 1024,
    activeConnections: 0,
    protected: false,
    protectionReasons: [],
    ...overrides,
  };
}

test("keeps same-named projects from different folders separate", () => {
  const first = record();
  const second = record({
    id: "tcp-127.0.0.1-3001-43",
    port: 3001,
    pid: 43,
    workingDirectory: "/Users/jp/Projects/client-b/api",
  });

  assert.notEqual(processIdentityKey(first), processIdentityKey(second));
  const groups = buildProcessTree([first, second], "all", "", "evaluation");
  assert.equal(groups.flatMap((group) => group.processes).length, 2);
});

test("keeps Docker containers separate even when they share the backend PID", () => {
  const first = record({
    id: "docker-4401",
    port: 4401,
    processName: "com.docker.backend",
    groupName: "Docker Desktop",
    identification: "guessly-mig",
    dockerContainerId: "86e7b3b652fb",
  });
  const second = record({
    id: "docker-8000",
    port: 8000,
    processName: "com.docker.backend",
    groupName: "Docker Desktop",
    identification: "llm_api",
    dockerContainerId: "532041d742d5",
  });

  const processes = buildProcessTree([first, second], "all", "", "evaluation")
    .flatMap((group) => group.processes);

  assert.equal(processes.length, 2);
  assert.deepEqual(processes.map((process) => process.dockerContainerId), ["86e7b3b652fb", "532041d742d5"]);
});

test("groups ports that belong to the same executable and working folder", () => {
  const first = record();
  const second = record({ id: "tcp-127.0.0.1-3001-42", port: 3001 });

  const processes = buildProcessTree([first, second], "all", "", "evaluation")
    .flatMap((group) => group.processes);
  assert.equal(processes.length, 1);
  assert.deepEqual(processes[0].records.map((item) => item.port), [3000, 3001]);
});

test("sorts process columns in both directions", () => {
  const records = [
    record({ id: "alpha", identification: "Alpha", port: 3000, uptimeSeconds: 4000, cpuUsage: 1 }),
    record({ id: "bravo", identification: "Bravo", port: 1000, scope: "network", localAddress: "0.0.0.0", activeConnections: 3, uptimeSeconds: 4000 }),
    record({ id: "charlie", identification: "Charlie", port: 2000, uptimeSeconds: 4000, cpuUsage: 0 }),
  ];
  const identities = (sort, direction) => buildProcessTree(records, "all", "", sort, "fr", direction)
    .flatMap((group) => group.processes)
    .map((process) => process.identification);

  assert.deepEqual(identities("name", "ascending"), ["Alpha", "Bravo", "Charlie"]);
  assert.deepEqual(identities("name", "descending"), ["Charlie", "Bravo", "Alpha"]);
  assert.deepEqual(identities("port", "ascending"), ["Bravo", "Charlie", "Alpha"]);
  assert.deepEqual(identities("scope", "descending"), ["Bravo", "Alpha", "Charlie"]);
  assert.deepEqual(identities("activity", "descending"), ["Bravo", "Alpha", "Charlie"]);
  assert.deepEqual(identities("evaluation", "descending"), ["Bravo", "Alpha", "Charlie"]);
});

test("uses natural default directions for every sortable column", () => {
  assert.equal(defaultSortDirection("name"), "ascending");
  assert.equal(defaultSortDirection("port"), "ascending");
  assert.equal(defaultSortDirection("scope"), "descending");
  assert.equal(defaultSortDirection("activity"), "descending");
  assert.equal(defaultSortDirection("evaluation"), "descending");
});
