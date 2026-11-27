export type WorkshopStepId = 'detect' | 'group' | 'convert' | 'review'

export const WORKSHOP_STEPS: WorkshopStepId[] = [
  'detect',
  'group',
  'convert',
  'review',
]

export const WORKSHOP_STEP_LABELS: Record<WorkshopStepId, string> = {
  detect: '표 검출',
  group: '시트 그룹',
  convert: '엑셀 변환',
  review: '검수 및 다운로드',
}

export const WORKSHOP_STEP_HINTS: Record<WorkshopStepId, string> = {
  detect: '원본에서 표 영역을 확인·수정합니다.',
  group: '헤더가 비슷한 표를 시트별로 묶습니다.',
  convert: '시트별로 셀 데이터를 추출하고 미리봅니다.',
  review: '내용을 확인한 뒤 Excel 파일을 받습니다.',
}

export function workshopStepIndex(step: WorkshopStepId): number {
  return WORKSHOP_STEPS.indexOf(step)
}