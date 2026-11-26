/** HTTP status returned to the client for Gemini upstream failures. */
export function clientStatusFromGeminiUpstream(upstreamStatus: number): number {
  if (upstreamStatus === 429) return 429
  if (upstreamStatus === 401) return 401
  if (upstreamStatus === 403) return 403
  if (upstreamStatus === 400) return 400
  if (upstreamStatus === 413) return 413
  if (upstreamStatus === 503) return 503
  if (upstreamStatus === 504) return 504
  if (upstreamStatus >= 500) return 502
  return 502
}

export function workerExtractTableErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return '요청 형식이 올바르지 않습니다. 이미지와 영역을 확인한 뒤 다시 시도해 주세요.'
    case 401:
      return 'Gemini API 인증에 실패했습니다. (401)'
    case 403:
      return 'Gemini API 사용 권한이 없습니다. API 키를 확인해 주세요. (403)'
    case 413:
      return '이미지가 8MB 제한을 초과했습니다. 영역을 줄이거나 해상도를 낮춰 주세요.'
    case 429:
      return 'Gemini API 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.'
    case 500:
      return '서버에 Gemini API 키가 설정되어 있지 않습니다.'
    case 502:
      return 'Gemini API에서 표를 읽지 못했습니다. 잠시 후 다시 시도해 주세요.'
    case 503:
      return 'Gemini API 또는 서버가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
    case 504:
      return 'Gemini API 응답 시간이 초과되었습니다. 다시 시도해 주세요.'
    default:
      if (status >= 500) {
        return `서버 오류가 발생했습니다. (${status})`
      }
      return `요청을 처리할 수 없습니다. (${status})`
  }
}

export function workerGeminiRequestTooLargeMessage(): string {
  return '요청 크기가 제한(20MB)을 초과했습니다. 크롭 해상도를 낮추거나 이미지 수를 줄여 주세요.'
}

export function workerUploadTooLargeMessage(): string {
  return '파일 크기가 15MB 제한을 초과합니다.'
}