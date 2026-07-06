use std::sync::Mutex;

use tauri::AppHandle;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use super::models::{model_path, spec_for, VAD_MODEL};

/// Lazily-loaded whisper context, reloaded when the configured model changes.
/// Kept in Tauri state; transcription itself runs on a blocking thread.
#[derive(Default)]
pub struct SttEngine {
    loaded: Mutex<Option<(String, WhisperContext)>>,
}

pub enum SttOutcome {
    Text(String),
    /// VAD/whisper produced nothing usable (silence, noise).
    Empty,
}

impl SttEngine {
    pub fn transcribe(
        &self,
        app: &AppHandle,
        model_key: &str,
        samples: &[f32],
    ) -> Result<SttOutcome, String> {
        let spec = spec_for(model_key).ok_or_else(|| format!("unknown STT model: {model_key}"))?;
        let model_file = model_path(app, spec)?;
        if !model_file.exists() {
            return Err(format!(
                "STT model '{model_key}' is not downloaded yet"
            ));
        }
        let vad_file = model_path(app, &VAD_MODEL)?;

        let mut guard = self.loaded.lock().unwrap();
        let needs_load = guard.as_ref().map(|(key, _)| key != model_key).unwrap_or(true);
        if needs_load {
            let ctx = WhisperContext::new_with_params(
                model_file.to_string_lossy().as_ref(),
                WhisperContextParameters::default(),
            )
            .map_err(|e| format!("failed to load whisper model: {e}"))?;
            *guard = Some((model_key.to_string(), ctx));
        }
        let (_, ctx) = guard.as_ref().expect("context loaded above");

        let mut state = ctx.create_state().map_err(|e| e.to_string())?;
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_print_progress(false);
        params.set_print_special(false);
        params.set_print_realtime(false);
        params.set_suppress_blank(true);
        // English-only model ↔ language pinning; multilingual models auto-detect.
        if model_key.ends_with(".en") {
            params.set_language(Some("en"));
        } else {
            params.set_language(Some("auto"));
        }
        // whisper.cpp's built-in Silero VAD trims leading/trailing silence.
        let vad_path = vad_file.to_string_lossy().into_owned();
        if vad_file.exists() {
            params.set_vad_model_path(Some(vad_path.as_str()));
            params.enable_vad(true);
        }

        state.full(params, samples).map_err(|e| format!("transcription failed: {e}"))?;

        let n = state.full_n_segments();
        let text: String = (0..n)
            .filter_map(|i| {
                state
                    .get_segment(i)
                    .and_then(|s| s.to_str_lossy().ok().map(|c| c.into_owned()))
            })
            .collect::<Vec<_>>()
            .join(" ");
        let text = text.trim().to_string();

        // whisper emits markers like [BLANK_AUDIO] / (wind blowing) on non-speech.
        let is_garbage = text.is_empty()
            || (text.starts_with('[') && text.ends_with(']'))
            || (text.starts_with('(') && text.ends_with(')'));
        if is_garbage {
            Ok(SttOutcome::Empty)
        } else {
            Ok(SttOutcome::Text(text))
        }
    }
}
