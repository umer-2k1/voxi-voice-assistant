use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

pub const SETTINGS_FILE: &str = "settings.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub hotkey: String,
    pub llm_provider: String,
    pub llm_model: String,
    pub stt_model: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            hotkey: "alt+space".into(),
            llm_provider: "groq".into(),
            llm_model: "llama-3.3-70b-versatile".into(),
            stt_model: "small".into(),
        }
    }
}

pub fn load(app: &AppHandle) -> Settings {
    let Ok(store) = app.store(SETTINGS_FILE) else {
        return Settings::default();
    };
    let defaults = Settings::default();
    let get_str = |key: &str, fallback: &str| {
        store
            .get(key)
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or_else(|| fallback.to_string())
    };
    Settings {
        hotkey: get_str("hotkey", &defaults.hotkey),
        llm_provider: get_str("llm_provider", &defaults.llm_provider),
        llm_model: get_str("llm_model", &defaults.llm_model),
        stt_model: get_str("stt_model", &defaults.stt_model),
    }
}

pub fn save(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    let store = app.store(SETTINGS_FILE).map_err(|e| e.to_string())?;
    store.set("hotkey", settings.hotkey.clone());
    store.set("llm_provider", settings.llm_provider.clone());
    store.set("llm_model", settings.llm_model.clone());
    store.set("stt_model", settings.stt_model.clone());
    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Settings {
    load(&app)
}

#[tauri::command]
pub fn update_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    save(&app, &settings)?;
    // Re-register the hotkey in case it changed, and let the sidecar
    // rebuild its provider with the new settings.
    crate::hotkey::register(&app, &settings.hotkey)?;
    crate::core_client::push_config(&app);
    Ok(())
}
