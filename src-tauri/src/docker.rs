use std::{
    collections::HashMap,
    io::Read,
    path::PathBuf,
    process::{Child, Command, Output, Stdio},
    thread::JoinHandle,
    time::{Duration, Instant},
};

/// Interroger Docker doit rester une formalité. Si le démon ne répond pas, mieux
/// vaut une analyse sans conteneurs qu'une analyse qui ne se termine jamais.
const PROBE_TIMEOUT: Duration = Duration::from_secs(3);

/// `docker stop` laisse au conteneur le délai de grâce ci-dessous avant de le
/// tuer, donc notre propre limite doit lui laisser cette marge.
const STOP_GRACE_SECONDS: u64 = 10;
const STOP_TIMEOUT: Duration = Duration::from_secs(STOP_GRACE_SECONDS + 10);

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

    let grace = STOP_GRACE_SECONDS.to_string();
    let output = if force {
        run_docker_within(&["kill", container_id], STOP_TIMEOUT)?
    } else {
        run_docker_within(&["stop", "--time", &grace, container_id], STOP_TIMEOUT)?
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
    run_docker_within(arguments, PROBE_TIMEOUT)
}

fn run_docker_within(arguments: &[&str], timeout: Duration) -> Result<Output, String> {
    let mut not_found = None;
    for program in docker_candidates() {
        let mut command = Command::new(&program);
        command.args(arguments);

        match run_within(&mut command, timeout) {
            Ok(Some(output)) => return Ok(output),
            Ok(None) => {
                return Err(format!(
                    "Docker n’a pas répondu en {} s. Le démon est peut-être en cours de démarrage ou bloqué.",
                    timeout.as_secs()
                ));
            }
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

/// `Ok(None)` signale l'expiration du délai : l'enfant a été tué et n'a rien
/// d'exploitable à offrir. Une erreur, elle, reste une erreur de lancement.
fn run_within(command: &mut Command, timeout: Duration) -> std::io::Result<Option<Output>> {
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    // Les tuyaux sont vidés sur des fils dédiés : une sortie plus grosse que le
    // tampon du système bloquerait l'enfant avant qu'il puisse se terminer, et
    // l'attente ci-dessous ne verrait jamais la fin.
    let stdout = drain(child.stdout.take());
    let stderr = drain(child.stderr.take());
    let status = wait_within(&mut child, timeout)?;

    let stdout = stdout.join().unwrap_or_default();
    let stderr = stderr.join().unwrap_or_default();

    Ok(status.map(|status| Output {
        status,
        stdout,
        stderr,
    }))
}

fn wait_within(
    child: &mut Child,
    timeout: Duration,
) -> std::io::Result<Option<std::process::ExitStatus>> {
    let deadline = Instant::now() + timeout;
    loop {
        if let Some(status) = child.try_wait()? {
            return Ok(Some(status));
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            return Ok(None);
        }
        std::thread::sleep(Duration::from_millis(20));
    }
}

fn drain(pipe: Option<impl Read + Send + 'static>) -> JoinHandle<Vec<u8>> {
    std::thread::spawn(move || {
        let mut buffer = Vec::new();
        if let Some(mut pipe) = pipe {
            let _ = pipe.read_to_end(&mut buffer);
        }
        buffer
    })
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
    #[cfg(unix)]
    fn a_command_that_never_answers_is_killed_at_the_deadline() {
        let mut command = Command::new("sleep");
        command.arg("30");

        let started = Instant::now();
        let output = run_within(&mut command, Duration::from_millis(150)).expect("le lancement");

        assert!(output.is_none(), "le délai doit être signalé, pas attendu");
        assert!(
            started.elapsed() < Duration::from_secs(5),
            "l'appel a duré {:?}, il n'a donc pas été interrompu",
            started.elapsed()
        );
    }

    #[test]
    #[cfg(unix)]
    fn a_command_that_answers_still_returns_its_output() {
        let mut command = Command::new("echo");
        command.arg("bonjour");

        let output = run_within(&mut command, Duration::from_secs(5))
            .expect("le lancement")
            .expect("la commande répond bien avant le délai");

        assert!(String::from_utf8_lossy(&output.stdout).contains("bonjour"));
    }

    #[test]
    #[cfg(unix)]
    fn a_chatty_command_does_not_deadlock_on_a_full_pipe() {
        // 200 ko dépassent largement le tampon d'un tuyau : sans les fils qui
        // vident stdout, l'enfant se bloquerait et le délai expirerait.
        let mut command = Command::new("head");
        command.args(["-c", "200000", "/dev/zero"]);

        let output = run_within(&mut command, Duration::from_secs(5))
            .expect("le lancement")
            .expect("la commande doit se terminer");

        assert_eq!(output.stdout.len(), 200_000);
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
