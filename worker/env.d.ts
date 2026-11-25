interface Env {
  ASSETS: Fetcher
  GEMINI_API_KEY: string
  /** JSON array: [{ "username": "...", "password": "..." }] */
  AUTH_USERS: string
  /** HMAC secret for signed session cookies */
  SESSION_SECRET: string
}