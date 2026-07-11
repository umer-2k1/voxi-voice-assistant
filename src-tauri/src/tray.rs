use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

pub fn build(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Vox", true, None::<&str>)?;
    let restart = MenuItem::with_id(app, "restart-agent", "Restart agent", true, None::<&str>)?;
    let logs = MenuItem::with_id(app, "open-logs", "Open logs folder", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Vox", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &restart, &logs, &quit])?;

    TrayIconBuilder::with_id("vox-tray")
        .icon(app.default_window_icon().expect("bundled icon").clone())
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "restart-agent" => crate::sidecar::restart_sidecar(app.clone()),
            "open-logs" => {
                if let Ok(dir) = app.path().app_log_dir() {
                    let _ = tauri_plugin_opener::open_path(dir, None::<&str>);
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}
