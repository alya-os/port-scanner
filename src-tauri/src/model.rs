use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortRecord {
    pub id: String,
    pub protocol: String,
    pub local_address: String,
    pub port: u16,
    pub scope: String,
    pub pid: Option<u32>,
    pub parent_pid: Option<u32>,
    pub process_name: String,
    pub process_path: Option<String>,
    pub command: Option<String>,
    pub working_directory: Option<String>,
    pub group_name: String,
    pub identification: String,
    pub category: String,
    pub started_at: Option<u64>,
    pub uptime_seconds: Option<u64>,
    pub cpu_usage: f32,
    pub memory_bytes: u64,
    pub active_connections: u32,
    pub protected: bool,
    pub protection_reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub records: Vec<PortRecord>,
    pub scanned_at: u64,
    pub platform: String,
    pub permission_limited: bool,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProtectionRule {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub value: String,
    pub enabled: bool,
    pub builtin: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    #[serde(default = "default_language")]
    pub language: String,
    pub protect_system_processes: bool,
    pub rules: Vec<ProtectionRule>,
}

fn default_language() -> String {
    "fr".into()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionResult {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KillRequest {
    pub pid: u32,
    pub expected_start_time: Option<u64>,
    pub force: bool,
}
