import {
  handleLogin,
  handleLogout,
  handleMe,
  requireSession,
} from './auth'
import { handleHuggingFaceProxy } from './hf-proxy'
import { handleProjects } from './projects'

export { UsExit } from './us-exit'

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return Response.json({
        ok: true,
        auth: {
          sessionSecret: Boolean(env.SESSION_SECRET?.trim()),
          authUsers: Boolean(env.AUTH_USERS?.trim()),
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

    if (url.pathname === '/api/projects' || url.pathname.startsWith('/api/projects/')) {
      const session = await requireSession(request, env)
      if (session instanceof Response) return session
      return handleProjects(request, env, session)
    }

    if (url.pathname === '/hf' || url.pathname.startsWith('/hf/')) {
      return handleHuggingFaceProxy(request)
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>