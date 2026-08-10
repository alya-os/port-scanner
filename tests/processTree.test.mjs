import assert from "node:assert/strict";
import test from "node:test";
import { buildProcessTree, processIdentityKey } from "../src/lib/processTree.ts";

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

test("groups ports that belong to the same executable and working folder", () => {
  const first = record();
  const second = record({ id: "tcp-127.0.0.1-3001-42", port: 3001 });

  const processes = buildProcessTree([first, second], "all", "", "evaluation")
    .flatMap((group) => group.processes);
  assert.equal(processes.length, 1);
  assert.deepEqual(processes[0].records.map((item) => item.port), [3000, 3001]);
});
