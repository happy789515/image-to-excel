import {
  META_ID,
  STORE_FILES,
  STORE_META,
  idbClearDetection,
  promisifyRequest,
  withDb,
} from '@/lib/upload-idb'

import { pruneDetectionResults } from '@/lib/detection-persist'

type FileRow = {
  id: string
  name: string
  type: string
  lastModified: number
  blob: Blob
}

type MetaRow = {
  id: typeof META_ID
  activeId: string | null
  order: string[]
}

export type PersistedUploadItem = {
  id: string
  file: File
}

export async function loadPersistedUploads(): Promise<{
  activeId: string | null
  items: PersistedUploadItem[]
}> {
  return withDb([STORE_FILES, STORE_META], 'readonly', async (tx) => {
    const meta = (await promisifyRequest(
      tx.objectStore(STORE_META).get(META_ID),
    )) as MetaRow | undefined
    const order = meta?.order ?? []
    const fileStore = tx.objectStore(STORE_FILES)

    const items: PersistedUploadItem[] = []
    for (const id of order) {
      const row = (await promisifyRequest(fileStore.get(id))) as
        | FileRow
        | undefined
      if (!row?.blob) continue
      const file = new File([row.blob], row.name, {
        type: row.type,
        lastModified: row.lastModified,
      })
      items.push({ id, file })
    }

    const activeId =
      meta?.activeId && items.some((item) => item.id === meta.activeId)
        ? meta.activeId
        : (items[0]?.id ?? null)

    return { activeId, items }
  })
}

export async function persistUploadQueue(
  items: { id: string; file: File }[],
  activeId: string | null,
): Promise<void> {
  await withDb([STORE_FILES, STORE_META], 'readwrite', async (tx) => {
    const fileStore = tx.objectStore(STORE_FILES)
    const metaStore = tx.objectStore(STORE_META)

    await promisifyRequest(fileStore.clear())

    const order: string[] = []
    for (const item of items) {
      const row: FileRow = {
        id: item.id,
        name: item.file.name,
        type: item.file.type,
        lastModified: item.file.lastModified,
        blob: item.file,
      }
      await promisifyRequest(fileStore.put(row))
      order.push(item.id)
    }

    const resolvedActive =
      activeId && order.includes(activeId) ? activeId : (order[0] ?? null)

    await promisifyRequest(
      metaStore.put({
        id: META_ID,
        activeId: resolvedActive,
        order,
      } satisfies MetaRow),
    )
  })

  await pruneDetectionResults(items.map((item) => item.id))
}

export async function clearPersistedUploads(): Promise<void> {
  await withDb([STORE_FILES, STORE_META], 'readwrite', async (tx) => {
    await promisifyRequest(tx.objectStore(STORE_FILES).clear())
    await promisifyRequest(tx.objectStore(STORE_META).clear())
  })
  await idbClearDetection()
}

export function persistErrorMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === 'QuotaExceededError') {
    return '브라우저 저장 공간이 부족합니다. 일부 파일을 삭제한 뒤 다시 시도하세요.'
  }
  return '파일을 기기에 저장하지 못했습니다. 새로고침 시 목록이 사라질 수 있습니다.'
}