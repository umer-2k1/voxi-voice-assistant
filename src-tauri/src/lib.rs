mod session;

/// Shared application state available to every command handler.
pub struct AppState {
    /// Random per-session token authenticating webview/core connections
    /// to the agent sidecar (PRD §9.2). Injected into the sidecar at spawn.
    pub session_token: String,
}

/// Sidecar connection info handed to the webview on request.
/// The token is never baked into the page; the webview must ask for it.
#[tauri::command]
fn get_sidecar_info(state: tauri::State<'_, AppState>) -> serde_json::Value {
    serde_json::json!({
        // Real port arrives with the sidecar spawn handshake in M3.
        "port": 0,
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
        .invoke_handler(tauri::generate_handler![get_sidecar_info])
        .on_window_event(|window, event| {
            // The app lives in the tray: closing the main window hides it.
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
