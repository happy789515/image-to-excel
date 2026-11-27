interface Env {
  ASSETS: Fetcher
  US_EXIT: DurableObjectNamespace
  DB: D1Database
  GEMINI_API_KEY: string
  /** HMAC secret for signed session cookies */
  SESSION_SECRET: string
}