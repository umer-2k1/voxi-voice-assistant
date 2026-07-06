use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::Mutex;

use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager};

const MAX_RESPAWNS: u32 = 5;

/// Supervises the agent sidecar process: spawn with the session token in
/// the environment, read the `{"port": N}` handshake from stdout, respawn
/// on crash with a cap, and kill on shutdown.
#[derive(Default)]
pub struct Sidecar {
    port: AtomicU16,
    child: Mutex<Option<Child>>,
    shutting_down: AtomicBool,
    respawns: Mutex<u32>,
}

#[derive(Deserialize)]
struct Handshake {
    port: u16,
}

impl Sidecar {
    pub fn port(&self) -> Option<u16> {
        match self.port.load(Ordering::SeqCst) {
            0 => None,
            p => Some(p),
        }
    }
}

/// Resolve the sidecar launch command.
/// `VOX_SIDECAR_CMD` overrides (whitespace-split); the dev default runs
/// the workspace's tsx against sidecar/src/index.ts. Release builds will
/// ship a compiled binary via Tauri externalBin (M8).
fn launch_command() -> Result<Command, String> {
    if let Ok(raw) = std::env::var("VOX_SIDECAR_CMD") {
        let mut parts = raw.split_whitespace();
        let program = parts.next().ok_or("VOX_SIDECAR_CMD is empty")?;
        let mut cmd = Command::new(program);
        cmd.args(parts);
        return Ok(cmd);
    }

    // Dev: src-tauri is the cwd under `tauri dev`; the sidecar package sits
    // next to it in the workspace.
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    let root = if cwd.ends_with("src-tauri") {
        cwd.parent().map(|p| p.to_path_buf()).unwrap_or(cwd)
    } else {
        cwd
    };
    let sidecar_dir = root.join("sidecar");
    let tsx = sidecar_dir.join("node_modules/.bin/tsx");
    if !tsx.exists() {
        return Err(format!("tsx not found at {}", tsx.display()));
    }
    let mut cmd = Command::new(tsx);
    cmd.arg("src/index.ts").current_dir(sidecar_dir);
    Ok(cmd)
}

pub fn spawn(app: &AppHandle) {
    let state = app.state::<Sidecar>();
    if state.shutting_down.load(Ordering::SeqCst) {
        return;
    }

    let token = app.state::<crate::AppState>().session_token.clone();
    let mut cmd = match launch_command() {
        Ok(c) => c,
        Err(e) => {
            log::error!("sidecar launch command unavailable: {e}");
            let _ = app.emit("sidecar-status", "unavailable");
            return;
        }
    };
    cmd.env("VOX_SESSION_TOKEN", &token)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            log::error!("failed to spawn sidecar: {e}");
            let _ = app.emit("sidecar-status", "failed");
            return;
        }
    };

    let stdout = child.stdout.take().expect("piped stdout");
    let stderr = child.stderr.take().expect("piped stderr");
    *state.child.lock().unwrap() = Some(child);
    let _ = app.emit("sidecar-status", "starting");

    // Forward sidecar stderr into our logs.
    std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            log::info!("[sidecar] {line}");
        }
    });

    // Handshake + lifetime watch.
    let app = app.clone();
    std::thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();

        if reader.read_line(&mut line).unwrap_or(0) > 0 {
            match serde_json::from_str::<Handshake>(line.trim()) {
                Ok(h) => {
                    let state = app.state::<Sidecar>();
                    state.port.store(h.port, Ordering::SeqCst);
                    *state.respawns.lock().unwrap() = 0;
                    log::info!("sidecar ready on 127.0.0.1:{}", h.port);
                    let _ = app.emit("sidecar-status", "ready");
                    crate::core_client::connect(&app, h.port);
                }
                Err(e) => log::error!("bad sidecar handshake {line:?}: {e}"),
            }
        }

        // Drain remaining stdout until the process exits.
        for extra in reader.lines().map_while(Result::ok) {
            log::info!("[sidecar] {extra}");
        }

        let state = app.state::<Sidecar>();
        state.port.store(0, Ordering::SeqCst);
        if state.shutting_down.load(Ordering::SeqCst) {
            return;
        }
        let _ = app.emit("sidecar-status", "stopped");

        let attempts = {
            let mut r = state.respawns.lock().unwrap();
            *r += 1;
            *r
        };
        if attempts <= MAX_RESPAWNS {
            let delay = std::time::Duration::from_millis(500 * u64::from(attempts));
            log::warn!("sidecar exited; respawn {attempts}/{MAX_RESPAWNS} in {delay:?}");
            std::thread::sleep(delay);
            spawn(&app);
        } else {
            log::error!("sidecar exceeded respawn limit; giving up");
            let _ = app.emit("sidecar-status", "failed");
        }
    });
}

pub fn shutdown(app: &AppHandle) {
    let state = app.state::<Sidecar>();
    state.shutting_down.store(true, Ordering::SeqCst);
    let taken = state.child.lock().unwrap().take();
    if let Some(mut child) = taken {
        let _ = child.kill();
        let _ = child.wait();
    }
}
