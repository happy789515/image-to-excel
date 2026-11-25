export type PreprocessPreset = 'standard' | 'scan' | 'photo'

export type PreprocessOptions = {
  preset: PreprocessPreset
  debug?: boolean
}

export const PRESET_LABELS: Record<PreprocessPreset, string> = {
  standard: '일반 (스크린샷·선명 스캔)',
  scan: '스캔 (저대비·흐림)',
  photo: '사진 (그림자·기울기)',
}