use std::{
    collections::{HashMap, HashSet},
    net::IpAddr,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use netstat2::{get_sockets_info, AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo, TcpState};
use sysinfo::{ProcessesToUpdate, System, MINIMUM_CPU_UPDATE_INTERVAL};
use tauri::AppHandle;

use crate::{
    docker::{published_port_map, DockerPort},
    model::{AppSettings, PortRecord, ScanResult},
    settings::{load_settings, protection_reasons},
};

/// sysinfo calcule l'occupation processeur par différence entre deux relevés :
/// sans pause entre les deux, tous les pourcentages valent zéro. Cette pause est
/// l'essentiel du temps d'une analyse, et un contrôle de protection n'en a aucun
/// besoin.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum CpuSampling {
    Measured,
    Skipped,
}

pub fn scan(app: &AppHandle) -> Result<ScanResult, String> {
    let settings = load_settings(app);
    scan_with_settings(&settings)
}

pub fn scan_with_settings(settings: &AppSettings) -> Result<ScanResult, String> {
    scan_with_options(settings, CpuSampling::Measured)
}

pub fn scan_with_options(
    settings: &AppSettings,
    cpu_sampling: CpuSampling,
) -> Result<ScanResult, String> {
    let af_flags = AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6;
    let proto_flags = ProtocolFlags::TCP | ProtocolFlags::UDP;
    let sockets = get_sockets_info(af_flags, proto_flags)
        .map_err(|error| format!("Impossible de lire les sockets réseau : {error}"))?;

    // `System::new_all()` relèverait aussi la mémoire, les processeurs et les
    // disques, dont rien ici ne se sert.
    let mut system = System::new();
    system.refresh_processes(ProcessesToUpdate::All, true);
    if cpu_sampling == CpuSampling::Measured {
        std::thread::sleep(MINIMUM_CPU_UPDATE_INTERVAL);
        system.refresh_processes(ProcessesToUpdate::All, true);
    }

    let docker_ports = published_port_map();
    let mut active_connections: HashMap<u32, u32> = HashMap::new();

    for socket in &sockets {
        if let ProtocolSocketInfo::Tcp(tcp) = &socket.protocol_socket_info {
            if tcp.state == TcpState::Established {
                for pid in &socket.associated_pids {
                    *active_connections.entry(*pid).or_default() += 1;
                }
            }
        }
    }

    let mut records = Vec::new();
    let mut seen = HashSet::new();
    let mut sockets_without_pid = 0usize;

    for socket in sockets {
        let (protocol, address, port) = match socket.protocol_socket_info {
            ProtocolSocketInfo::Tcp(tcp) if tcp.state == TcpState::Listen => {
                ("TCP", tcp.local_addr, tcp.local_port)
            }
            ProtocolSocketInfo::Udp(udp) if should_include_udp(udp.local_addr, udp.local_port) => {
                ("UDP", udp.local_addr, udp.local_port)
            }
            _ => continue,
        };

        if port == 0 {
            continue;
        }

        let pids: Vec<Option<u32>> = if socket.associated_pids.is_empty() {
            sockets_without_pid += 1;
            vec![None]
        } else {
            socket.associated_pids.into_iter().map(Some).collect()
        };

        for pid in pids {
            let unique_key = format!("{protocol}-{address}-{port}-{}", pid.unwrap_or_default());
            if !seen.insert(unique_key.clone()) {
                continue;
            }

            let process = pid.and_then(|value| system.process(sysinfo::Pid::from_u32(value)));
            let process_name = process
                .map(|value| value.name().to_string_lossy().into_owned())
                .unwrap_or_else(|| "Processus masqué".into());
            let process_path = process
                .and_then(|value| value.exe())
                .map(path_string)
                .filter(|path| !path.is_empty());
            let working_directory = process
                .and_then(|value| value.cwd())
                .map(path_string)
                .filter(|path| path != "/" && !path.is_empty());
            let command = process
                .map(|value| {
                    value
                        .cmd()
                        .iter()
                        .map(|part| part.to_string_lossy())
                        .collect::<Vec<_>>()
                        .join(" ")
                })
                .filter(|value| !value.is_empty());

            let docker = docker_ports.get(&port);
            let category = detect_category(&process_name, process_path.as_deref());
            let ancestry = pid.map(|value| ancestors(&system, value)).unwrap_or_default();
            let launcher = resolve_launcher(&ancestry);
            let ai = detect_ai(
                &process_name,
                process_path.as_deref(),
                command.as_deref(),
                &ancestry,
            );
            let identification = docker
                .map(|container| container.name.clone())
                .or_else(|| working_directory.as_deref().and_then(last_component))
                .or_else(|| process_path.as_deref().and_then(app_name))
                .unwrap_or_else(|| process_name.clone());
            let group_name = derive_group_name(
                &category,
                &process_name,
                process_path.as_deref(),
                working_directory.as_deref(),
                docker,
            );

            let mut record = PortRecord {
                id: unique_key,
                protocol: protocol.into(),
                local_address: address.to_string(),
                port,
                scope: if address.is_loopback() {
                    "local".into()
                } else {
                    "network".into()
                },
                pid,
                parent_pid: process
                    .and_then(|value| value.parent())
                    .map(|value| value.as_u32()),
                launcher: launcher.as_ref().map(|(_, name)| name.clone()),
                launcher_pid: launcher.as_ref().map(|(pid, _)| *pid),
                process_name,
                process_path,
                command: docker
                    .map(|container| format!("Conteneur Docker · {}", container.image))
                    .or(command),
                working_directory,
                group_name,
                identification,
                docker_container_id: docker.map(|container| container.container_id.clone()),
                category,
                ai,
                started_at: process.map(|value| value.start_time()),
                uptime_seconds: process.map(|value| value.run_time()),
                cpu_usage: process.map(|value| value.cpu_usage()).unwrap_or_default(),
                memory_bytes: process.map(|value| value.memory()).unwrap_or_default(),
                active_connections: pid
                    .and_then(|value| active_connections.get(&value).copied())
                    .unwrap_or_default(),
                protected: false,
                protection_reasons: Vec::new(),
            };

            record.protection_reasons = protection_reasons(settings, &record);
            record.protected = !record.protection_reasons.is_empty();
            records.push(record);
        }
    }

    records.sort_by(|left, right| {
        left.category
            .cmp(&right.category)
            .then_with(|| left.group_name.cmp(&right.group_name))
            .then_with(|| left.process_name.cmp(&right.process_name))
            .then_with(|| left.port.cmp(&right.port))
    });

    let mut warnings = Vec::new();
    if sockets_without_pid > 0 {
        warnings.push(format!(
            "{sockets_without_pid} socket(s) sont visibles sans PID. Les permissions du système peuvent masquer leur propriétaire."
        ));
    }
    warnings.push(
        "Les sockets UDP liées à une adresse réseau éphémère sont exclues pour éviter de confondre connexions sortantes et services entrants."
            .into(),
    );

    Ok(ScanResult {
        records,
        scanned_at: now_seconds(),
        platform: std::env::consts::OS.into(),
        permission_limited: sockets_without_pid > 0,
        warnings,
    })
}

pub fn current_ports_for_pid(pid: u32) -> Vec<u16> {
    let Ok(sockets) = get_sockets_info(
        AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6,
        ProtocolFlags::TCP | ProtocolFlags::UDP,
    ) else {
        return Vec::new();
    };

    sockets
        .into_iter()
        .filter(|socket| socket.associated_pids.contains(&pid))
        .filter_map(|socket| match socket.protocol_socket_info {
            ProtocolSocketInfo::Tcp(tcp) if tcp.state == TcpState::Listen => Some(tcp.local_port),
            ProtocolSocketInfo::Udp(udp) if should_include_udp(udp.local_addr, udp.local_port) => {
                Some(udp.local_port)
            }
            _ => None,
        })
        .collect()
}

pub fn detect_category(process_name: &str, process_path: Option<&str>) -> String {
    let path = process_path.unwrap_or_default();
    let lower_path = path.to_ascii_lowercase();

    if path.starts_with("/System/")
        || path.starts_with("/usr/libexec/")
        || path.starts_with("/sbin/")
        || (cfg!(target_os = "macos") && path.starts_with("/usr/sbin/"))
        || lower_path.starts_with("c:\\windows\\system32\\")
        || matches!(
            process_name.to_ascii_lowercase().as_str(),
            "systemd" | "init" | "system" | "services.exe" | "launchd"
        )
    {
        "system".into()
    } else if path.contains(".app/Contents/")
        || lower_path.contains("\\program files\\")
        || (path.starts_with("/opt/") && !path.starts_with("/opt/homebrew/"))
    {
        "application".into()
    } else {
        "other".into()
    }
}

fn should_include_udp(address: IpAddr, port: u16) -> bool {
    address.is_unspecified() || address.is_loopback() || port <= 1024 || port == 5353
}

const MAX_ANCESTRY_DEPTH: usize = 12;

/// Hôtes d'agents IA reconnus par leur exécutable. La correspondance est exacte
/// sur le nom du process : un `contains` classerait `codexample` en IA.
const AI_HOST_BINARIES: &[&str] = &[
    "claude",
    "claude-code",
    "codex",
    "cursor",
    "windsurf",
    "ollama",
    "aider",
    "opencode",
    "lms",
    "lm-studio",
    "lmstudio",
    "llama-server",
    "vllm",
    "open-webui",
    "openwebui",
    "gemini",
    "copilot-language-server",
];

/// Bundles applicatifs des mêmes hôtes, comparés en minuscules.
const AI_HOST_BUNDLES: &[&str] = &[
    "/claude.app/",
    "/cursor.app/",
    "/windsurf.app/",
    "/chatgpt.app/",
    "/lm studio.app/",
    "/ollama.app/",
    "/claude-code/",
];

/// Marqueurs d'un serveur MCP. Ils décrivent le protocole et non l'éditeur, donc
/// ils restent vrais pour un serveur écrit maison.
const MCP_COMMAND_MARKERS: &[&str] = &[
    "@modelcontextprotocol",
    "mcp-server",
    "mcp_server",
    "mcp-remote",
    "-mcp",
    "--mcp-config",
];

struct Ancestor {
    pid: u32,
    name: String,
    path: Option<String>,
}

/// Un ancêtre qui ne décide de rien : il transmet le dossier de travail et le
/// nom de son propre parent sans jamais être le vrai lanceur.
fn is_transparent_ancestor(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().trim_end_matches(".exe"),
        "sh" | "bash"
            | "zsh"
            | "dash"
            | "fish"
            | "ksh"
            | "csh"
            | "tcsh"
            | "env"
            | "sudo"
            | "doas"
            | "xargs"
            | "timeout"
            | "nohup"
            | "script"
            | "login"
            | "cmd"
            | "powershell"
            | "pwsh"
            | "conhost"
    )
}

/// La racine de session n'est pas un lanceur : tout en descend.
fn is_session_root(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().trim_end_matches(".exe"),
        "launchd" | "init" | "systemd" | "services" | "wininit"
    )
}

fn ancestors(system: &System, pid: u32) -> Vec<Ancestor> {
    let mut chain = Vec::new();
    let mut visited = HashSet::from([pid]);
    let mut current = system
        .process(sysinfo::Pid::from_u32(pid))
        .and_then(|process| process.parent());

    while let Some(parent_pid) = current {
        let raw = parent_pid.as_u32();
        if raw == 0 || !visited.insert(raw) || chain.len() >= MAX_ANCESTRY_DEPTH {
            break;
        }
        let Some(process) = system.process(parent_pid) else {
            break;
        };
        chain.push(Ancestor {
            pid: raw,
            name: process.name().to_string_lossy().into_owned(),
            path: process.exe().map(path_string).filter(|path| !path.is_empty()),
        });
        current = process.parent();
    }

    chain
}

/// Le premier ancêtre porteur de sens. Les shells sont traversés car ils héritent
/// le dossier de travail sans le choisir, et la racine de session ne compte pas.
fn resolve_launcher(ancestry: &[Ancestor]) -> Option<(u32, String)> {
    ancestry
        .iter()
        .find(|ancestor| !is_transparent_ancestor(&ancestor.name))
        .filter(|ancestor| !is_session_root(&ancestor.name))
        .map(|ancestor| {
            (
                ancestor.pid,
                launcher_label(&ancestor.name, ancestor.path.as_deref()),
            )
        })
}

fn launcher_label(name: &str, path: Option<&str>) -> String {
    ai_host_label(name, path)
        .map(str::to_string)
        .or_else(|| path.and_then(app_name))
        .unwrap_or_else(|| name.to_string())
}

/// Un process est lié à l'IA s'il est lui-même un hôte d'agent, s'il parle MCP,
/// ou s'il a été lancé par un hôte d'agent. Le dernier cas est le seul qui
/// rattrape un serveur MCP au nom neutre comme `toolbox`, `npx` ou `uvx`.
fn detect_ai(
    process_name: &str,
    process_path: Option<&str>,
    command: Option<&str>,
    ancestry: &[Ancestor],
) -> bool {
    is_ai_host(process_name, process_path)
        || is_mcp_command(command)
        || ancestry
            .iter()
            .any(|ancestor| is_ai_host(&ancestor.name, ancestor.path.as_deref()))
}

fn is_ai_host(process_name: &str, process_path: Option<&str>) -> bool {
    let name = process_name.to_ascii_lowercase();
    if AI_HOST_BINARIES.contains(&name.trim_end_matches(".exe")) {
        return true;
    }
    let path = process_path.unwrap_or_default().to_ascii_lowercase();
    AI_HOST_BUNDLES.iter().any(|bundle| path.contains(bundle))
}

fn is_mcp_command(command: Option<&str>) -> bool {
    let Some(command) = command else {
        return false;
    };
    let command = command.to_ascii_lowercase();
    MCP_COMMAND_MARKERS
        .iter()
        .any(|marker| command.contains(marker))
}

fn ai_host_label(process_name: &str, process_path: Option<&str>) -> Option<&'static str> {
    let path = process_path.unwrap_or_default().to_ascii_lowercase();
    if path.contains("/claude-code/") || path.contains("/claude.app/") {
        return Some("Claude Code");
    }

    match process_name.to_ascii_lowercase().trim_end_matches(".exe") {
        "claude" | "claude-code" => Some("Claude Code"),
        "codex" => Some("Codex"),
        "cursor" => Some("Cursor"),
        "windsurf" => Some("Windsurf"),
        "ollama" => Some("Ollama"),
        "aider" => Some("Aider"),
        "opencode" => Some("OpenCode"),
        "lms" | "lm-studio" | "lmstudio" => Some("LM Studio"),
        "llama-server" => Some("llama.cpp"),
        "vllm" => Some("vLLM"),
        "open-webui" | "openwebui" => Some("Open WebUI"),
        "gemini" => Some("Gemini CLI"),
        "copilot-language-server" => Some("GitHub Copilot"),
        _ => None,
    }
}

fn derive_group_name(
    category: &str,
    process_name: &str,
    process_path: Option<&str>,
    working_directory: Option<&str>,
    docker: Option<&DockerPort>,
) -> String {
    if docker.is_some() {
        return "Docker Desktop".into();
    }

    let path = process_path.unwrap_or_default();
    if path.contains("/Application Support/Local/") || path.contains("/Applications/Local.app/") {
        return "Local".into();
    }

    if category == "system" {
        return match std::env::consts::OS {
            "macos" => "Services macOS".into(),
            "windows" => "Services Windows".into(),
            _ => "Services système".into(),
        };
    }

    working_directory
        .and_then(last_component)
        .or_else(|| process_path.and_then(app_name))
        .unwrap_or_else(|| process_name.into())
}

fn path_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn last_component(path: &str) -> Option<String> {
    Path::new(path)
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .filter(|value| !value.is_empty())
}

fn app_name(path: &str) -> Option<String> {
    let marker = ".app/";
    let index = path.find(marker)?;
    let prefix = &path[..index];
    prefix
        .rsplit('/')
        .next()
        .map(str::to_string)
        .filter(|value| !value.is_empty())
}

fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_system_and_application_paths() {
        assert_eq!(
            detect_category("rapportd", Some("/usr/libexec/rapportd")),
            "system"
        );
        assert_eq!(
            detect_category(
                "Raycast",
                Some("/Applications/Raycast.app/Contents/MacOS/Raycast")
            ),
            "application"
        );
        assert_eq!(
            detect_category("python", Some("/opt/homebrew/bin/python3")),
            "other"
        );
    }

    fn ancestor(pid: u32, name: &str, path: Option<&str>) -> Ancestor {
        Ancestor {
            pid,
            name: name.into(),
            path: path.map(str::to_string),
        }
    }

    const CLAUDE_PATH: &str =
        "/Users/jp/Library/Application Support/Claude/claude-code/2.1.229/claude.app/Contents/MacOS/claude";

    #[test]
    fn names_the_launcher_through_shell_wrappers() {
        let ancestry = vec![
            ancestor(200, "bash", Some("/bin/bash")),
            ancestor(100, "claude", Some(CLAUDE_PATH)),
        ];

        assert_eq!(
            resolve_launcher(&ancestry),
            Some((100, "Claude Code".to_string()))
        );
    }

    #[test]
    fn refuses_the_session_root_as_a_launcher() {
        let ancestry = vec![
            ancestor(300, "zsh", Some("/bin/zsh")),
            ancestor(200, "login", Some("/usr/bin/login")),
            ancestor(1, "launchd", Some("/sbin/launchd")),
        ];

        assert_eq!(resolve_launcher(&ancestry), None);
    }

    #[test]
    fn tags_a_neutral_helper_launched_by_an_agent() {
        // Rien dans le nom ni dans la commande de `toolbox` n'evoque l'IA :
        // seule la filiation le rattache a Claude Code.
        let ancestry = vec![ancestor(100, "claude", Some(CLAUDE_PATH))];

        assert!(detect_ai(
            "toolbox",
            Some("/usr/local/bin/toolbox"),
            Some("/usr/local/bin/toolbox --prebuilt bigquery --stdio -p 24186"),
            &ancestry,
        ));
    }

    #[test]
    fn tags_a_standalone_mcp_server_by_its_command() {
        assert!(detect_ai(
            "node",
            Some("/opt/homebrew/bin/node"),
            Some("npx -y @modelcontextprotocol/server-filesystem /tmp"),
            &[],
        ));
    }

    #[test]
    fn leaves_unrelated_processes_untagged() {
        let ancestry = vec![ancestor(300, "zsh", Some("/bin/zsh"))];

        assert!(!detect_ai(
            "node",
            Some("/opt/homebrew/bin/node"),
            Some("node server.js --port 3000"),
            &ancestry,
        ));
        // Correspondance exacte sur le nom : un prefixe ne suffit pas.
        assert!(!detect_ai("codexample", None, None, &[]));
    }

    #[test]
    fn excludes_connected_udp_endpoints() {
        assert!(should_include_udp("0.0.0.0".parse().unwrap(), 5353));
        assert!(should_include_udp("127.0.0.1".parse().unwrap(), 9000));
        assert!(!should_include_udp("10.0.0.2".parse().unwrap(), 54005));
    }
}
