const EMPTY_HINT_MSG =
  '표 영역을 찾지 못했습니다. 「영역 추가」로 직접 지정할 수 있습니다.'

export function detectionEmptyHintMessage(emptyHint: boolean): string | null {
  return emptyHint ? EMPTY_HINT_MSG : null
}