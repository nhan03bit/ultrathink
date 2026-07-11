# Releasing UltraThink Studio

This is the operator runbook for cutting a new release. Once it's set up the first time, releases are one `git tag` away.

## One-time setup

### 1. Tauri updater signing key
The updater plugin verifies update artefacts against an Ed25519 public key embedded in the app. Generate the keypair once:

```bash
pnpm --filter @inuverse/studio tauri signer generate -w ~/.tauri/ultrathink.key
# prints the public key — paste into tauri.conf.json under plugins.updater.pubkey
```

Keep `~/.tauri/ultrathink.key` (private) safe — never commit it. Set the env var that `tauri build` reads to sign:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/ultrathink.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<key passphrase>"
```

### 2. macOS code-signing + notarisation
```bash
# Apple Developer cert installed in Keychain → grab its identity name
security find-identity -v -p codesigning
# Set in tauri.conf.json → bundle.macOS.signingIdentity, OR via env:
export APPLE_SIGNING_IDENTITY="Developer ID Application: <Name> (<TeamID>)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="<app-specific password>"  # appleid.apple.com → Sign-In and Security
export APPLE_TEAM_ID="<TeamID>"
```

Tauri will sign the .app, notarise via altool, and staple the ticket automatically when these env vars are set.

### 3. Windows code-signing
EV cert in a USB token or Azure Trusted Signing. Easiest is Azure (no hardware):
```powershell
$env:WIX_SIGN_TOOL = "azure-trusted-signing.cli"
$env:AZURE_KEY_VAULT_URL = "https://<vault>.vault.azure.net"
$env:AZURE_CERT_NAME = "ultrathink-studio"
```
Or with a thumbprint and signtool.exe from Windows SDK:
```powershell
$env:TAURI_WINDOWS_CERT_THUMBPRINT = "<sha1 thumbprint>"
```

### 4. Updater hosting
Static JSON describing the latest release per target. Host on Cloudflare Pages or S3:
```
https://releases.ultrathink.studio/<target>/<from-version>
  → { "version": "0.2.0", "notes": "...", "pub_date": "...", "platforms": { "darwin-aarch64": { "signature": "...", "url": "..." } } }
```
The `tauri build` step emits `latest.json` alongside the bundles — upload it to that URL.

## Per-release flow

```bash
# 1. Bump version in apps/studio/package.json + apps/studio/src-tauri/tauri.conf.json + Cargo.toml
# 2. Update CHANGELOG.md
# 3. Build for all targets locally OR via CI matrix (macos-latest, windows-latest, ubuntu-latest)
pnpm --filter @inuverse/studio tauri:build

# 4. Upload the bundles + latest.json from src-tauri/target/release/bundle/ to releases host
# 5. Tag + push
git tag v0.2.0 && git push --tags

# 6. (Optional) Open a GitHub Release with the artefacts attached for the manual-download path
```

## What ships in a release

- `UltraThink Studio_<v>_aarch64.dmg` — macOS Apple Silicon
- `UltraThink Studio_<v>_x64.dmg` — macOS Intel
- `UltraThink Studio_<v>_x64-setup.exe` — Windows NSIS
- `UltraThink Studio_<v>_x64_en-US.msi` — Windows MSI
- `ultrathink-studio_<v>_amd64.deb` — Debian/Ubuntu
- `ultrathink-studio_<v>_amd64.AppImage` — generic Linux
- `latest.json` — updater manifest

## Embedded engine sidecar

The `apps/studio-engine/dist/` JS is currently resolved at runtime by walking up from the binary (dev mode). For shipped builds, copy the engine dist into `src-tauri/resources/` before running `tauri build`:

```bash
pnpm --filter @inuverse/studio-engine build
mkdir -p apps/studio/src-tauri/resources
cp apps/studio-engine/dist/*.js apps/studio/src-tauri/resources/
```

The Rust shell prefers `resources/sidecar.js` etc. when present. A small CI step can automate this before `tauri build`.
