import { hashPassword, verifyPassword, type PasswordRecord } from './password'
import {
  clearSessionCookieHeader,
  createSessionToken,
  parseSessionCookie,
  sessionCookieHeader,
  verifySessionToken,
  type SessionPayload,
} from './session'

function jsonError(status: number, message: string, code?: string): Response {
  return Response.json({ error: message, code }, { status })
}

export async function requireSession(
  request: Request,
  env: Env,
): Promise<SessionPayload | Response> {
  if (!env.SESSION_SECRET?.trim()) {
    return jsonError(503, 'Session is not configured', 'AUTH_NOT_CONFIGURED')
  }
  const token = parseSessionCookie(request.headers.get('Cookie'))
  if (!token) {
    return jsonError(401, 'Sign in required', 'SESSION_REQUIRED')
  }
  const payload = await verifySessionToken(token, env.SESSION_SECRET)
  if (!payload) {
    return jsonError(401, 'Session expired or invalid', 'SESSION_EXPIRED')
  }
  return payload
}

type LoginBody = { username?: string; password?: string }

type UserRow = PasswordRecord & { username: string }

async function findUser(env: Env, username: string): Promise<UserRow | null> {
  return env.DB.prepare(
    'SELECT username, password_hash AS passwordHash, salt, iterations FROM users WHERE username = ?',
  )
    .bind(username)
    .first<UserRow>()
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (!env.SESSION_SECRET?.trim()) {
    return jsonError(503, 'Login is not configured', 'AUTH_NOT_CONFIGURED')
  }

  let body: LoginBody
  try {
    body = (await request.json()) as LoginBody
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!username || !password) {
    return jsonError(400, 'Username and password are required')
  }

  const user = await findUser(env, username)
  if (!user) {
    // Burn the same PBKDF2 cost for unknown users to avoid revealing which usernames exist.
    await hashPassword(password)
    return jsonError(401, 'Invalid credentials', 'INVALID_CREDENTIALS')
  }

  const valid = await verifyPassword(password, user)
  if (!valid) {
    return jsonError(401, 'Invalid credentials', 'INVALID_CREDENTIALS')
  }

  const token = await createSessionToken(user.username, env.SESSION_SECRET)
  const url = new URL(request.url)

  return Response.json(
    { user: { username: user.username } },
    {
      headers: { 'Set-Cookie': sessionCookieHeader(token, url) },
    },
  )
}

export async function handleLogout(request: Request): Promise<Response> {
  const url = new URL(request.url)
  return Response.json(
    { ok: true },
    { headers: { 'Set-Cookie': clearSessionCookieHeader(url) } },
  )
}

export async function handleMe(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env)
  if (session instanceof Response) return session
  return Response.json({ user: { username: session.sub } })
}
