use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tokio::sync::mpsc;

/// Handle for pushing frames onto the privileged core→sidecar channel
/// from anywhere in the core (config pushes after CRUD, etc.).
#[derive(Default)]
pub struct CoreChannel {
    tx: Mutex<Option<mpsc::UnboundedSender<String>>>,
}

impl CoreChannel {
    pub fn send(&self, frame: String) -> bool {
        match self.tx.lock().unwrap().as_ref() {
            Some(tx) => tx.send(frame).is_ok(),
            None => false,
        }
    }
}

/// Privileged "core" connection to the sidecar WebSocket (PRD §8.1).
///
/// Over this channel the core pushes config, answers `get_secret`
/// look-ups from the OS keychain, and executes `system_action` requests
/// (open_path / insert_text). Secrets never transit the webview.
pub fn connect(app: &AppHandle, port: u16) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let url = format!("ws://127.0.0.1:{port}");
        let (stream, _) = match tokio_tungstenite::connect_async(&url).await {
            Ok(pair) => pair,
            Err(e) => {
                log::error!("core channel connect failed: {e}");
                return;
            }
        };
        let (mut write, mut read) = stream.split();

        let (tx, mut rx) = mpsc::unbounded_channel::<String>();
        *app.state::<CoreChannel>().tx.lock().unwrap() = Some(tx.clone());

        // Writer task: everything queued on the channel goes to the socket.
        let writer = tauri::async_runtime::spawn(async move {
            while let Some(frame) = rx.recv().await {
                if write
                    .send(tokio_tungstenite::tungstenite::Message::text(frame))
                    .await
                    .is_err()
                {
                    return;
                }
            }
        });

        let token = app.state::<crate::AppState>().session_token.clone();
        let _ = tx.send(
            json!({ "type": "auth", "payload": { "token": token, "role": "core" } }).to_string(),
        );
        push_config(&app);

        while let Some(message) = read.next().await {
            let Ok(tokio_tungstenite::tungstenite::Message::Text(raw)) = message else {
                if message.is_err() {
                    break;
                }
                continue;
            };
            let Ok(value) = serde_json::from_str::<serde_json::Value>(raw.as_str()) else {
                continue;
            };
            handle_frame(&app, &tx, value);
        }

        log::warn!("core channel closed");
        *app.state::<CoreChannel>().tx.lock().unwrap() = None;
        writer.abort();
    });
}

fn handle_frame(
    app: &AppHandle,
    tx: &mpsc::UnboundedSender<String>,
    value: serde_json::Value,
) {
    match value["type"].as_str() {
        Some("auth_ok") => log::info!("core channel authenticated"),
        Some("get_secret") => {
            let id = value["id"].as_str().unwrap_or_default();
            let secret_ref = value["payload"]["secret_ref"].as_str().unwrap_or_default();
            // Never log the value.
            let secret = crate::commands::secrets::read_secret(secret_ref);
            log::info!(
                "get_secret {secret_ref}: {}",
                if secret.is_some() { "found" } else { "missing" }
            );
            let _ = tx.send(
                json!({
                    "type": "secret_value",
                    "id": id,
                    "payload": { "secret_ref": secret_ref, "value": secret }
                })
                .to_string(),
            );
        }
        Some("system_action") => {
            let id = value["id"].as_str().unwrap_or_default().to_string();
            let action = value["payload"]["action"].as_str().unwrap_or_default().to_string();
            let args = value["payload"]["args"].clone();
            let tx = tx.clone();
            let app = app.clone();
            // System actions can block (enigo typing) — keep the read loop free.
            std::thread::spawn(move || {
                let result = match action.as_str() {
                    "open_path" => crate::commands::system::open_path_impl(
                        args["path"].as_str().unwrap_or_default(),
                    ),
                    "insert_text" => crate::commands::system::insert_text_impl(
                        args["text"].as_str().unwrap_or_default(),
                    ),
                    other => Err(format!("unknown system action: {other}")),
                };
                log::info!("system_action {action}: {result:?}");
                if let Err(ref message) = result {
                    let _ = tauri::Emitter::emit(&app, "system-action-error", message.clone());
                }
                let _ = tx.send(
                    json!({
                        "type": "system_result",
                        "id": id,
                        "payload": { "ok": result.is_ok(), "detail": result.err() }
                    })
                    .to_string(),
                );
            });
        }
        _ => {}
    }
}

/// Push current connectors + settings so the sidecar can (re)build its
/// MCP clients and provider. Called on connect and after any CRUD.
pub fn push_config(app: &AppHandle) {
    let settings = crate::settings::load(app);
    let connectors = crate::commands::connectors::load(app);
    let frame = json!({
        "type": "config_updated",
        "payload": { "connectors": connectors, "settings": settings }
    })
    .to_string();
    if !app.state::<CoreChannel>().send(frame) {
        log::warn!("config push skipped: core channel not connected");
    }
}
