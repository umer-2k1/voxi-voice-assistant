use serde_json::json;
use tauri::{AppHandle, Manager};

/// Privileged "core" connection to the sidecar WebSocket (PRD §8.1).
///
/// Over this channel the core pushes config, answers `get_secret`
/// look-ups from the OS keychain, and executes `system_action` requests
/// (open_path / insert_text). Secrets never transit the webview.
pub fn connect(app: &AppHandle, port: u16) {
    let app = app.clone();
    std::thread::spawn(move || {
        let url = format!("ws://127.0.0.1:{port}");
        let (mut socket, _) = match tungstenite::connect(&url) {
            Ok(pair) => pair,
            Err(e) => {
                log::error!("core channel connect failed: {e}");
                return;
            }
        };

        let token = app.state::<crate::AppState>().session_token.clone();
        let auth = json!({ "type": "auth", "payload": { "token": token, "role": "core" } });
        if let Err(e) = socket.send(tungstenite::Message::text(auth.to_string())) {
            log::error!("core channel auth send failed: {e}");
            return;
        }

        push_config(&app, &mut socket);

        loop {
            let message = match socket.read() {
                Ok(m) => m,
                Err(e) => {
                    log::warn!("core channel closed: {e}");
                    return;
                }
            };
            let tungstenite::Message::Text(raw) = message else {
                continue;
            };
            let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) else {
                continue;
            };
            match value["type"].as_str() {
                Some("auth_ok") => log::info!("core channel authenticated"),
                Some("get_secret") => {
                    let id = value["id"].as_str().unwrap_or_default().to_string();
                    let secret_ref =
                        value["payload"]["secret_ref"].as_str().unwrap_or_default();
                    // Never log the value.
                    let secret = crate::commands::secrets::read_secret(secret_ref);
                    log::info!(
                        "get_secret {secret_ref}: {}",
                        if secret.is_some() { "found" } else { "missing" }
                    );
                    let reply = json!({
                        "type": "secret_value",
                        "id": id,
                        "payload": { "secret_ref": secret_ref, "value": secret }
                    });
                    let _ = socket.send(tungstenite::Message::text(reply.to_string()));
                }
                Some("system_action") => {
                    let id = value["id"].as_str().unwrap_or_default().to_string();
                    let action = value["payload"]["action"].as_str().unwrap_or_default();
                    let args = &value["payload"]["args"];
                    let result = match action {
                        "open_path" => crate::commands::system::open_path_impl(
                            args["path"].as_str().unwrap_or_default(),
                        ),
                        "insert_text" => crate::commands::system::insert_text_impl(
                            args["text"].as_str().unwrap_or_default(),
                        ),
                        other => Err(format!("unknown system action: {other}")),
                    };
                    log::info!("system_action {action}: {result:?}");
                    let reply = json!({
                        "type": "system_result",
                        "id": id,
                        "payload": {
                            "ok": result.is_ok(),
                            "detail": result.err(),
                        }
                    });
                    let _ = socket.send(tungstenite::Message::text(reply.to_string()));
                }
                _ => {}
            }
        }
    });
}

type WsStream = tungstenite::WebSocket<tungstenite::stream::MaybeTlsStream<std::net::TcpStream>>;

/// Push current connectors + settings so the sidecar can (re)build its
/// MCP clients and provider.
fn push_config(app: &AppHandle, socket: &mut WsStream) {
    let settings = crate::settings::load(app);
    let message = json!({
        "type": "config_updated",
        "payload": {
            // Connector CRUD lands in M5; empty list until then.
            "connectors": [],
            "settings": {
                "hotkey": settings.hotkey,
                "llm_provider": settings.llm_provider,
                "llm_model": settings.llm_model,
                "stt_model": settings.stt_model,
            }
        }
    });
    if let Err(e) = socket.send(tungstenite::Message::text(message.to_string())) {
        log::error!("core channel config push failed: {e}");
    }
}
