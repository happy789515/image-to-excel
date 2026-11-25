import { loadTableDetector } from '@/lib/table-detection/detector'

export type BootPhaseId =
  | 'app-init'
  | 'runtime'
  | 'model-download'
  | 'model-init'
  | 'ready'
  | 'error'

export type BootPhase = {
  id: BootPhaseId
  /** 현재 진행 중인 작업 한 줄 설명 */
  detail: string
}

export const BOOT_STEP_LABELS: Record<
  Exclude<BootPhaseId, 'error'>,
  string
> = {
  'app-init': '애플리케이션 준비',
  runtime: 'ONNX Runtime (WASM) 로드',
  'model-download': '표 검출 모델 다운로드',
  'model-init': '모델 초기화',
  ready: '준비 완료',
}

export async function bootstrapTableDetection(
  onPhase: (phase: BootPhase) => void,
): Promise<void> {
  try {
    onPhase({ id: 'app-init', detail: '환경을 확인하는 중…' })
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })

    onPhase({
      id: 'runtime',
      detail: '브라우저 추론 엔진(WASM)을 불러오는 중…',
    })

    onPhase({
      id: 'model-download',
      detail:
        'Xenova/table-transformer-detection 가중치 다운로드 중… (캐시되면 생략)',
    })

    await loadTableDetector()

    onPhase({
      id: 'model-init',
      detail: 'ONNX 세션을 생성하고 파이프라인을 준비하는 중…',
    })

    onPhase({ id: 'ready', detail: '이미지를 업로드할 수 있습니다.' })
  } catch (error) {
    console.error(error)
    onPhase({
      id: 'error',
      detail:
        error instanceof Error
          ? error.message
          : '모델을 불러오지 못했습니다.',
    })
    throw error
  }
}