import assert from "node:assert/strict";
import test from "node:test";
import {
  assessDuplicateProcesses,
  buildProcessTree,
  defaultSortDirection,
  normalizeDuplicateCommand,
  processIdentityKey,
} from "../src/lib/processTree.ts";

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

test("confirms independent duplicate servers when only their port differs", () => {
  const first = record({ command: "python -m uvicorn app.main:app --host 127.0.0.1 --port 5305", port: 5305 });
  const second = record({
    id: "tcp-127.0.0.1-5306-43",
    pid: 43,
    command: "python -m uvicorn app.main:app --host 127.0.0.1 --port 5306",
    port: 5306,
  });

  const assessment = assessDuplicateProcesses([first, second]);
  assert.equal(assessment.confidence, "confirmed");
  assert.equal(assessment.instanceCount, 2);
  assert.ok(assessment.evidence.includes("sameCommand"));
  assert.ok(assessment.evidence.includes("independentProcesses"));
  assert.equal(assessment.normalizedCommand, "python -m uvicorn app.main:app --host 127.0.0.1 --port=<port>");

  const process = buildProcessTree([first, second], "all", "", "evaluation")
    .flatMap((group) => group.processes)[0];
  assert.equal(process.evaluation, "duplicateConfirmed");
});

test("keeps materially different commands at possible confidence", () => {
  const first = record({ command: "node api.js", port: 3000 });
  const second = record({ id: "worker", pid: 43, command: "node worker.js", port: 3001 });

  const assessment = assessDuplicateProcesses([first, second]);
  assert.equal(assessment.confidence, "possible");
  assert.ok(assessment.evidence.includes("differentCommands"));
});

test("recognizes parent-child workers instead of calling them duplicates", () => {
  const first = record({ command: "node server.js --port 3000", port: 3000 });
  const second = record({ id: "child", pid: 43, parentPid: 42, command: "node server.js --port 3001", port: 3001 });

  const assessment = assessDuplicateProcesses([first, second]);
  assert.equal(assessment.confidence, "managed");
  assert.ok(assessment.evidence.includes("parentChild"));
});

test("recognizes an explicit multi-worker runtime", () => {
  const first = record({ command: "uvicorn api:app --workers 4 --port 3000", port: 3000 });
  const second = record({ id: "worker-2", pid: 43, command: "uvicorn api:app --workers 4 --port 3001", port: 3001 });

  const assessment = assessDuplicateProcesses([first, second]);
  assert.equal(assessment.confidence, "managed");
  assert.ok(assessment.evidence.includes("managedRuntime"));
});

test("normalizes common port syntaxes without erasing other arguments", () => {
  assert.equal(normalizeDuplicateCommand("uvicorn api:app --port=5305 --reload", [5305]), "uvicorn api:app --port=<port> --reload");
  assert.equal(normalizeDuplicateCommand("PORT=5305 node server.js", [5305]), "PORT=<port> node server.js");
  assert.equal(normalizeDuplicateCommand("gunicorn api:app --bind 127.0.0.1:5305", [5305]), "gunicorn api:app --bind 127.0.0.1:<port>");
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

test("sorts top-level project groups from the Item column", () => {
  const records = [
    record({ id: "charlie", groupName: "Charlie", identification: "Charlie worker", workingDirectory: "/projects/charlie" }),
    record({ id: "alpha", groupName: "Alpha", identification: "Alpha worker", workingDirectory: "/projects/alpha" }),
    record({ id: "bravo", groupName: "Bravo", identification: "Bravo worker", workingDirectory: "/projects/bravo" }),
    record({
      id: "system",
      groupName: "System services",
      identification: "System worker",
      workingDirectory: "/System/Library",
      category: "system",
      protected: true,
    }),
  ];
  const groupLabels = (sort, direction) => buildProcessTree(records, "all", "", sort, "en", direction)
    .map((group) => group.label);

  assert.deepEqual(groupLabels("name", "ascending"), ["Alpha", "Bravo", "Charlie", "System services"]);
  assert.deepEqual(groupLabels("name", "descending"), ["Charlie", "Bravo", "Alpha", "System services"]);
  assert.deepEqual(groupLabels("port", "descending"), ["Alpha", "Bravo", "Charlie", "System services"]);
});

test("uses natural default directions for every sortable column", () => {
  assert.equal(defaultSortDirection("name"), "ascending");
  assert.equal(defaultSortDirection("port"), "ascending");
  assert.equal(defaultSortDirection("scope"), "descending");
  assert.equal(defaultSortDirection("activity"), "descending");
  assert.equal(defaultSortDirection("evaluation"), "descending");
});
