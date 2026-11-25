import type { EditableBox } from '@/components/EditableBBoxLayer'
import { normalizeBoxTitles } from '@/lib/bbox/box-title'

import {
  deleteDetectionRowsExcept,
  idbGetDetection,
  idbPutDetection,
  idbRemoveDetection,
} from '@/lib/upload-idb'

export type StoredDetection = {
  fileId: string
  threshold: number
  selectedId: string | null
  boxes: EditableBox[]
  emptyHint: boolean
  updatedAt: number
}

const EMPTY_HINT_MSG =
  '표 영역을 찾지 못했습니다. 「영역 추가」로 직접 지정할 수 있습니다.'

export function detectionEmptyHintMessage(emptyHint: boolean): string | null {
  return emptyHint ? EMPTY_HINT_MSG : null
}

export async function loadDetectionResult(
  fileId: string,
): Promise<StoredDetection | null> {
  const saved = await idbGetDetection(fileId)
  if (!saved) return null
  return { ...saved, boxes: normalizeBoxTitles(saved.boxes) }
}

export async function persistDetectionResult(
  data: Omit<StoredDetection, 'updatedAt'>,
): Promise<void> {
  await idbPutDetection({
    ...data,
    updatedAt: Date.now(),
  })
}

export async function deleteDetectionResult(fileId: string): Promise<void> {
  await idbRemoveDetection(fileId)
}

export async function pruneDetectionResults(keepFileIds: string[]): Promise<void> {
  await deleteDetectionRowsExcept(new Set(keepFileIds))
}