const HF_ORIGIN = 'https://huggingface.co'

const HF_PATH_PREFIX = '/hf'

/** Hub model files — browser cannot fetch HF directly from the Workers origin (CORS). */
export async function handleHuggingFaceProxy(request: Request): Promise<Response> {
  const url = new URL(request.url)

  if (request.method === 'OPTIONS') {
    return corsPreflight(request)
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return withCors(request, new Response('Method Not Allowed', { status: 405 }))
  }

  if (!url.pathname.startsWith(HF_PATH_PREFIX)) {
    return withCors(request, new Response('Not Found', { status: 404 }))
  }

  const hubPath =
    url.pathname === HF_PATH_PREFIX
      ? '/'
      : url.pathname.slice(HF_PATH_PREFIX.length)
  if (hubPath.includes('..') || !hubPath.startsWith('/')) {
    return withCors(request, new Response('Bad Request', { status: 400 }))
  }

  const upstreamUrl = new URL(`${hubPath}${url.search}`, HF_ORIGIN)

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      redirect: 'follow',
      headers: {
        Accept: request.headers.get('Accept') ?? '*/*',
        'User-Agent': 'image-to-excel-hf-proxy',
      },
    })
  } catch {
    return withCors(request, new Response('Bad Gateway', { status: 502 }))
  }

  const headers = new Headers()
  const contentType = upstream.headers.get('Content-Type')
  if (contentType) headers.set('Content-Type', contentType)
  const cacheControl = upstream.headers.get('Cache-Control')
  if (cacheControl) headers.set('Cache-Control', cacheControl)

  return withCors(
    request,
    new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      headers,
    }),
  )
}

function corsOrigin(request: Request): string {
  const origin = request.headers.get('Origin')
  if (origin) return origin
  return '*'
}

function corsHeaders(request: Request): Headers {
  const headers = new Headers()
  headers.set('Access-Control-Allow-Origin', corsOrigin(request))
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  headers.set(
    'Access-Control-Allow-Headers',
    request.headers.get('Access-Control-Request-Headers') ?? 'Content-Type',
  )
  headers.set('Vary', 'Origin')
  return headers
}

function corsPreflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) })
}

function withCors(request: Request, response: Response): Response {
  const headers = new Headers(response.headers)
  for (const [key, value] of corsHeaders(request)) {
    headers.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}