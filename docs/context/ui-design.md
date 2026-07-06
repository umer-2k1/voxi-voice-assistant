# UI design — Vox "Halcyon" Light v1.0

Source: `Vox Design System.html` (root). Full token dump: [design-tokens.txt](design-tokens.txt).

## Principles
- One confident accent (Vox Blue `#4B57E8`) on cool near-neutral grays; semantic hues muted and sparing.
- Hanken Grotesk for everything a **person** reads; IBM Plex Mono for everything the **machine** says (system labels, timestamps, keycaps, connector names, on-device data). This contrast is a core brand signal.
- Borders-first elevation: hairline borders everywhere; shadow only for genuine floats (popovers, dialogs, active-mic glow, window).
- **Only the voice moves**: equalizer (0.95s) and listening pulse (2.1s) are the only looping animations. Everything else is a single ease-out on state change (120/200/320ms, cubic-bezier(.2,.7,.2,1)).
- No emoji, no gradients, sentence case, no exclamation marks.

## Core tokens
- Primary scale: blue-50 `#EEF0FE` → blue-500 `#4B57E8` (primary) → blue-800 `#2C337E`
- Neutrals: ink `#1A1C22`, gray-900→50 (`#23262E`…`#FBFBFD`), surface-app `#E4E6EA`
- Semantic: success `#22A366` (+bg `#E7F6EE`), caution `#E0A32E` (+bg `#FFFCF4`, line `#F0E4C6`, text `#9A7A20`) — used for confirm-before-acting; danger `#DC4B43` (+bg `#FDECEA`) — destructive only
- Type: display-xl 40/800/-0.03em · display 32/800 · title 25/800 · heading 19/700 · subhead 16 · body 14/400/1.55 · small 13 · caption 12 · mono-data 12 · mono-label 10.5/0.1em/caps
- Spacing: 4px grid (2,4,6,8,12,16,20,24,32,40,48,64); sidebar 244px; content pad 34px
- Radius: xs4 sm6 md9 lg12 xl16 window18 pill; controls 9–10, cards 12–16
- Focus ring: `0 0 0 3px rgba(75,87,232,.28)`
- Shadows: card/sm subtle; md popover; pop dialog; glow `0 8px 20px -6px rgba(75,87,232,.55)` (active mic only); window `0 40px 90px -40px`

## Components (spec'd in the design system)
Buttons (primary/secondary/ghost/danger/disabled, sm/lg) · hotkey keycap input (`⌥ Space`) · search input · select · toggles · badges/tags/status (Connected, Needs auth, IDLE) · status dots (online/alert/idle/active) · connector monograms (2-letter mono: GH, FS) · keycaps · sidebar nav items · connector rows (monogram + name + `transport · N tools` mono + status + toggle) · mic states (idle/listening/thinking) · transcript turns (user right-aligned? — see HTML reference) · confirm-before-acting card (mono caution label "CONFIRM BEFORE …", body, "Confirm & send" primary + "Edit" secondary) · destructive dialog (Cancel + Disconnect danger) · toasts (action result + Undo, token-expiry warning)

## Voice & tone
Calm, direct, never chatty. States what it did, flags what needs a decision, gets out of the way. "Done — opened ~/Documents." Never "Sure thing! 🎉".
