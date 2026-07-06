pub mod capture;
pub mod download;
pub mod models;
pub mod resample;
pub mod stt;

use tauri::{AppHandle, Emitter, Manager};

use capture::MicState;

/// Push-to-talk release: take the captured buffer, transcribe it off the
/// main thread, and emit the outcome. The transcript consumer (sidecar
/// wiring) attaches in M3/M4.
pub fn handle_release(app: &AppHandle) {
    let Some(samples) = capture::stop(app) else {
        return;
    };

    let app = app.clone();
    std::thread::spawn(move || {
        capture::emit_mic_state(&app, MicState::Thinking);

        let model_key = crate::settings::load(&app).stt_model;
        let engine = app.state::<stt::SttEngine>();
        let started = std::time::Instant::now();
        let result = engine.transcribe(&app, &model_key, &samples);
        let elapsed_ms = started.elapsed().as_millis();

        match result {
            Ok(stt::SttOutcome::Text(text)) => {
                log::info!("transcribed in {elapsed_ms}ms: {text:?}");
                let _ = app.emit("transcription", serde_json::json!({ "text": text, "ms": elapsed_ms }));
            }
            Ok(stt::SttOutcome::Empty) => {
                log::info!("empty transcription ({elapsed_ms}ms)");
                let _ = app.emit("transcription-empty", serde_json::json!({ "ms": elapsed_ms }));
            }
            Err(message) => {
                log::error!("stt error: {message}");
                let _ = app.emit("stt-error", serde_json::json!({ "message": message }));
            }
        }
        capture::emit_mic_state(&app, MicState::Idle);
    });
}
