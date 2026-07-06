use std::path::PathBuf;

use tauri::{AppHandle, Manager};

/// Whisper model registry. `stt_model` in settings selects by key.
pub struct ModelSpec {
    pub key: &'static str,
    pub file: &'static str,
    pub url: &'static str,
}

pub const STT_MODELS: &[ModelSpec] = &[
    ModelSpec {
        key: "small",
        file: "ggml-small.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
    },
    ModelSpec {
        key: "base.en",
        file: "ggml-base.en.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin",
    },
    ModelSpec {
        key: "large-v3",
        file: "ggml-large-v3.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin",
    },
];

/// Silero VAD model consumed by whisper.cpp's built-in VAD pass.
pub const VAD_MODEL: ModelSpec = ModelSpec {
    key: "silero-v5.1.2",
    file: "ggml-silero-v5.1.2.bin",
    url: "https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin",
};

pub fn spec_for(key: &str) -> Option<&'static ModelSpec> {
    STT_MODELS.iter().find(|m| m.key == key)
}

pub fn models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("models");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

pub fn model_path(app: &AppHandle, spec: &ModelSpec) -> Result<PathBuf, String> {
    Ok(models_dir(app)?.join(spec.file))
}
