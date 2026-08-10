use std::{
    collections::{HashMap, HashSet},
    net::IpAddr,
    path::Path,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use netstat2::{get_sockets_info, AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo, TcpState};
use sysinfo::{ProcessesToUpdate, System, MINIMUM_CPU_UPDATE_INTERVAL};
use tauri::AppHandle;

use crate::{
    model::{AppSettings, PortRecord, ScanResult},
    settings::{load_settings, protection_reasons},
};

#[derive(Debug, Clone)]
struct DockerPort {
    name: String,
    image: String,
}

pub fn scan(app: &AppHandle) -> Result<ScanResult, String> {
    let settings = load_settings(app);
    scan_with_settings(&settings)
}

pub fn scan_with_settings(settings: &AppSettings) -> Result<ScanResult, String> {
    let af_flags = AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6;
    let proto_flags = ProtocolFlags::TCP | ProtocolFlags::UDP;
    let sockets = get_sockets_info(af_flags, proto_flags)
        .map_err(|error| format!("Impossible de lire les sockets réseau : {error}"))?;

    let mut system = System::new_all();
    std::thread::sleep(MINIMUM_CPU_UPDATE_INTERVAL);
    system.refresh_processes(ProcessesToUpdate::All, true);

    let docker_ports = docker_port_map();
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
                process_name,
                process_path,
                command: docker
                    .map(|container| format!("Conteneur Docker · {}", container.image))
                    .or(command),
                working_directory,
                group_name,
                identification,
                category,
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

fn docker_port_map() -> HashMap<u16, DockerPort> {
    let Ok(output) = Command::new("docker")
        .args(["ps", "--format", "{{.Names}}\t{{.Image}}\t{{.Ports}}"])
        .output()
    else {
        return HashMap::new();
    };
    if !output.status.success() {
        return HashMap::new();
    }

    let mut map = HashMap::new();
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        let mut fields = line.splitn(3, '\t');
        let Some(name) = fields.next() else { continue };
        let image = fields.next().unwrap_or_default();
        let ports = fields.next().unwrap_or_default();

        for mapping in ports.split(',').map(str::trim) {
            let Some((host, _container)) = mapping.split_once("->") else {
                continue;
            };
            let Some(port_text) = host.rsplit(':').next() else {
                continue;
            };
            if let Ok(port) = port_text.parse::<u16>() {
                map.insert(
                    port,
                    DockerPort {
                        name: name.into(),
                        image: image.into(),
                    },
                );
            }
        }
    }
    map
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

    #[test]
    fn excludes_connected_udp_endpoints() {
        assert!(should_include_udp("0.0.0.0".parse().unwrap(), 5353));
        assert!(should_include_udp("127.0.0.1".parse().unwrap(), 9000));
        assert!(!should_include_udp("10.0.0.2".parse().unwrap(), 54005));
    }
}
