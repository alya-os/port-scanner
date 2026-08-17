use std::{
    fs,
    path::{Path, PathBuf},
};

use tauri::{AppHandle, Manager};

use crate::model::{AppSettings, PortRecord, ProtectionReason, ProtectionRule};

const SETTINGS_FILE: &str = "settings.json";
const LEGACY_APP_IDENTIFIERS: [&str; 2] =
    ["ca.jplefebvre.portroot", "ca.jplefebvre.connexions-locales"];

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

    for legacy_path in legacy_settings_paths(&path) {
        if let Some(settings) = read_settings(&legacy_path) {
            if let Some(parent) = path.parent() {
                let _ = fs::create_dir_all(parent);
                if let Ok(contents) = serde_json::to_string_pretty(&settings) {
                    let _ = fs::write(&path, contents);
                }
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

fn legacy_settings_paths(current_path: &Path) -> Vec<PathBuf> {
    let Some(config_root) = current_path.parent().and_then(Path::parent) else {
        return Vec::new();
    };

    LEGACY_APP_IDENTIFIERS
        .into_iter()
        .map(|identifier| config_root.join(identifier).join(SETTINGS_FILE))
        .collect()
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
        matches!(
            rule.kind.as_str(),
            "port" | "process" | "path" | "container"
        ) && !rule.value.trim().is_empty()
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

/// Les motifs sont des identifiants, jamais du texte : l'interface est bilingue
/// et c'est elle qui traduit. Un motif de règle ne porte que l'identifiant de la
/// règle, dont le libellé est déjà connu des deux côtés.
pub fn protection_reasons(settings: &AppSettings, record: &PortRecord) -> Vec<ProtectionReason> {
    let mut reasons = Vec::new();

    if settings.protect_system_processes && record.category == "system" {
        reasons.push(ProtectionReason::system_default());
    }
    if record.pid == Some(1) {
        reasons.push(ProtectionReason::system_main());
    }

    for rule in settings.rules.iter().filter(|rule| rule.enabled) {
        if rule_matches_record(rule, record) {
            reasons.push(ProtectionReason::rule(&rule.id));
        }
    }

    reasons.dedup();
    reasons
}

pub fn rule_matches_record(rule: &ProtectionRule, record: &PortRecord) -> bool {
    let value = rule.value.trim();
    if value.is_empty() {
        return false;
    }

    match rule.kind.as_str() {
        "port" => value.parse::<u16>().ok() == Some(record.port),
        "process" => record.process_name.eq_ignore_ascii_case(value),
        "path" => [
            record.process_path.as_deref(),
            record.working_directory.as_deref(),
        ]
        .into_iter()
        .flatten()
        .any(|path| path_is_within(path, value)),
        "container" => {
            record.docker_container_id.is_some() && record.identification.eq_ignore_ascii_case(value)
        }
        _ => false,
    }
}

/// Rend les motifs lisibles pour les messages d'erreur du backend, qui n'ont pas
/// accès aux traductions de l'interface.
pub fn describe_protection_reasons(
    settings: &AppSettings,
    reasons: &[ProtectionReason],
) -> Vec<String> {
    let mut described = reasons
        .iter()
        .map(|reason| match reason.kind.as_str() {
            ProtectionReason::SYSTEM_DEFAULT => "Service du système protégé par défaut".to_string(),
            ProtectionReason::SYSTEM_MAIN => {
                "Le processus principal du système ne peut pas être arrêté".to_string()
            }
            _ => reason
                .rule_id
                .as_deref()
                .and_then(|id| settings.rules.iter().find(|rule| rule.id == id))
                .map(|rule| rule.label.clone())
                .unwrap_or_else(|| "Règle de protection".to_string()),
        })
        .collect::<Vec<_>>();

    described.sort();
    described.dedup();
    described
}

/// Vrai quand `path` est le dossier `prefix` lui-même ou quelque chose qu'il
/// contient. Un préfixe brut suffirait à faire protéger `client-a/api-v2` par une
/// règle posée sur `client-a/api` : la frontière doit tomber sur un séparateur.
fn path_is_within(path: &str, prefix: &str) -> bool {
    let prefix = prefix.trim_end_matches(is_path_separator);
    if prefix.is_empty() {
        // Une règle réduite à des séparateurs désigne la racine. On préfère
        // qu'elle protège tout plutôt que rien : ici, se tromper coûte un
        // processus qu'on n'arrête pas, pas un processus arrêté par erreur.
        return !path.is_empty();
    }

    // `get` échoue si la longueur ne tombe pas sur une frontière de caractère,
    // ce qui garantit que l'indexation qui suit ne peut pas paniquer.
    let Some(candidate) = path.get(..prefix.len()) else {
        return false;
    };
    if !candidate.eq_ignore_ascii_case(prefix) {
        return false;
    }

    match path[prefix.len()..].chars().next() {
        None => true,
        Some(character) => is_path_separator(character),
    }
}

fn is_path_separator(character: char) -> bool {
    character == '/' || character == '\\'
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
            .any(|reason| reason.kind == ProtectionReason::SYSTEM_DEFAULT));
    }

    #[test]
    fn old_settings_without_language_default_to_english() {
        let settings: AppSettings =
            serde_json::from_str(r#"{"theme":"dark","protectSystemProcesses":true,"rules":[]}"#)
                .expect("legacy settings should deserialize");
        assert_eq!(settings.language, "en");
    }

    #[test]
    fn migrated_legacy_settings_serialize_the_current_schema() {
        let settings: AppSettings =
            serde_json::from_str(r#"{"theme":"dark","protectSystemProcesses":true,"rules":[]}"#)
                .expect("legacy settings should deserialize");
        let serialized = serde_json::to_value(settings).expect("settings should serialize");

        assert_eq!(serialized["language"], "en");
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
        let is_protected = |directory: &str| {
            let mut record = protected.clone();
            record.working_directory = Some(directory.into());
            !protection_reasons(&settings, &record).is_empty()
        };

        // Le dossier lui-même et ce qu'il contient.
        assert!(is_protected("/Users/jp/Projects/client-a/api"));
        assert!(is_protected("/Users/jp/Projects/client-a/api/"));
        assert!(is_protected("/Users/jp/Projects/client-a/api/src"));
        assert!(is_protected("/Users/JP/Projects/CLIENT-A/api"));

        // Un voisin qui partage le début du nom n'est pas dedans. C'est le cas que
        // l'ancienne comparaison de préfixe laissait passer.
        assert!(!is_protected("/Users/jp/Projects/client-a/api-v2"));
        assert!(!is_protected("/Users/jp/Projects/client-a/apixyz"));
        assert!(!is_protected("/Users/jp/Projects/client-b/api"));
        assert!(!is_protected("/Users/jp/Projects/client-a"));
    }

    #[test]
    fn path_rules_tolerate_a_trailing_separator_and_windows_paths() {
        let mut settings = default_settings();
        settings.protect_system_processes = false;
        settings.rules = vec![ProtectionRule {
            id: "project-a".into(),
            label: "Projet A".into(),
            kind: "path".into(),
            value: "C:\\Users\\jp\\Projects\\client-a\\".into(),
            enabled: true,
            builtin: false,
        }];

        let mut record = sample_record();
        record.working_directory = Some("C:\\Users\\jp\\Projects\\client-a\\api".into());
        assert_eq!(
            protection_reasons(&settings, &record),
            vec![ProtectionReason::rule("project-a")]
        );

        record.working_directory = Some("C:\\Users\\jp\\Projects\\client-a-old".into());
        assert!(protection_reasons(&settings, &record).is_empty());
    }

    #[test]
    fn container_rules_protect_only_the_named_docker_container() {
        let mut settings = default_settings();
        settings.protect_system_processes = false;
        settings.rules = vec![ProtectionRule {
            id: "container-llm-api".into(),
            label: "LLM API".into(),
            kind: "container".into(),
            value: "llm_api".into(),
            enabled: true,
            builtin: false,
        }];

        let mut protected = sample_record();
        protected.identification = "llm_api".into();
        protected.docker_container_id = Some("532041d742d5".into());
        assert_eq!(
            protection_reasons(&settings, &protected),
            vec![ProtectionReason::rule("container-llm-api")]
        );

        protected.identification = "llm_postgres".into();
        protected.docker_container_id = Some("7fcb8e20e3db".into());
        assert!(protection_reasons(&settings, &protected).is_empty());
    }

    #[test]
    fn backend_messages_resolve_reason_identifiers_into_labels() {
        let mut settings = default_settings();
        settings.rules = vec![ProtectionRule {
            id: "project-a".into(),
            label: "Projet A".into(),
            kind: "path".into(),
            value: "/Users/jp/Projects/client-a".into(),
            enabled: true,
            builtin: false,
        }];

        let described = describe_protection_reasons(
            &settings,
            &[
                ProtectionReason::rule("project-a"),
                ProtectionReason::system_main(),
            ],
        );

        assert_eq!(
            described,
            vec![
                "Le processus principal du système ne peut pas être arrêté".to_string(),
                "Projet A".to_string(),
            ]
        );
    }

    #[test]
    fn resolves_portroot_and_connexions_locales_as_legacy_settings() {
        let current = Path::new("/config/ca.jplefebvre.port-scanner/settings.json");
        assert_eq!(
            legacy_settings_paths(current),
            vec![
                PathBuf::from("/config/ca.jplefebvre.portroot/settings.json"),
                PathBuf::from("/config/ca.jplefebvre.connexions-locales/settings.json"),
            ]
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
            launcher: None,
            launcher_pid: None,
            process_name: "example".into(),
            process_path: Some("/tmp/example".into()),
            command: None,
            working_directory: Some("/tmp".into()),
            group_name: "tmp".into(),
            identification: "example".into(),
            docker_container_id: None,
            category: "other".into(),
            ai: false,
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
