export type ThemeMode = "dark" | "light" | "system";
export type Language = "fr" | "en";
export type Category = "application" | "system" | "other";
export type Scope = "local" | "network";
export type NavFilter = "all" | Category | "protected";
export type SortMode = "evaluation" | "port" | "activity" | "age";

export interface PortRecord {
  id: string;
  protocol: "TCP" | "UDP";
  localAddress: string;
  port: number;
  scope: Scope;
  pid: number | null;
  parentPid: number | null;
  processName: string;
  processPath: string | null;
  command: string | null;
  workingDirectory: string | null;
  groupName: string;
  identification: string;
  category: Category;
  startedAt: number | null;
  uptimeSeconds: number | null;
  cpuUsage: number;
  memoryBytes: number;
  activeConnections: number;
  protected: boolean;
  protectionReasons: string[];
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
  kind: "port" | "process" | "path";
  value: string;
  enabled: boolean;
  builtin: boolean;
}

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

export type Evaluation = "protected" | "duplicate" | "exposed" | "review" | "active" | "ok";

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
  evaluation: Evaluation;
  protected: boolean;
  duplicate: boolean;
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
