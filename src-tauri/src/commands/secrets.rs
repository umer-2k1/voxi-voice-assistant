const KEYRING_SERVICE: &str = "vox";

/// Read a secret for the sidecar's `get_secret` (core channel only —
/// no Tauri command exposes secret values to the webview).
pub fn read_secret(secret_ref: &str) -> Option<String> {
    keyring::Entry::new(KEYRING_SERVICE, secret_ref)
        .ok()?
        .get_password()
        .ok()
}

/// Store a secret in the OS keychain under a caller-chosen reference
/// (e.g. "groq_api_key", "connector_github"). Config files only ever
/// hold the reference, never the value (PRD §9.3).
#[tauri::command]
pub fn store_secret(secret_ref: String, value: String) -> Result<(), String> {
    keyring::Entry::new(KEYRING_SERVICE, &secret_ref)
        .map_err(|e| e.to_string())?
        .set_password(&value)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_secret(secret_ref: String) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &secret_ref).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// Presence check so the UI can show "key configured" without the value.
#[tauri::command]
pub fn has_secret(secret_ref: String) -> bool {
    read_secret(&secret_ref).is_some()
}
