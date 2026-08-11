import assert from "node:assert/strict";
import test from "node:test";
import { getProcessInstances, getSuggestedKeepPid } from "../src/lib/processActions.ts";

function processWith(records) {
  return {
    id: "python::brandtracker",
    name: "python",
    identification: "brandtracker",
    groupName: "brandtracker",
    category: "other",
    records,
    pids: [...new Set(records.map((record) => record.pid))],
    workingDirectory: "/projects/brandtracker",
    processPath: "/projects/brandtracker/.venv/bin/python",
    command: "python -m uvicorn app.main:app --port 5305",
    dockerContainerId: null,
    evaluation: "duplicateConfirmed",
    protected: false,
    duplicate: true,
    duplicateAssessment: { confidence: "confirmed", instanceCount: records.length, evidence: [], normalizedCommand: null },
    exposed: false,
    activityScore: 1,
    cpuUsage: 0,
    activeConnections: 0,
    uptimeSeconds: 100,
  };
}

function record(pid, port, startedAt, protectedProcess = false) {
  return {
    id: `${pid}-${port}`,
    pid,
    port,
    startedAt,
    protected: protectedProcess,
  };
}

test("preselects the newest duplicate instance to keep", () => {
  const process = processWith([
    record(42, 5305, 100),
    record(43, 5306, 200),
    record(44, 5307, 300),
  ]);

  assert.equal(getSuggestedKeepPid(process), 44);
  assert.deepEqual(getProcessInstances(process).map((instance) => instance.ports), [[5305], [5306], [5307]]);
});

test("keeps a protected instance even when it is older", () => {
  const process = processWith([
    record(42, 5305, 100, true),
    record(43, 5306, 300),
  ]);

  assert.equal(getSuggestedKeepPid(process), 42);
  assert.equal(getProcessInstances(process)[0].protected, true);
});
