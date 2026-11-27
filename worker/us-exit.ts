const GEMINI_HOST = 'https://generativelanguage.googleapis.com'

type ProxyPayload = {
  url: string
  init: {
    method: string
    headers: Record<string, string>
    body?: string
  }
}

/**
 * Regional egress for Gemini — apac-ne (Northeast Asia) for lower KR latency.
 * Avoids routing via wnam when DO is placed near Korea/Japan.
 */
export class UsExit {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    let payload: ProxyPayload
    try {
      payload = (await request.json()) as ProxyPayload
    } catch {
      return new Response('Bad Request', { status: 400 })
    }

    const { url, init } = payload
    if (!url.startsWith(`${GEMINI_HOST}/`)) {
      return new Response('Forbidden', { status: 403 })
    }

    return fetch(url, {
      method: init.method,
      headers: init.headers,
      body: init.body,
    })
  }
}