import { env } from '@huggingface/transformers'

/** Matches onnxruntime-web in package-lock (jsDelivr CDN paths). */
const ORT_CDN_VERSION = '1.31.0-dev.20260914-8d85527a0'

const ORT_DIST = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_CDN_VERSION}/dist`

let configured = false

function hubProxyBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'https://huggingface.co/'
  }
  // Vite `/hf` proxy cannot follow Hub redirects (`/api/resolve-cache` → SPA HTML).
  // Local dev hits the Hub directly; production uses Worker `/hf/` (redirect: follow).
  if (import.meta.env.DEV) {
    return 'https://huggingface.co/'
  }
  return `${window.location.origin}/hf/`
}

/**
 * ONNX Runtime WASM is loaded from jsDelivr (not bundled into dist).
 * Model weights use same-origin `/hf/` (Worker → Hub proxy) to avoid CORS on deploy.
 */
export function configureTransformersEnv(): void {
  if (configured) return
  configured = true

  env.remoteHost = hubProxyBaseUrl()
  env.useWasmCache = false
  env.useBrowserCache = true

  const wasm = env.backends.onnx.wasm
  if (wasm) {
    wasm.wasmPaths = {
      mjs: `${ORT_DIST}/ort-wasm-simd-threaded.asyncify.mjs`,
      wasm: `${ORT_DIST}/ort-wasm-simd-threaded.asyncify.wasm`,
    }
    wasm.proxy = false
  }
}