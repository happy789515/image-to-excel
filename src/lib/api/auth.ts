type ApiErrorBody = {
  error?: string
  code?: string
}

export type AuthUser = {
  username: string
}

export type AuthCheckResult =
  | { ready: true; user: AuthUser | null }
  | { ready: false; message: string }

type HealthBody = {
  ok?: boolean
  auth?: { sessionSecret?: boolean; authUsers?: boolean }
}

async function ensureAuthBackendReady(
  signal?: AbortSignal,
): Promise<AuthCheckResult | null> {
  let res: Response
  try {
    res = await fetch('/api/health', { signal })
  } catch {
    return {
      ready: false,
      message:
        'API 서버에 연결할 수 없습니다. `wrangler dev`(127.0.0.1:8787)가 실행 중인지 확인하세요.',
    }
  }
  if (!res.ok) return null
  const body = (await res.json().catch(() => ({}))) as HealthBody
  if (!body.auth) return null
  if (!body.auth.sessionSecret || !body.auth.authUsers) {
    return {
      ready: false,
      message:
        'Worker에 인증 환경 변수가 로드되지 않았습니다. 8787 포트의 `wrangler dev`를 모두 종료한 뒤 하나만 다시 실행하세요. (.dev.vars 변경 후에도 재시작 필요)',
    }
  }
  return null
}

export async function checkAuth(
  signal?: AbortSignal,
): Promise<AuthCheckResult> {
  const backend = await ensureAuthBackendReady(signal)
  if (backend) return backend

  let res: Response
  try {
    res = await fetch('/api/me', { credentials: 'include', signal })
  } catch {
    return {
      ready: false,
      message:
        'API 서버에 연결할 수 없습니다. `wrangler dev`(127.0.0.1:8787)가 실행 중인지 확인하세요.',
    }
  }

  if (res.status === 401) {
    return { ready: true, user: null }
  }

  if (res.status === 503) {
    const body = (await res.json().catch(() => ({}))) as ApiErrorBody
    return {
      ready: false,
      message:
        body.code === 'AUTH_NOT_CONFIGURED'
          ? '인증 환경 변수가 Worker에 없습니다. `.dev.vars`를 확인한 뒤 wrangler dev를 재시작하세요.'
          : (body.error ?? '인증 서버를 사용할 수 없습니다.'),
    }
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiErrorBody
    return {
      ready: false,
      message: body.error ?? `Auth check failed (${res.status})`,
    }
  }

  const body = (await res.json()) as { user?: AuthUser }
  if (!body.user?.username) {
    return { ready: false, message: 'Invalid auth response' }
  }
  return { ready: true, user: body.user }
}

/** @deprecated Use checkAuth */
export async function fetchMe(signal?: AbortSignal): Promise<AuthUser | null> {
  const result = await checkAuth(signal)
  if (!result.ready) return null
  return result.user
}

export async function loginApi(
  username: string,
  password: string,
  signal?: AbortSignal,
): Promise<AuthUser> {
  const res = await fetch('/api/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ username, password }),
  })
  const body = (await res.json()) as { user?: AuthUser } & ApiErrorBody
  if (!res.ok) {
    if (res.status === 503 && body.code === 'AUTH_NOT_CONFIGURED') {
      throw new Error(
        '인증 환경 변수가 Worker에 없습니다. wrangler dev를 재시작하세요.',
      )
    }
    throw new Error(body.error ?? `Login failed (${res.status})`)
  }
  if (!body.user?.username) throw new Error('Invalid login response')
  return body.user
}

export async function logoutApi(signal?: AbortSignal): Promise<void> {
  const res = await fetch('/api/logout', {
    method: 'POST',
    credentials: 'include',
    signal,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiErrorBody
    throw new Error(body.error ?? `Logout failed (${res.status})`)
  }
}