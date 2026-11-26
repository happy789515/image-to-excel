interface Env {
  ASSETS: Fetcher
  US_EXIT: DurableObjectNamespace
  DB: D1Database
  IMAGES: R2Bucket
  GEMINI_API_KEY: string
  /** JSON array: [{ "username": "...", "password": "..." }] */
  AUTH_USERS: string
  /** HMAC secret for signed session cookies */
  SESSION_SECRET: string
}