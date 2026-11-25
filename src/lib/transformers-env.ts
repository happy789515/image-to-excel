import { env } from '@huggingface/transformers'

/** Matches onnxruntime-web in package-lock (jsDelivr CDN paths). */
const ORT_CDN_VERSION = '1.31.0-dev.20260914-8d85527a0'

const ORT_DIST = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_CDN_VERSION}/dist`

let configured = false

/**
 * ONNX Runtime WASM is loaded from jsDelivr (not bundled into dist).
 * Required for Cloudflare Workers static asset 25 MiB limit.
 */
export function configureTransformersEnv(): void {
  if (configured) return
  configured = true

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