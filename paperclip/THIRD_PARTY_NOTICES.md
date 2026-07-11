# Third-Party Notices — Paperclip

This directory vendors source files from the Paperclip AI control plane. The
software is redistributed under the MIT License, reproduced below.

## Vendored Components

All packages share identical MIT terms (`Copyright (c) 2025 Paperclip AI`) and
were vendored at version **2026.416.0** on **2026-04-27** from the upstream
`@paperclipai/*` npm packages.

| Package | Vendored Path |
|---------|---------------|
| `@paperclipai/server` | `paperclip/server` |
| `@paperclipai/db` | `paperclip/db` |
| `@paperclipai/shared` | `paperclip/shared` |
| `@paperclipai/plugin-sdk` | `paperclip/plugin-sdk` |
| `@paperclipai/adapter-utils` | `paperclip/adapter-utils` |
| `@paperclipai/adapter-claude-local` | `paperclip/adapters/claude-local` |
| `@paperclipai/adapter-codex-local` | `paperclip/adapters/codex-local` |
| `@paperclipai/adapter-cursor-local` | `paperclip/adapters/cursor-local` |
| `@paperclipai/adapter-gemini-local` | `paperclip/adapters/gemini-local` |
| `@paperclipai/adapter-opencode-local` | `paperclip/adapters/opencode-local` |
| `@paperclipai/adapter-pi-local` | `paperclip/adapters/pi-local` |
| `@paperclipai/adapter-openclaw-gateway` | `paperclip/adapters/openclaw-gateway` |

**Source:** https://github.com/paperclipai/paperclip
**Vendoring date:** 2026-04-27
**Upstream version:** 2026.416.0

## License Text

```
MIT License

Copyright (c) 2025 Paperclip AI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Notes

- Per-package `LICENSE` files are preserved alongside each vendored package.
- `node_modules/` directories were stripped during vendoring; dependencies will
  be resolved through the root `package.json` and `pnpm.overrides`.
- Pre-built `dist/` directories were retained because the upstream packages
  do not ship source (they are publish artifacts only).
- `paperclip/ui/` was intentionally NOT vendored — UltraThink's Next.js
  dashboard replaces it in M3.
