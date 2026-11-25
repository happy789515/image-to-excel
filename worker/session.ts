export const SESSION_COOKIE_NAME = 'ite_session'
/** Absolute session lifetime: 24 hours */
export const SESSION_MAX_AGE_SEC = 24 * 60 * 60

export type SessionPayload = {
  sub: string
  iat: number
  exp: number
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecodeToBytes(value: string): Uint8Array | null {
  const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4))
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/') + pad
  try {
    const binary = atob(b64)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export async function createSessionToken(
  username: string,
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = {
    sub: username,
    iat: now,
    exp: now + SESSION_MAX_AGE_SEC,
  }
  const payloadJson = JSON.stringify(payload)
  const payloadBytes = new TextEncoder().encode(payloadJson)
  const payloadPart = base64UrlEncode(payloadBytes)
  const key = await hmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadPart))
  return `${payloadPart}.${base64UrlEncode(new Uint8Array(sig))}`
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const payloadPart = token.slice(0, dot)
  const sigPart = token.slice(dot + 1)
  const sigBytes = base64UrlDecodeToBytes(sigPart)
  if (!sigBytes) return null

  const key = await hmacKey(secret)
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    new TextEncoder().encode(payloadPart),
  )
  if (!valid) return null

  const payloadBytes = base64UrlDecodeToBytes(payloadPart)
  if (!payloadBytes) return null

  let payload: SessionPayload
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as SessionPayload
  } catch {
    return null
  }

  if (
    typeof payload.sub !== 'string' ||
    typeof payload.exp !== 'number' ||
    typeof payload.iat !== 'number'
  ) {
    return null
  }

  const now = Math.floor(Date.now() / 1000)
  if (payload.exp <= now) return null

  return payload
}

export function parseSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const prefix = `${SESSION_COOKIE_NAME}=`
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim()
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length)
    }
  }
  return null
}

export function sessionCookieHeader(token: string, requestUrl: URL): string {
  const secure = requestUrl.protocol === 'https:'
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    `Max-Age=${SESSION_MAX_AGE_SEC}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function clearSessionCookieHeader(requestUrl: URL): string {
  const secure = requestUrl.protocol === 'https:'
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Max-Age=0',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}