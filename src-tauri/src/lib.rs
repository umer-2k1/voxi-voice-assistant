mod audio;
mod commands;
mod core_client;
mod hotkey;
mod session;
mod settings;
mod sidecar;
mod tray;
mod windows;

/// Shared application state available to every command handler.
pub struct AppState {
    /// Random per-session token authenticating webview/core connections
    /// to the agent sidecar (PRD §9.2). Injected into the sidecar at spawn.
    pub session_token: String,
}

/// Sidecar connection info handed to the webview on request.
/// The token is never baked into the page; the webview must ask for it.
#[tauri::command]
fn get_sidecar_info(
    state: tauri::State<'_, AppState>,
    sidecar: tauri::State<'_, sidecar::Sidecar>,
) -> serde_json::Value {
    serde_json::json!({
        "port": sidecar.port(),
        "token": state.session_token,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Panics land in the log file too, with the default stderr report kept.
    let default_panic = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        log::error!("panic: {info}");
        default_panic(info);
    }));

    let state = AppState {
        session_token: session::generate_token(),
    };

    tauri::Builder::default()
        .plugin(
            // Rotating file log (app log dir) + stderr; sidecar stderr is
            // forwarded through `log` so it lands here as well.
            tauri_plugin_log::Builder::new()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stderr),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("vox".into()),
                    }),
                ])
                .level(log::LevelFilter::Info)
                .max_file_size(2_000_000)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
                .build(),
        )
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(state)
        .manage(audio::capture::AudioCapture::default())
        .manage(audio::stt::SttEngine::default())
        .manage(sidecar::Sidecar::default())
        .manage(core_client::CoreChannel::default())
        .invoke_handler(tauri::generate_handler![
            get_sidecar_info,
            settings::get_settings,
            settings::update_settings,
            audio::download::download_stt_model,
            audio::download::check_stt_model,
            commands::secrets::store_secret,
            commands::secrets::delete_secret,
            commands::secrets::has_secret,
            commands::system::open_path,
            commands::system::insert_text,
            commands::connectors::list_connectors,
            commands::connectors::add_server,
            commands::connectors::remove_server,
            commands::connectors::set_connector_enabled,
            windows::resize_overlay,
            windows::set_overlay_interactive,
            commands::permissions::check_permissions,
            commands::permissions::request_microphone,
            commands::permissions::request_accessibility,
            commands::permissions::open_system_settings,
            sidecar::restart_sidecar,
        ])
        .setup(|app| {
            let handle = app.handle();
            tray::build(handle)?;

            let s = settings::load(handle);
            if let Err(e) = hotkey::register(handle, &s.hotkey) {
                log::error!("failed to register hotkey {:?}: {e}", s.hotkey);
            }
            windows::place_overlay(handle)?;
            sidecar::spawn(handle);
            Ok(())
        })
        .on_window_event(|window, event| {
            // The app lives in the tray: closing the main window hides it.
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                sidecar::shutdown(app);
            }
        });
}
