const BY_STATUS: Readonly<Record<number, string>> = {
  400: '요청 형식이 올바르지 않습니다. 이미지와 영역을 확인한 뒤 다시 시도해 주세요.',
  401: 'Gemini API 인증에 실패했습니다. (401)',
  403: 'Gemini API 사용 권한이 없습니다. API 키를 확인해 주세요. (403)',
  413: '이미지가 너무 큽니다(8MB 이하). 영역을 줄이거나 해상도를 낮춰 주세요.',
  429: 'Gemini API 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.',
  500: '서버 설정 오류로 변환을 처리할 수 없습니다. 관리자에게 문의해 주세요.',
  502: 'Gemini API에서 표를 읽지 못했습니다. 잠시 후 다시 시도해 주세요.',
  503: 'Gemini API 또는 서버가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  504: 'Gemini API 응답 시간이 초과되었습니다. 다시 시도해 주세요.',
}

/**
 * Maps /api/extract-table HTTP status to user-facing Korean copy.
 * Prefers status table; uses server `error` when it is already Korean.
 */
export function extractTableErrorMessage(
  status: number,
  serverError?: string,
): string {
  const trimmed = serverError?.trim()
  if (trimmed && /[\u3131-\u318E\uAC00-\uD7A3]/u.test(trimmed)) {
    return trimmed
  }
  const mapped = BY_STATUS[status]
  if (mapped) return mapped
  if (status >= 500) {
    return `서버 오류가 발생했습니다. (${status}) 잠시 후 다시 시도해 주세요.`
  }
  if (status >= 400) {
    return `요청을 처리할 수 없습니다. (${status})`
  }
  if (trimmed) return trimmed
  return 'Excel 변환 중 오류가 발생했습니다.'
}

export function extractTableNetworkErrorMessage(cause: unknown): string {
  if (cause instanceof DOMException && cause.name === 'AbortError') {
    return '변환을 취소했습니다.'
  }
  if (cause instanceof TypeError) {
    return '서버에 연결할 수 없습니다. Worker가 실행 중인지 확인해 주세요.'
  }
  if (cause instanceof Error && cause.message) {
    return cause.message
  }
  return 'Excel 변환 중 오류가 발생했습니다.'
}