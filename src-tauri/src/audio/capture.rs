use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

/// Mic capture driven by the push-to-talk hotkey.
///
/// cpal streams are not `Send`, so each capture runs on its own thread that
/// owns the stream and blocks until `stop` signals it. Samples accumulate in
/// a shared buffer at the device's native rate and are converted to 16 kHz
/// mono on release.
#[derive(Default)]
pub struct AudioCapture {
    active: Mutex<Option<ActiveCapture>>,
}

struct ActiveCapture {
    stop_tx: mpsc::Sender<()>,
    buffer: Arc<Mutex<Vec<f32>>>,
    config_rx: mpsc::Receiver<(u32, u16)>,
    started: Instant,
}

#[derive(Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum MicState {
    Idle,
    Listening,
    /// Set while STT/agent work runs.
    Thinking,
}

pub fn emit_mic_state(app: &AppHandle, state: MicState) {
    let _ = app.emit("mic-state", state);
}

pub fn start(app: &AppHandle) {
    let capture = app.state::<AudioCapture>();
    let mut active = capture.active.lock().unwrap();
    if active.is_some() {
        return; // key repeat while already capturing
    }

    let buffer: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::with_capacity(16_000 * 30)));
    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let (config_tx, config_rx) = mpsc::channel::<(u32, u16)>();

    let thread_buffer = Arc::clone(&buffer);
    let thread_app = app.clone();
    std::thread::spawn(move || {
        let host = cpal::default_host();
        let Some(device) = host.default_input_device() else {
            log::error!("no input device available");
            let _ = thread_app.emit("mic-error", "No microphone available");
            return;
        };
        let config = match device.default_input_config() {
            Ok(c) => c,
            Err(e) => {
                log::error!("default_input_config failed: {e}");
                let _ = thread_app.emit("mic-error", "Could not read microphone configuration");
                return;
            }
        };
        let sample_rate = config.sample_rate().0;
        let channels = config.channels();
        let _ = config_tx.send((sample_rate, channels));

        let stream = device.build_input_stream(
            &config.into(),
            move |data: &[f32], _| {
                thread_buffer.lock().unwrap().extend_from_slice(data);
            },
            |e| log::error!("input stream error: {e}"),
            None,
        );
        let stream = match stream {
            Ok(s) => s,
            Err(e) => {
                log::error!("build_input_stream failed: {e}");
                let _ = thread_app.emit("mic-error", "Could not open the microphone");
                return;
            }
        };
        if let Err(e) = stream.play() {
            log::error!("stream.play failed: {e}");
            return;
        }
        // Block until release; dropping the stream stops capture.
        let _ = stop_rx.recv();
    });

    *active = Some(ActiveCapture {
        stop_tx,
        buffer,
        config_rx,
        started: Instant::now(),
    });
    emit_mic_state(app, MicState::Listening);
}

/// Stop capture and return 16 kHz mono samples (None if nothing was captured).
pub fn stop(app: &AppHandle) -> Option<Vec<f32>> {
    let capture = app.state::<AudioCapture>();
    let taken = capture.active.lock().unwrap().take()?;

    let _ = taken.stop_tx.send(());
    let held = taken.started.elapsed();
    let raw: Vec<f32> = std::mem::take(&mut *taken.buffer.lock().unwrap());
    let (sample_rate, channels) = taken
        .config_rx
        .try_recv()
        .unwrap_or((super::resample::TARGET_SAMPLE_RATE, 1));

    let samples = super::resample::to_whisper_input(&raw, sample_rate, channels);

    // M1 exit test: buffer length is observable on release.
    log::info!(
        "capture ended: held {:.2}s, {} raw samples @ {sample_rate} Hz x{channels} -> {} samples @ 16 kHz",
        held.as_secs_f32(),
        raw.len(),
        samples.len()
    );
    let _ = app.emit(
        "capture-ended",
        serde_json::json!({
            "held_secs": held.as_secs_f32(),
            "samples_16k": samples.len(),
        }),
    );
    emit_mic_state(app, MicState::Idle);

    if samples.is_empty() {
        None
    } else {
        Some(samples)
    }
}
