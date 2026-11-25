import type { ExportSheet } from '@/lib/excel/build-xlsx'
import type { WorkshopStepId } from '@/lib/workflow/workshop-steps'

import {
  deleteWorkshopRowsExcept,
  idbClearWorkshop,
  idbGetWorkshop,
  idbPutWorkshop,
  idbRemoveWorkshop,
} from '@/lib/upload-idb'

export type StoredWorkshopSession = {
  fileId: string
  workshopStep: WorkshopStepId
  exportSheets: ExportSheet[] | null
  downloadFileName: string
  exportSignature: string | null
  reviewCommitted: boolean
  updatedAt: number
}

export async function loadWorkshopSession(
  fileId: string,
): Promise<StoredWorkshopSession | null> {
  return idbGetWorkshop(fileId)
}

export async function persistWorkshopSession(
  data: Omit<StoredWorkshopSession, 'updatedAt'>,
): Promise<void> {
  await idbPutWorkshop({
    ...data,
    updatedAt: Date.now(),
  })
}

export async function deleteWorkshopSession(fileId: string): Promise<void> {
  await idbRemoveWorkshop(fileId)
}

export async function pruneWorkshopSessions(keepFileIds: string[]): Promise<void> {
  await deleteWorkshopRowsExcept(new Set(keepFileIds))
}

export async function clearWorkshopSessions(): Promise<void> {
  await idbClearWorkshop()
}

export function resolveWorkshopStepAfterRestore(
  requested: WorkshopStepId,
  hasValidExport: boolean,
): WorkshopStepId {
  if (requested === 'review' && !hasValidExport) return 'convert'
  return requested
}