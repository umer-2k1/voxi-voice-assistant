use std::path::PathBuf;

/// Expand a leading `~` to the user's home directory.
pub fn expand_home(path: &str) -> String {
    if let Some(rest) = path.strip_prefix("~") {
        if let Some(home) = dirs_home() {
            return format!("{}{}", home.display(), rest);
        }
    }
    path.to_string()
}

fn dirs_home() -> Option<PathBuf> {
    #[allow(deprecated)] // fine on macOS/Windows, Linux is out of scope
    std::env::home_dir()
}

/// Open a file, folder, or URL with the OS default handler.
pub fn open_path_impl(path: &str) -> Result<(), String> {
    let expanded = expand_home(path);
    if expanded.starts_with("http://") || expanded.starts_with("https://") {
        tauri_plugin_opener::open_url(&expanded, None::<&str>).map_err(|e| e.to_string())
    } else {
        tauri_plugin_opener::open_path(&expanded, None::<&str>).map_err(|e| e.to_string())
    }
}

/// Type text at the cursor of the focused application via enigo.
/// Fails in secure input fields (accepted limitation, PRD P6).
pub fn insert_text_impl(text: &str) -> Result<(), String> {
    use enigo::{Enigo, Keyboard, Settings};
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    enigo.text(text).map_err(|e| e.to_string())
}

/// Read one NSString into a Rust String (nil-safe).
#[cfg(target_os = "macos")]
unsafe fn nsstring_to_string(value: *mut objc2::runtime::AnyObject) -> Option<String> {
    if value.is_null() {
        return None;
    }
    let utf8: *const std::os::raw::c_char = objc2::msg_send![value, UTF8String];
    if utf8.is_null() {
        return None;
    }
    Some(std::ffi::CStr::from_ptr(utf8).to_string_lossy().into_owned())
}

/// Ambient-context v1: which app the user is in right now, so the
/// planner can resolve references like "this app". Read-only, no
/// permissions needed (window titles would need Accessibility — later).
pub fn context_snapshot_impl() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    unsafe {
        use objc2::runtime::AnyObject;
        let workspace: *mut AnyObject =
            objc2::msg_send![objc2::class!(NSWorkspace), sharedWorkspace];
        if workspace.is_null() {
            return Err("NSWorkspace unavailable".into());
        }
        let app: *mut AnyObject = objc2::msg_send![workspace, frontmostApplication];
        if app.is_null() {
            return Ok("{}".into());
        }
        let name: *mut AnyObject = objc2::msg_send![app, localizedName];
        let bundle: *mut AnyObject = objc2::msg_send![app, bundleIdentifier];
        Ok(serde_json::json!({
            "frontmost_app": nsstring_to_string(name),
            "bundle_id": nsstring_to_string(bundle),
        })
        .to_string())
    }
    #[cfg(not(target_os = "macos"))]
    Ok("{}".into())
}

#[tauri::command]
pub fn open_path(path: String) -> Result<(), String> {
    open_path_impl(&path)
}

#[tauri::command]
pub fn insert_text(text: String) -> Result<(), String> {
    insert_text_impl(&text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expands_tilde() {
        let expanded = expand_home("~/Documents");
        assert!(!expanded.starts_with('~'));
        assert!(expanded.ends_with("/Documents"));
    }

    #[test]
    fn leaves_absolute_paths_alone() {
        assert_eq!(expand_home("/tmp/x"), "/tmp/x");
    }
}
