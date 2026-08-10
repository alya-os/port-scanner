mod actions;
pub mod model;
pub mod scanner;
pub mod settings;

use model::ScanResult;
use tauri::AppHandle;

#[tauri::command]
async fn scan_ports(app: AppHandle) -> Result<ScanResult, String> {
    tauri::async_runtime::spawn_blocking(move || scanner::scan(&app))
        .await
        .map_err(|error| format!("Le moteur d’analyse s’est interrompu : {error}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_ports,
            settings::get_settings,
            settings::save_settings,
            actions::reveal_folder,
            actions::open_terminal,
            actions::kill_process,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
