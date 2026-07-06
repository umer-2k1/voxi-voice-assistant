use tauri::AppHandle;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// (Re-)register the push-to-talk hotkey. Any previously registered
/// shortcuts are cleared first so a settings change swaps cleanly.
pub fn register(app: &AppHandle, hotkey: &str) -> Result<(), String> {
    let gs = app.global_shortcut();
    gs.unregister_all().map_err(|e| e.to_string())?;

    let shortcut: Shortcut = hotkey.parse().map_err(|e| format!("{e:?}"))?;

    gs.on_shortcut(shortcut, move |app, _shortcut, event| match event.state {
        ShortcutState::Pressed => crate::audio::capture::start(app),
        ShortcutState::Released => crate::audio::handle_release(app),
    })
    .map_err(|e| e.to_string())
}
