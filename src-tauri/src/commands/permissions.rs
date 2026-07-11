use serde::Serialize;

/// macOS microphone TCC state ("granted" | "denied" | "undetermined" |
/// "unknown"). Other platforms report "granted" when a device exists —
/// capture permission there is managed by the OS, not per-app TCC.
#[derive(Serialize)]
pub struct Permissions {
    /// macOS Accessibility (required by enigo text insertion).
    pub accessibility: bool,
    /// Actual microphone permission state, not just device presence.
    pub microphone: String,
    /// True when an input device is present.
    pub microphone_device: bool,
}

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> bool;
    fn AXIsProcessTrustedWithOptions(
        options: core_foundation::dictionary::CFDictionaryRef,
    ) -> bool;
    static kAXTrustedCheckOptionPrompt: core_foundation::string::CFStringRef;
}

#[cfg(target_os = "macos")]
#[link(name = "AVFoundation", kind = "framework")]
extern "C" {
    static AVMediaTypeAudio: &'static objc2::runtime::AnyObject;
}

fn accessibility_trusted() -> bool {
    #[cfg(target_os = "macos")]
    unsafe {
        AXIsProcessTrusted()
    }
    #[cfg(not(target_os = "macos"))]
    true
}

/// AVCaptureDevice authorizationStatusForMediaType: — the real TCC state.
#[cfg(target_os = "macos")]
fn microphone_status() -> &'static str {
    use objc2::msg_send;
    let class = objc2::class!(AVCaptureDevice);
    let status: isize = unsafe { msg_send![class, authorizationStatusForMediaType: AVMediaTypeAudio] };
    match status {
        0 => "undetermined",
        1 | 2 => "denied", // restricted | denied
        3 => "granted",
        _ => "unknown",
    }
}

#[cfg(not(target_os = "macos"))]
fn microphone_status() -> &'static str {
    use cpal::traits::HostTrait;
    if cpal::default_host().default_input_device().is_some() {
        "granted"
    } else {
        "unknown"
    }
}

#[tauri::command]
pub fn check_permissions() -> Permissions {
    use cpal::traits::HostTrait;
    Permissions {
        accessibility: accessibility_trusted(),
        microphone: microphone_status().to_owned(),
        microphone_device: cpal::default_host().default_input_device().is_some(),
    }
}

/// Fire the OS microphone prompt by opening a capture stream briefly.
/// macOS shows the TCC dialog (with the Info.plist usage string) on the
/// first capture; if the user already decided, this is a no-op.
#[tauri::command]
pub fn request_microphone() {
    std::thread::spawn(|| {
        use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
        let Some(device) = cpal::default_host().default_input_device() else {
            return;
        };
        let Ok(config) = device.default_input_config() else {
            return;
        };
        if let Ok(stream) =
            device.build_input_stream(&config.into(), |_: &[f32], _| {}, |_| {}, None)
        {
            let _ = stream.play();
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
    });
}

/// Show the macOS Accessibility consent prompt (adds Vox to the list in
/// System Settings). Returns the current trust state.
#[tauri::command]
pub fn request_accessibility() -> bool {
    #[cfg(target_os = "macos")]
    {
        use core_foundation::base::TCFType;
        use core_foundation::boolean::CFBoolean;
        use core_foundation::dictionary::CFDictionary;
        use core_foundation::string::CFString;
        unsafe {
            let key = CFString::wrap_under_get_rule(kAXTrustedCheckOptionPrompt);
            let options = CFDictionary::from_CFType_pairs(&[(
                key.as_CFType(),
                CFBoolean::true_value().as_CFType(),
            )]);
            AXIsProcessTrustedWithOptions(options.as_concrete_TypeRef())
        }
    }
    #[cfg(not(target_os = "macos"))]
    true
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
            "notifications" => "x-apple.systempreferences:com.apple.preference.notifications",
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
