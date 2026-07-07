use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager};

const OVERLAY_MARGIN_BOTTOM: f64 = 24.0;

/// Position the overlay bottom-center of the primary monitor and show it.
pub fn place_overlay(app: &AppHandle) -> tauri::Result<()> {
    let Some(overlay) = app.get_webview_window("overlay") else {
        return Ok(());
    };
    if let Some(monitor) = overlay.primary_monitor()? {
        let scale = monitor.scale_factor();
        let screen = monitor.size().to_logical::<f64>(scale);
        let win = overlay.outer_size()?.to_logical::<f64>(scale);
        overlay.set_position(LogicalPosition::new(
            (screen.width - win.width) / 2.0,
            screen.height - win.height - OVERLAY_MARGIN_BOTTOM,
        ))?;
    }
    // Follow the user to every Space / fullscreen app so Vox is usable
    // without ever focusing the main window (belt-and-braces with the
    // `visibleOnAllWorkspaces` window config).
    overlay.set_visible_on_all_workspaces(true)?;
    // The pill is display-only — let clicks fall through to whatever is
    // underneath. The webview re-enables input for the confirm card.
    overlay.set_ignore_cursor_events(true)?;
    overlay.show()?;
    Ok(())
}

/// Toggle whether the overlay accepts mouse input. Off by default (the
/// pill is display-only); the webview turns it on while the confirm card
/// is showing so Confirm/Deny are clickable.
#[tauri::command]
pub fn set_overlay_interactive(app: AppHandle, interactive: bool) -> Result<(), String> {
    let Some(overlay) = app.get_webview_window("overlay") else {
        return Err("overlay window missing".into());
    };
    overlay
        .set_ignore_cursor_events(!interactive)
        .map_err(|e| e.to_string())
}

/// Resize the overlay (e.g. to fit the confirm card) and keep it anchored
/// bottom-center. Called from the overlay webview.
#[tauri::command]
pub fn resize_overlay(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    let Some(overlay) = app.get_webview_window("overlay") else {
        return Err("overlay window missing".into());
    };
    overlay
        .set_size(LogicalSize::new(width, height))
        .map_err(|e| e.to_string())?;
    place_overlay(&app).map_err(|e| e.to_string())
}
