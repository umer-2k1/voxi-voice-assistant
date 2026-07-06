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
    env_logger::init();

    let state = AppState {
        session_token: session::generate_token(),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
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
            commands::permissions::check_permissions,
            commands::permissions::open_system_settings,
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
