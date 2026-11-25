# Wrangler `write EOF` on Windows

If `npm run dev:worker` stops with:

```text
X [ERROR] write EOF
Error in ProxyController: Failed to send message to InspectorProxyWorker
```

Wrangler’s local **workerd** runtime failed to start. This is usually missing **Visual C++ Redistributable**, not a bug in `worker/index.ts`.

## Fix (recommended)

**PowerShell or CMD (admin not required):**

```powershell
winget install Microsoft.VCRedist.2015+.x64
```

Or download [VC++ x64](https://aka.ms/vs/17/release/vc_redist.x64.exe), install, **restart the terminal**, then:

```bash
npm run dev:worker
```

Check:

- <http://127.0.0.1:8787/api/health> → `{"ok":true}`
- <http://127.0.0.1:8787/> → app UI

## If it still fails

1. Run `npx wrangler login`, then `npx wrangler dev --remote` (uses Cloudflare’s dev session instead of local workerd).
2. Or deploy once: `npm run deploy` and test `/api/health` on the live URL.

## Until local dev works

`npm run verify:workers` (dry-run) still validates Worker + assets config without starting `wrangler dev`.