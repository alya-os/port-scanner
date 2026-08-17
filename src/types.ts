export type ThemeMode = "dark" | "light" | "system";
export type Language = "fr" | "en";
export type Category = "application" | "system" | "other";
export type Scope = "local" | "network";
export type NavFilter = "all" | Category | "protected" | "ai";
export type SortMode = "name" | "port" | "scope" | "activity" | "evaluation";
export type SortDirection = "ascending" | "descending";
export type StopMode = "all" | "duplicates";

export interface PortRecord {
  id: string;
  protocol: "TCP" | "UDP";
  localAddress: string;
  port: number;
  scope: Scope;
  pid: number | null;
  parentPid: number | null;
  launcher: string | null;
  launcherPid: number | null;
  processName: string;
  processPath: string | null;
  command: string | null;
  workingDirectory: string | null;
  groupName: string;
  identification: string;
  dockerContainerId: string | null;
  category: Category;
  ai: boolean;
  startedAt: number | null;
  uptimeSeconds: number | null;
  cpuUsage: number;
  memoryBytes: number;
  activeConnections: number;
  protected: boolean;
  protectionReasons: ProtectionReason[];
}

// Motif renvoyé par le backend sous forme d'identifiant. L'interface le traduit.
export type ProtectionReasonKind = "systemDefault" | "systemMain" | "rule";

export interface ProtectionReason {
  kind: ProtectionReasonKind;
  ruleId: string | null;
}

export interface ScanResult {
  records: PortRecord[];
  scannedAt: number;
  platform: string;
  permissionLimited: boolean;
  warnings: string[];
}

export interface ProtectionRule {
  id: string;
  label: string;
  kind: "port" | "process" | "path" | "container";
  value: string;
  enabled: boolean;
  builtin: boolean;
}

export type ProtectionAction = "add" | "remove" | "manage";

export interface AppSettings {
  theme: ThemeMode;
  language: Language;
  protectSystemProcesses: boolean;
  rules: ProtectionRule[];
}

export interface ActionResult {
  success: boolean;
  message: string;
}

export interface KillRequest {
  pid: number;
  expectedStartTime: number | null;
  force: boolean;
}

export interface DockerStopRequest {
  containerId: string;
  force: boolean;
}

export type DuplicateConfidence = "none" | "possible" | "confirmed" | "managed";
export type DuplicateEvidence =
  | "sameExecutable"
  | "sameWorkingDirectory"
  | "sameCommand"
  | "differentPorts"
  | "independentProcesses"
  | "differentCommands"
  | "missingMetadata"
  | "parentChild"
  | "managedRuntime"
  | "agentManaged"
  | "sharedListener";

export interface DuplicateAssessment {
  confidence: DuplicateConfidence;
  instanceCount: number;
  evidence: DuplicateEvidence[];
  normalizedCommand: string | null;
}

export type Evaluation =
  | "protected"
  | "duplicateConfirmed"
  | "duplicatePossible"
  | "exposed"
  | "review"
  | "active"
  | "ok";

export interface ProcessNode {
  id: string;
  name: string;
  identification: string;
  groupName: string;
  category: Category;
  records: PortRecord[];
  pids: number[];
  workingDirectory: string | null;
  processPath: string | null;
  command: string | null;
  launcher: string | null;
  launcherPid: number | null;
  ai: boolean;
  dockerContainerId: string | null;
  evaluation: Evaluation;
  protected: boolean;
  duplicate: boolean;
  duplicateAssessment: DuplicateAssessment;
  exposed: boolean;
  activityScore: number;
  cpuUsage: number;
  activeConnections: number;
  uptimeSeconds: number | null;
}

export interface ProcessGroup {
  id: string;
  label: string;
  category: Category;
  processes: ProcessNode[];
  protected: boolean;
}
