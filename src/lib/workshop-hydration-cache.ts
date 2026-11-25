import type { StoredDetection } from '@/lib/detection-persist'
import type { StoredWorkshopSession } from '@/lib/workshop-persist'

export type WorkshopHydrationBundle = {
  detection: StoredDetection | null
  session: StoredWorkshopSession | null
}

const hydrationByFileId = new Map<string, WorkshopHydrationBundle>()

export function getWorkshopHydration(
  fileId: string,
): WorkshopHydrationBundle | undefined {
  return hydrationByFileId.get(fileId)
}

export function setWorkshopHydration(
  fileId: string,
  bundle: WorkshopHydrationBundle,
): void {
  hydrationByFileId.set(fileId, bundle)
}

export function clearWorkshopHydration(fileId: string): void {
  hydrationByFileId.delete(fileId)
}