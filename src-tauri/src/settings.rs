use std::{
    fs,
    path::{Path, PathBuf},
};

use tauri::{AppHandle, Manager};

use crate::model::{AppSettings, PortRecord, ProtectionRule};

const SETTINGS_FILE: &str = "settings.json";
const LEGACY_APP_IDENTIFIER: &str = "ca.jplefebvre.connexions-locales";

pub fn default_settings() -> AppSettings {
    let mut rules = vec![
        rule("port-22", "SSH", "port", "22"),
        rule("port-53", "DNS et découverte locale", "port", "53"),
        rule("process-launchd", "launchd", "process", "launchd"),
        rule("process-mdns", "mDNSResponder", "process", "mDNSResponder"),
        rule(
            "process-rapportd",
            "Continuité Apple",
            "process",
            "rapportd",
        ),
        rule(
            "process-control-center",
            "Centre de contrôle / AirPlay",
            "process",
            "ControlCenter",
        ),
        rule("process-sharingd", "Partage Apple", "process", "sharingd"),
        rule("process-systemd", "systemd", "process", "systemd"),
        rule("process-init", "init", "process", "init"),
        rule("process-system", "Windows System", "process", "System"),
        rule(
            "process-services",
            "Services Windows",
            "process",
            "services.exe",
        ),
    ];

    for path in [
        "/System/Library/",
        "/usr/libexec/",
        "C:\\Windows\\System32\\",
    ] {
        rules.push(rule(
            &format!("path-{}", slug(path)),
            "Chemin système",
            "path",
            path,
        ));
    }

    AppSettings {
        theme: "dark".into(),
        language: "en".into(),
        protect_system_processes: true,
        rules,
    }
}

fn rule(id: &str, label: &str, kind: &str, value: &str) -> ProtectionRule {
    ProtectionRule {
        id: id.into(),
        label: label.into(),
        kind: kind.into(),
        value: value.into(),
        enabled: true,
        builtin: true,
    }
}

fn slug(value: &str) -> String {
    value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .collect::<String>()
        .to_lowercase()
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|directory| directory.join(SETTINGS_FILE))
        .map_err(|error| format!("Impossible de localiser les réglages : {error}"))
}

pub fn load_settings(app: &AppHandle) -> AppSettings {
    let Ok(path) = settings_path(app) else {
        return default_settings();
    };

    if let Some(settings) = read_settings(&path) {
        return settings;
    }

    if let Some(legacy_path) = legacy_settings_path(&path) {
        if let Some(settings) = read_settings(&legacy_path) {
            if let Some(parent) = path.parent() {
                let _ = fs::create_dir_all(parent);
                let _ = fs::copy(legacy_path, path);
            }
            return settings;
        }
    }

    default_settings()
}

fn read_settings(path: &Path) -> Option<AppSettings> {
    fs::read_to_string(path)
        .ok()
        .and_then(|contents| serde_json::from_str(&contents).ok())
}

fn legacy_settings_path(current_path: &Path) -> Option<PathBuf> {
    let config_root = current_path.parent()?.parent()?;
    Some(config_root.join(LEGACY_APP_IDENTIFIER).join(SETTINGS_FILE))
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> AppSettings {
    load_settings(&app)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, mut settings: AppSettings) -> Result<AppSettings, String> {
    if !matches!(settings.theme.as_str(), "dark" | "light" | "system") {
        settings.theme = "dark".into();
    }
    if !matches!(settings.language.as_str(), "fr" | "en") {
        settings.language = "en".into();
    }

    settings.rules.retain(|rule| {
        matches!(rule.kind.as_str(), "port" | "process" | "path") && !rule.value.trim().is_empty()
    });

    let path = settings_path(&app)?;
    let parent = path
        .parent()
        .ok_or_else(|| "Dossier de réglages invalide".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Impossible de créer le dossier de réglages : {error}"))?;

    let temporary_path = path.with_extension("json.tmp");
    let contents = serde_json::to_string_pretty(&settings)
        .map_err(|error| format!("Impossible d’encoder les réglages : {error}"))?;
    fs::write(&temporary_path, contents)
        .map_err(|error| format!("Impossible d’écrire les réglages : {error}"))?;

    if path.exists() {
        fs::remove_file(&path)
            .map_err(|error| format!("Impossible de remplacer les réglages : {error}"))?;
    }
    fs::rename(&temporary_path, &path)
        .map_err(|error| format!("Impossible de finaliser les réglages : {error}"))?;

    Ok(settings)
}

pub fn protection_reasons(settings: &AppSettings, record: &PortRecord) -> Vec<String> {
    let mut reasons = Vec::new();

    if settings.protect_system_processes && record.category == "system" {
        reasons.push("Service du système protégé par défaut".into());
    }
    if record.pid == Some(1) {
        reasons.push("Le processus principal du système ne peut pas être arrêté".into());
    }

    for rule in settings.rules.iter().filter(|rule| rule.enabled) {
        let matches = match rule.kind.as_str() {
            "port" => rule.value.parse::<u16>().ok() == Some(record.port),
            "process" => record.process_name.eq_ignore_ascii_case(rule.value.trim()),
            "path" => [
                record.process_path.as_deref(),
                record.working_directory.as_deref(),
            ]
            .into_iter()
            .flatten()
            .any(|path| starts_with_case_insensitive(path, rule.value.trim())),
            _ => false,
        };

        if matches {
            reasons.push(rule.label.clone());
        }
    }

    reasons.sort();
    reasons.dedup();
    reasons
}

fn starts_with_case_insensitive(value: &str, prefix: &str) -> bool {
    value
        .get(..prefix.len())
        .is_some_and(|candidate| candidate.eq_ignore_ascii_case(prefix))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_protect_ssh_and_system_services() {
        let settings = default_settings();
        assert_eq!(settings.language, "en");
        let mut record = sample_record();
        record.port = 22;
        assert!(!protection_reasons(&settings, &record).is_empty());

        record.port = 8123;
        record.category = "system".into();
        assert!(protection_reasons(&settings, &record)
            .iter()
            .any(|reason| reason.contains("système")));
    }

    #[test]
    fn old_settings_without_language_default_to_english() {
        let settings: AppSettings =
            serde_json::from_str(r#"{"theme":"dark","protectSystemProcesses":true,"rules":[]}"#)
                .expect("legacy settings should deserialize");
        assert_eq!(settings.language, "en");
    }

    #[test]
    fn path_rules_match_working_directories_without_protecting_sibling_projects() {
        let mut settings = default_settings();
        settings.protect_system_processes = false;
        settings.rules = vec![ProtectionRule {
            id: "project-a".into(),
            label: "Projet A".into(),
            kind: "path".into(),
            value: "/Users/jp/Projects/client-a/api".into(),
            enabled: true,
            builtin: false,
        }];

        let mut protected = sample_record();
        protected.process_name = "node".into();
        protected.working_directory = Some("/Users/jp/Projects/client-a/api".into());
        assert_eq!(protection_reasons(&settings, &protected), vec!["Projet A"]);

        protected.working_directory = Some("/Users/jp/Projects/client-b/api".into());
        assert!(protection_reasons(&settings, &protected).is_empty());
    }

    #[test]
    fn resolves_the_legacy_settings_location_next_to_portroot() {
        let current = Path::new("/config/ca.jplefebvre.portroot/settings.json");
        assert_eq!(
            legacy_settings_path(current),
            Some(PathBuf::from(
                "/config/ca.jplefebvre.connexions-locales/settings.json"
            ))
        );
    }

    fn sample_record() -> PortRecord {
        PortRecord {
            id: "tcp-127.0.0.1-8123-42".into(),
            protocol: "TCP".into(),
            local_address: "127.0.0.1".into(),
            port: 8123,
            scope: "local".into(),
            pid: Some(42),
            parent_pid: Some(1),
            process_name: "example".into(),
            process_path: Some("/tmp/example".into()),
            command: None,
            working_directory: Some("/tmp".into()),
            group_name: "tmp".into(),
            identification: "example".into(),
            docker_container_id: None,
            category: "other".into(),
            started_at: None,
            uptime_seconds: None,
            cpu_usage: 0.0,
            memory_bytes: 0,
            active_connections: 0,
            protected: false,
            protection_reasons: Vec::new(),
        }
    }
}
