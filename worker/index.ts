import { handleExtractTable } from './extract-table'

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return Response.json({ ok: true })
    }

    if (url.pathname === '/api/extract-table' && request.method === 'POST') {
      return handleExtractTable(request, env)
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>