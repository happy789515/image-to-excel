type ApiErrorBody = { error?: string }

export const AUTH_EXPIRED_EVENT = 'auth-expired'

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      credentials: 'include',
    })
  } catch {
    throw new Error('네트워크 오류로 서버에 연결할 수 없습니다.')
  }

  if (res.ok) {
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  if (res.status === 401) {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
    throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.')
  }

  const body = (await res.json().catch(() => ({}))) as ApiErrorBody
  throw new Error(
    body.error ?? `요청이 실패했습니다. (${res.status})`,
  )
}
