use std::{path::Path, process::Command};

use sysinfo::{Pid, Signal, System};
use tauri::AppHandle;

use crate::{
    model::{ActionResult, KillRequest, PortRecord},
    scanner::{current_ports_for_pid, detect_category},
    settings::{load_settings, protection_reasons},
};

#[tauri::command]
pub fn reveal_folder(path: String) -> Result<ActionResult, String> {
    validate_directory(&path)?;

    #[cfg(target_os = "macos")]
    let status = Command::new("open").arg(&path).status();
    #[cfg(target_os = "windows")]
    let status = Command::new("explorer").arg(&path).status();
    #[cfg(all(unix, not(target_os = "macos")))]
    let status = Command::new("xdg-open").arg(&path).status();

    command_result(status, "Dossier ouvert", "Impossible d’ouvrir le dossier")
}

#[tauri::command]
pub fn open_terminal(path: String) -> Result<ActionResult, String> {
    validate_directory(&path)?;

    #[cfg(target_os = "macos")]
    let status = Command::new("open")
        .args(["-a", "Terminal"])
        .arg(&path)
        .status();

    #[cfg(target_os = "windows")]
    let status = Command::new("cmd")
        .args(["/K", "cd", "/d"])
        .arg(&path)
        .status();

    #[cfg(all(unix, not(target_os = "macos")))]
    let status = open_linux_terminal(&path);

    command_result(
        status,
        "Terminal ouvert dans le dossier du processus",
        "Impossible d’ouvrir un terminal",
    )
}

#[tauri::command]
pub fn kill_process(app: AppHandle, request: KillRequest) -> Result<ActionResult, String> {
    if request.pid <= 1 {
        return Err("Ce processus système ne peut pas être arrêté.".into());
    }

    let system = System::new_all();
    let process = system
        .process(Pid::from_u32(request.pid))
        .ok_or_else(|| "Le processus n’existe plus. Relancez l’analyse.".to_string())?;

    if request
        .expected_start_time
        .is_some_and(|expected| expected != process.start_time())
    {
        return Err(
            "Le PID a été réutilisé par un autre processus. Relancez l’analyse avant de continuer."
                .into(),
        );
    }

    let process_name = process.name().to_string_lossy().into_owned();
    let process_path = process
        .exe()
        .map(|path| path.to_string_lossy().into_owned());
    let ports = current_ports_for_pid(request.pid);
    let settings = load_settings(&app);

    for port in ports.iter().copied().chain(std::iter::once(0)) {
        let record = guard_record(request.pid, &process_name, process_path.as_deref(), port);
        let reasons = protection_reasons(&settings, &record);
        if !reasons.is_empty() {
            return Err(format!("Processus protégé : {}", reasons.join(" · ")));
        }
    }

    #[cfg(unix)]
    let sent = if request.force {
        process.kill_with(Signal::Kill)
    } else {
        process.kill_with(Signal::Term)
    };

    #[cfg(windows)]
    let sent = {
        let mut command = Command::new("taskkill");
        command.args(["/PID", &request.pid.to_string()]);
        if request.force {
            command.arg("/F");
        }
        Some(
            command
                .status()
                .map(|status| status.success())
                .unwrap_or(false),
        )
    };

    match sent {
        Some(true) => Ok(ActionResult {
            success: true,
            message: if request.force {
                format!("Arrêt forcé envoyé à {process_name} (PID {}).", request.pid)
            } else {
                format!(
                    "Demande d’arrêt envoyée à {process_name} (PID {}).",
                    request.pid
                )
            },
        }),
        Some(false) => Err("Le système a refusé l’arrêt du processus.".into()),
        None => Err("Ce type d’arrêt n’est pas pris en charge sur cette plateforme.".into()),
    }
}

fn guard_record(pid: u32, name: &str, path: Option<&str>, port: u16) -> PortRecord {
    PortRecord {
        id: format!("guard-{pid}-{port}"),
        protocol: "TCP".into(),
        local_address: String::new(),
        port,
        scope: "local".into(),
        pid: Some(pid),
        parent_pid: None,
        process_name: name.into(),
        process_path: path.map(str::to_string),
        command: None,
        working_directory: None,
        group_name: name.into(),
        identification: name.into(),
        category: detect_category(name, path),
        started_at: None,
        uptime_seconds: None,
        cpu_usage: 0.0,
        memory_bytes: 0,
        active_connections: 0,
        protected: false,
        protection_reasons: Vec::new(),
    }
}

fn validate_directory(path: &str) -> Result<(), String> {
    let directory = Path::new(path);
    if !directory.exists() {
        return Err("Le dossier n’existe plus.".into());
    }
    if !directory.is_dir() {
        return Err("Le chemin associé n’est pas un dossier.".into());
    }
    Ok(())
}

fn command_result(
    status: std::io::Result<std::process::ExitStatus>,
    success_message: &str,
    error_message: &str,
) -> Result<ActionResult, String> {
    match status {
        Ok(status) if status.success() => Ok(ActionResult {
            success: true,
            message: success_message.into(),
        }),
        Ok(status) => Err(format!("{error_message} (code {:?}).", status.code())),
        Err(error) => Err(format!("{error_message} : {error}")),
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
fn open_linux_terminal(path: &str) -> std::io::Result<std::process::ExitStatus> {
    for (program, arguments) in [
        ("x-terminal-emulator", vec!["--working-directory", path]),
        ("gnome-terminal", vec!["--working-directory", path]),
        ("konsole", vec!["--workdir", path]),
    ] {
        if let Ok(status) = Command::new(program).args(arguments).status() {
            if status.success() {
                return Ok(status);
            }
        }
    }

    Err(std::io::Error::new(
        std::io::ErrorKind::NotFound,
        "aucun terminal compatible trouvé",
    ))
}
