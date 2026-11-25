/**
 * Per-image workflow phases aligned with real pipeline:
 * local ONNX detect → user review → crop+Gemini extract → xlsx package.
 */
export type WorkflowPhaseId =
  | 'idle'
  | 'detecting'
  | 'review'
  | 'extracting'
  | 'packaging'
  | 'complete'
  | 'error'

/** Top bar milestones only — not every log line or micro-step. */
export const PIPELINE_PHASES: WorkflowPhaseId[] = [
  'detecting',
  'review',
  'extracting',
  'packaging',
]

export const PHASE_DISPLAY: Record<
  WorkflowPhaseId,
  { title: string; rail: string }
> = {
  idle: { title: '대기', rail: '—' },
  detecting: { title: '로컬 표 영역 검출', rail: '검출' },
  review: { title: '영역·시트 확인', rail: '확인' },
  extracting: { title: '표 셀 추출 (Gemini)', rail: '추출' },
  packaging: { title: 'Excel 파일 조립', rail: '조립' },
  complete: { title: '완료', rail: '완료' },
  error: { title: '중단됨', rail: '오류' },
}