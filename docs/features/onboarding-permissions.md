# Onboarding & permissions

## Overview
First-run wizard (main window, gated by `localStorage["vox-onboarded"]`): welcome → permissions → reasoning model → ready. The permissions step — and an identical Settings → Permissions section — lists every OS permission Vox uses with an explicit "why" and "when", live state, and one-click grant actions. All permissions are skippable; the matching feature stays off until granted.

## Permissions
| Permission | Why | When exercised | Grant path |
|---|---|---|---|
| Microphone | hear voice commands | only while the push-to-talk hotkey is held; on-device transcription | `request_microphone` fires the TCC prompt via a brief capture; denied → deep-link to System Settings |
| Accessibility (macOS) | type dictated text / act in other apps | only when a spoken command asks for it | `request_accessibility` fires the AX consent prompt; also deep-link |
| Notifications | announce finished commands / approval requests | only while Vox works in the background (app unfocused) | `requestPermission()` from tauri-plugin-notification |

## Flow
- `PermissionList` (frontend/src/components/vox/permission-list.tsx) polls `checkAllPermissions()` every 2s — Rust `check_permissions` (AVFoundation TCC state + `AXIsProcessTrusted` + device presence) merged with the notification plugin state — so prompts answered outside the app are picked up automatically.
- `notifyIfUnfocused` (frontend/src/lib/notify.ts) raises system notifications from the main window only, on `confirm_request` and `need_input`, and only when `document.hasFocus()` is false.
- `PermissionsBanner` stays as the post-onboarding safety net for denied mic / missing Accessibility.

## APIs
Tauri commands: `check_permissions` → `{accessibility, microphone: granted|denied|undetermined|unknown, microphone_device}`, `request_microphone`, `request_accessibility` → bool, `open_system_settings(pane: accessibility|microphone|notifications)`.

## Future improvements
- Screen-recording permission when the vision/ambient-context layer lands (do not request before it exists).
- Windows notification settings deep-link.
