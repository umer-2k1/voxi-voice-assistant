use futures_util::StreamExt;
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;

use super::models::{model_path, spec_for, ModelSpec, VAD_MODEL};

#[derive(Clone, Serialize)]
struct DownloadProgress<'a> {
    model: &'a str,
    downloaded: u64,
    total: Option<u64>,
    done: bool,
}

/// Download a model with resume support (`.part` file + HTTP Range),
/// emitting `model-download-progress` events along the way.
async fn download(app: &AppHandle, spec: &ModelSpec) -> Result<(), String> {
    let target = model_path(app, spec)?;
    if target.exists() {
        let _ = app.emit(
            "model-download-progress",
            DownloadProgress { model: spec.key, downloaded: 0, total: None, done: true },
        );
        return Ok(());
    }

    let part = target.with_extension("bin.part");
    let existing = tokio::fs::metadata(&part).await.map(|m| m.len()).unwrap_or(0);

    let client = reqwest::Client::new();
    let mut request = client.get(spec.url);
    if existing > 0 {
        request = request.header("Range", format!("bytes={existing}-"));
    }
    let response = request.send().await.map_err(|e| e.to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("download failed: HTTP {status}"));
    }

    // 206 = server honored the Range; anything else restarts from zero.
    let resuming = status == reqwest::StatusCode::PARTIAL_CONTENT;
    let mut downloaded = if resuming { existing } else { 0 };
    let total = response
        .content_length()
        .map(|len| len + if resuming { existing } else { 0 });

    let mut file = tokio::fs::OpenOptions::new()
        .create(true)
        .append(resuming)
        .write(true)
        .truncate(!resuming)
        .open(&part)
        .await
        .map_err(|e| e.to_string())?;

    let mut stream = response.bytes_stream();
    let mut last_emit = std::time::Instant::now();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        if last_emit.elapsed().as_millis() >= 200 {
            last_emit = std::time::Instant::now();
            let _ = app.emit(
                "model-download-progress",
                DownloadProgress { model: spec.key, downloaded, total, done: false },
            );
        }
    }
    file.flush().await.map_err(|e| e.to_string())?;
    drop(file);

    tokio::fs::rename(&part, &target).await.map_err(|e| e.to_string())?;
    let _ = app.emit(
        "model-download-progress",
        DownloadProgress { model: spec.key, downloaded, total, done: true },
    );
    log::info!("downloaded {} ({downloaded} bytes)", spec.file);
    Ok(())
}

/// Ensure the configured STT model + the VAD model are present locally.
#[tauri::command]
pub async fn download_stt_model(app: AppHandle, model: String) -> Result<(), String> {
    let spec = spec_for(&model).ok_or_else(|| format!("unknown STT model: {model}"))?;
    download(&app, spec).await?;
    download(&app, &VAD_MODEL).await
}

/// Report whether the configured STT model (and VAD model) are downloaded.
#[tauri::command]
pub fn check_stt_model(app: AppHandle, model: String) -> Result<bool, String> {
    let spec = spec_for(&model).ok_or_else(|| format!("unknown STT model: {model}"))?;
    Ok(model_path(&app, spec)?.exists() && model_path(&app, &VAD_MODEL)?.exists())
}
