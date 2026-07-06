use serde::Serialize;

#[derive(Serialize)]
pub struct Permissions {
    /// macOS Accessibility (required by enigo text insertion).
    pub accessibility: bool,
    /// True when an input device is present. The actual mic permission
    /// prompt fires on the first capture (Info.plist usage string).
    pub microphone_device: bool,
}

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> bool;
}

fn accessibility_trusted() -> bool {
    #[cfg(target_os = "macos")]
    unsafe {
        AXIsProcessTrusted()
    }
    #[cfg(not(target_os = "macos"))]
    true
}

#[tauri::command]
pub fn check_permissions() -> Permissions {
    use cpal::traits::HostTrait;
    Permissions {
        accessibility: accessibility_trusted(),
        microphone_device: cpal::default_host().default_input_device().is_some(),
    }
}

/// Deep-link into System Settings (macOS). Windows: no-op (P9).
#[tauri::command]
pub fn open_system_settings(pane: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let url = match pane.as_str() {
            "accessibility" => {
                "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
            }
            "microphone" => {
                "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
            }
            _ => return Err(format!("unknown settings pane: {pane}")),
        };
        tauri_plugin_opener::open_url(url, None::<&str>).map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = pane;
        Ok(())
    }
}
