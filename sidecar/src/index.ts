/**
 * Vox agent sidecar entry point.
 *
 * Spawned by the Rust core with VOX_SESSION_TOKEN in the environment.
 * Binds a WebSocket server to 127.0.0.1 on an OS-assigned port and prints
 * `{"port": N}` on stdout so the core can complete the handshake.
 *
 * M3 fills this in; for now it is a placeholder so the workspace resolves.
 */

const token = process.env['VOX_SESSION_TOKEN'];

if (!token) {
  console.error('VOX_SESSION_TOKEN not set; refusing to start.');
  process.exit(1);
}

console.log(JSON.stringify({ status: 'placeholder', port: 0 }));
