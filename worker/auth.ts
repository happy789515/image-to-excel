import {
  clearSessionCookieHeader,
  createSessionToken,
  parseSessionCookie,
  sessionCookieHeader,
  verifySessionToken,
  type SessionPayload,
} from './session'

export type AuthUser = { username: string; password: string }

function jsonError(status: number, message: string, code?: string): Response {
  return Response.json({ error: message, code }, { status })
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  if (ab.length !== bb.length) return false
  let mismatch = 0
  for (let i = 0; i < ab.length; i++) mismatch |= ab[i]! ^ bb[i]!
  return mismatch === 0
}

export function parseAuthUsers(raw: string | undefined): AuthUser[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const users: AuthUser[] = []
    for (const entry of parsed) {
      if (
        entry &&
        typeof entry === 'object' &&
        typeof (entry as AuthUser).username === 'string' &&
        typeof (entry as AuthUser).password === 'string'
      ) {
        users.push({
          username: (entry as AuthUser).username,
          password: (entry as AuthUser).password,
        })
      }
    }
    return users
  } catch {
    return []
  }
}

function findValidUser(users: AuthUser[], username: string, password: string): boolean {
  for (const user of users) {
    if (user.username === username && timingSafeEqual(user.password, password)) {
      return true
    }
  }
  return false
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

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (!env.SESSION_SECRET?.trim() || !env.AUTH_USERS?.trim()) {
    return jsonError(503, 'Login is not configured', 'AUTH_NOT_CONFIGURED')
  }

  const users = parseAuthUsers(env.AUTH_USERS)
  if (users.length === 0) {
    return jsonError(503, 'No login accounts configured', 'AUTH_NOT_CONFIGURED')
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

  if (!findValidUser(users, username, password)) {
    return jsonError(401, 'Invalid credentials', 'INVALID_CREDENTIALS')
  }

  const token = await createSessionToken(username, env.SESSION_SECRET)
  const url = new URL(request.url)

  return Response.json(
    { user: { username } },
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