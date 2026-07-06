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
