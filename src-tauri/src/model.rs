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
    pub launcher: Option<String>,
    pub launcher_pid: Option<u32>,
    pub process_name: String,
    pub process_path: Option<String>,
    pub command: Option<String>,
    pub working_directory: Option<String>,
    pub group_name: String,
    pub identification: String,
    pub docker_container_id: Option<String>,
    pub category: String,
    pub ai: bool,
    pub started_at: Option<u64>,
    pub uptime_seconds: Option<u64>,
    pub cpu_usage: f32,
    pub memory_bytes: u64,
    pub active_connections: u32,
    pub protected: bool,
    pub protection_reasons: Vec<ProtectionReason>,
}

/// Motif de protection sous forme d'identifiant. L'interface le traduit; le
/// backend le décrit en clair uniquement pour ses propres messages d'erreur.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtectionReason {
    pub kind: String,
    pub rule_id: Option<String>,
}

impl ProtectionReason {
    pub const SYSTEM_DEFAULT: &'static str = "systemDefault";
    pub const SYSTEM_MAIN: &'static str = "systemMain";
    pub const RULE: &'static str = "rule";

    pub fn system_default() -> Self {
        Self {
            kind: Self::SYSTEM_DEFAULT.into(),
            rule_id: None,
        }
    }

    pub fn system_main() -> Self {
        Self {
            kind: Self::SYSTEM_MAIN.into(),
            rule_id: None,
        }
    }

    pub fn rule(rule_id: &str) -> Self {
        Self {
            kind: Self::RULE.into(),
            rule_id: Some(rule_id.into()),
        }
    }
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
    "en".into()
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

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerStopRequest {
    pub container_id: String,
    pub force: bool,
}
