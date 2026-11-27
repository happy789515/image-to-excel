import {
  handleLogin,
  handleLogout,
  handleMe,
  requireSession,
} from './auth'
import { handleGemini } from './gemini-routes'
import { handleHuggingFaceProxy } from './hf-proxy'

export { UsExit } from './us-exit'

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return Response.json({
        ok: true,
        auth: {
          sessionSecret: Boolean(env.SESSION_SECRET?.trim()),
          authDb: Boolean(env.DB),
        },
      })
    }

    if (url.pathname === '/api/login' && request.method === 'POST') {
      return handleLogin(request, env)
    }

    if (url.pathname === '/api/logout' && request.method === 'POST') {
      return handleLogout(request)
    }

    if (url.pathname === '/api/me' && request.method === 'GET') {
      return handleMe(request, env)
    }

    if (url.pathname.startsWith('/api/gemini/')) {
      const session = await requireSession(request, env)
      if (session instanceof Response) return session
      return handleGemini(request, env, url.pathname)
    }

    if (url.pathname === '/hf' || url.pathname.startsWith('/hf/')) {
      return handleHuggingFaceProxy(request)
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>