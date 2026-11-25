const US_EXIT_NAME = 'gemini-us'

export async function fetchGemini(
  env: Env,
  url: string,
  init: RequestInit,
): Promise<Response> {
  const headers = new Headers(init.headers)
  const headerRecord: Record<string, string> = {}
  headers.forEach((value, key) => {
    headerRecord[key] = value
  })

  const stub = env.US_EXIT.get(env.US_EXIT.idFromName(US_EXIT_NAME), {
    locationHint: 'wnam',
  })

  return stub.fetch('https://us-exit.internal/', {
    method: 'POST',
    body: JSON.stringify({
      url,
      init: {
        method: init.method ?? 'GET',
        headers: headerRecord,
        body: typeof init.body === 'string' ? init.body : undefined,
      },
    }),
  })
}