# QuickMark

QuickMark is a fast, minimal notes app built with Tauri + React.

## LAN Sharing (Wi‑Fi)

Share notes with another QuickMark instance on the same network.

- Menu → Share → "Send Notes (All)": broadcasts and auto‑detects the first receiver, then sends all notes.
- Menu → Share → "Receive Notes": listens up to 2 minutes and imports received notes.

Notes transfer via UDP discovery on port `51515` and TCP on port `51516`. Discovery broadcasts are sent on all active IPv4 interfaces (Wi‑Fi and Ethernet) using each interface’s directed broadcast address plus the global broadcast, improving cross‑adapter detection. The receiver merges `index.json` entries by `updatedAt` and copies `*.md` files.

Tip: If your OS firewall prompts, allow QuickMark on private networks.

## Development

- Install Rust and Node.js + pnpm
- `pnpm install`
- `pnpm tauri dev`

## Recommended IDE Setup

- VS Code + Tauri extension + rust-analyzer
