use std::{
    collections::HashMap,
    path::PathBuf,
    process::{Command, Output},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DockerPort {
    pub container_id: String,
    pub name: String,
    pub image: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoppedContainer {
    pub container_id: String,
    pub name: String,
}

pub fn published_port_map() -> HashMap<u16, DockerPort> {
    let Ok(output) = run_docker(&[
        "ps",
        "--no-trunc",
        "--format",
        "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Ports}}",
    ]) else {
        return HashMap::new();
    };
    if !output.status.success() {
        return HashMap::new();
    }

    parse_published_ports(&String::from_utf8_lossy(&output.stdout))
}

pub fn stop_container(container_id: &str, force: bool) -> Result<StoppedContainer, String> {
    validate_container_id(container_id)?;
    let inspected = inspect_container(container_id)?;
    if inspected.container_id != container_id {
        return Err("L’identité du conteneur Docker a changé. Relancez l’analyse.".into());
    }
    if !inspected.running {
        return Err(format!(
            "Le conteneur Docker {} est déjà arrêté.",
            inspected.name
        ));
    }

    let output = if force {
        run_docker(&["kill", container_id])?
    } else {
        run_docker(&["stop", "--time", "10", container_id])?
    };

    if !output.status.success() {
        return Err(docker_failure(
            if force {
                "forcer l’arrêt"
            } else {
                "arrêter"
            },
            &output,
        ));
    }

    if inspect_container(container_id).is_ok_and(|container| container.running) {
        return Err(format!(
            "Docker a accepté la commande, mais le conteneur {} est toujours actif.",
            inspected.name
        ));
    }

    Ok(StoppedContainer {
        container_id: inspected.container_id,
        name: inspected.name,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct DockerContainerState {
    container_id: String,
    name: String,
    running: bool,
}

fn inspect_container(container_id: &str) -> Result<DockerContainerState, String> {
    let output = run_docker(&[
        "inspect",
        "--format",
        "{{.Id}}\t{{.Name}}\t{{.State.Running}}",
        container_id,
    ])?;
    if !output.status.success() {
        return Err(docker_failure("inspecter", &output));
    }

    parse_inspection(&String::from_utf8_lossy(&output.stdout))
        .ok_or_else(|| "Docker a renvoyé une identité de conteneur invalide.".to_string())
}

fn parse_published_ports(output: &str) -> HashMap<u16, DockerPort> {
    let mut map = HashMap::new();
    for line in output.lines() {
        let mut fields = line.splitn(4, '\t');
        let Some(container_id) = fields.next().filter(|value| !value.is_empty()) else {
            continue;
        };
        let name = fields.next().unwrap_or_default();
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
                        container_id: container_id.into(),
                        name: name.into(),
                        image: image.into(),
                    },
                );
            }
        }
    }
    map
}

fn parse_inspection(output: &str) -> Option<DockerContainerState> {
    let mut fields = output.trim().splitn(3, '\t');
    let container_id = fields.next()?.to_string();
    let name = fields.next()?.trim_start_matches('/').to_string();
    let running = fields.next()?.parse().ok()?;
    if container_id.is_empty() || name.is_empty() {
        return None;
    }
    Some(DockerContainerState {
        container_id,
        name,
        running,
    })
}

fn validate_container_id(container_id: &str) -> Result<(), String> {
    if !(12..=64).contains(&container_id.len())
        || !container_id
            .chars()
            .all(|character| character.is_ascii_hexdigit())
    {
        return Err("Identifiant de conteneur Docker invalide.".into());
    }
    Ok(())
}

fn run_docker(arguments: &[&str]) -> Result<Output, String> {
    let mut not_found = None;
    for program in docker_candidates() {
        match Command::new(&program).args(arguments).output() {
            Ok(output) => return Ok(output),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                not_found = Some(error);
            }
            Err(error) => {
                return Err(format!(
                    "Impossible d’exécuter Docker avec {} : {error}",
                    program.display()
                ));
            }
        }
    }

    Err(format!(
        "La commande Docker est introuvable. Vérifiez que Docker Desktop est installé{}.",
        not_found
            .map(|error| format!(" ({error})"))
            .unwrap_or_default()
    ))
}

fn docker_candidates() -> Vec<PathBuf> {
    let mut candidates = vec![PathBuf::from("docker")];

    #[cfg(target_os = "macos")]
    candidates.extend([
        PathBuf::from("/usr/local/bin/docker"),
        PathBuf::from("/opt/homebrew/bin/docker"),
        PathBuf::from("/Applications/Docker.app/Contents/Resources/bin/docker"),
    ]);

    #[cfg(target_os = "linux")]
    candidates.extend([
        PathBuf::from("/usr/bin/docker"),
        PathBuf::from("/usr/local/bin/docker"),
    ]);

    #[cfg(target_os = "windows")]
    candidates.push(PathBuf::from(
        r"C:\Program Files\Docker\Docker\resources\bin\docker.exe",
    ));

    candidates
}

fn docker_failure(action: &str, output: &Output) -> String {
    let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if detail.is_empty() {
        format!(
            "Impossible de {action} le conteneur Docker (code {:?}).",
            output.status.code()
        )
    } else {
        format!("Impossible de {action} le conteneur Docker : {detail}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_container_identity_and_published_host_ports() {
        let id = "86e7b3b652fb5e7dc172982ed5f502db2e2a44ff9e1d63fef6d70bb9b2dacd32";
        let ports = parse_published_ports(&format!(
            "{id}\tguessly-mig\tguessly-web:mig\t0.0.0.0:4401->4321/tcp, [::]:4401->4321/tcp\n"
        ));

        assert_eq!(ports.len(), 1);
        assert_eq!(ports[&4401].container_id, id);
        assert_eq!(ports[&4401].name, "guessly-mig");
        assert_eq!(ports[&4401].image, "guessly-web:mig");
    }

    #[test]
    fn rejects_names_and_shell_fragments_as_container_ids() {
        assert!(validate_container_id("guessly-mig").is_err());
        assert!(validate_container_id("86e7b3b652fb;touch /tmp/nope").is_err());
        assert!(validate_container_id("86e7b3b652fb").is_ok());
    }

    #[test]
    fn parses_docker_inspection_without_the_leading_name_slash() {
        let state = parse_inspection(
            "86e7b3b652fb5e7dc172982ed5f502db2e2a44ff9e1d63fef6d70bb9b2dacd32\t/guessly-mig\ttrue\n",
        )
        .unwrap();

        assert_eq!(state.name, "guessly-mig");
        assert!(state.running);
    }
}
