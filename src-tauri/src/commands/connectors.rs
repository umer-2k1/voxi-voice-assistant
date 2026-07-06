use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

pub const CONNECTORS_FILE: &str = "connectors.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connector {
    pub id: String,
    pub name: String,
    pub transport: String, // "stdio" | "http"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<std::collections::HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub secret_ref: Option<String>,
}

pub fn load(app: &AppHandle) -> Vec<Connector> {
    let Ok(store) = app.store(CONNECTORS_FILE) else {
        return Vec::new();
    };
    store
        .get("connectors")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

fn save(app: &AppHandle, connectors: &[Connector]) -> Result<(), String> {
    let store = app.store(CONNECTORS_FILE).map_err(|e| e.to_string())?;
    store.set("connectors", json!(connectors));
    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_connectors(app: AppHandle) -> Vec<Connector> {
    load(&app)
}

/// Add a server. New connectors are always disabled until the user
/// explicitly enables them after seeing the exact command (PRD §9.4 —
/// no auto-start of newly added stdio servers).
#[tauri::command]
pub fn add_server(app: AppHandle, mut connector: Connector) -> Result<Vec<Connector>, String> {
    connector.enabled = false;
    let mut connectors = load(&app);
    if connectors.iter().any(|c| c.id == connector.id) {
        return Err("a connector with this id already exists".into());
    }
    connectors.push(connector);
    save(&app, &connectors)?;
    crate::core_client::push_config(&app);
    Ok(connectors)
}

#[tauri::command]
pub fn remove_server(app: AppHandle, id: String) -> Result<Vec<Connector>, String> {
    let mut connectors = load(&app);
    if let Some(removed) = connectors.iter().find(|c| c.id == id) {
        if let Some(secret_ref) = &removed.secret_ref {
            let _ = crate::commands::secrets::delete_secret(secret_ref.clone());
        }
    }
    connectors.retain(|c| c.id != id);
    save(&app, &connectors)?;
    crate::core_client::push_config(&app);
    Ok(connectors)
}

#[tauri::command]
pub fn set_connector_enabled(
    app: AppHandle,
    id: String,
    enabled: bool,
) -> Result<Vec<Connector>, String> {
    let mut connectors = load(&app);
    let Some(connector) = connectors.iter_mut().find(|c| c.id == id) else {
        return Err("connector not found".into());
    };
    connector.enabled = enabled;
    save(&app, &connectors)?;
    crate::core_client::push_config(&app);
    Ok(connectors)
}
