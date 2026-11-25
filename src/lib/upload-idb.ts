import type { EditableBox } from '@/components/EditableBBoxLayer'
import type { ExportSheet } from '@/lib/excel/build-xlsx'

const DB_NAME = 'image-to-excel-local'
const DB_VERSION = 3

export const STORE_FILES = 'files'
export const STORE_META = 'meta'
export const STORE_DETECTION = 'detection'
export const STORE_WORKSHOP = 'workshop'
export const META_ID = 'queue'

export type WorkshopSessionRow = {
  fileId: string
  workshopStep: 'detect' | 'convert' | 'review'
  exportSheets: ExportSheet[] | null
  downloadFileName: string
  exportSignature: string | null
  reviewCommitted: boolean
  updatedAt: number
}

export type DetectionRow = {
  fileId: string
  threshold: number
  selectedId: string | null
  boxes: EditableBox[]
  emptyHint: boolean
  updatedAt: number
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB-unavailable'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('idb-open'))
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_DETECTION)) {
        db.createObjectStore(STORE_DETECTION, { keyPath: 'fileId' })
      }
      if (!db.objectStoreNames.contains(STORE_WORKSHOP)) {
        db.createObjectStore(STORE_WORKSHOP, { keyPath: 'fileId' })
      }
    }
  })
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('idb-request'))
  })
}

function waitTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('idb-tx'))
    tx.onabort = () => reject(tx.error ?? new Error('idb-abort'))
  })
}

export async function idbGetDetection(
  fileId: string,
): Promise<DetectionRow | null> {
  const db = await openDatabase()
  try {
    const tx = db.transaction(STORE_DETECTION, 'readonly')
    const row = (await promisifyRequest(
      tx.objectStore(STORE_DETECTION).get(fileId),
    )) as DetectionRow | undefined
    await waitTransaction(tx)
    return row ?? null
  } finally {
    db.close()
  }
}

export async function idbPutDetection(row: DetectionRow): Promise<void> {
  const db = await openDatabase()
  try {
    const tx = db.transaction(STORE_DETECTION, 'readwrite')
    await promisifyRequest(tx.objectStore(STORE_DETECTION).put(row))
    await waitTransaction(tx)
  } finally {
    db.close()
  }
}

export async function idbRemoveDetection(fileId: string): Promise<void> {
  const db = await openDatabase()
  try {
    const tx = db.transaction(STORE_DETECTION, 'readwrite')
    await promisifyRequest(tx.objectStore(STORE_DETECTION).delete(fileId))
    await waitTransaction(tx)
  } finally {
    db.close()
  }
}

export async function idbClearDetection(): Promise<void> {
  const db = await openDatabase()
  try {
    const tx = db.transaction(STORE_DETECTION, 'readwrite')
    await promisifyRequest(tx.objectStore(STORE_DETECTION).clear())
    await waitTransaction(tx)
  } finally {
    db.close()
  }
}

export async function idbGetWorkshop(
  fileId: string,
): Promise<WorkshopSessionRow | null> {
  const db = await openDatabase()
  try {
    const tx = db.transaction(STORE_WORKSHOP, 'readonly')
    const row = (await promisifyRequest(
      tx.objectStore(STORE_WORKSHOP).get(fileId),
    )) as WorkshopSessionRow | undefined
    await waitTransaction(tx)
    return row ?? null
  } finally {
    db.close()
  }
}

export async function idbPutWorkshop(row: WorkshopSessionRow): Promise<void> {
  const db = await openDatabase()
  try {
    const tx = db.transaction(STORE_WORKSHOP, 'readwrite')
    await promisifyRequest(tx.objectStore(STORE_WORKSHOP).put(row))
    await waitTransaction(tx)
  } finally {
    db.close()
  }
}

export async function idbRemoveWorkshop(fileId: string): Promise<void> {
  const db = await openDatabase()
  try {
    const tx = db.transaction(STORE_WORKSHOP, 'readwrite')
    await promisifyRequest(tx.objectStore(STORE_WORKSHOP).delete(fileId))
    await waitTransaction(tx)
  } finally {
    db.close()
  }
}

export async function idbClearWorkshop(): Promise<void> {
  const db = await openDatabase()
  try {
    const tx = db.transaction(STORE_WORKSHOP, 'readwrite')
    await promisifyRequest(tx.objectStore(STORE_WORKSHOP).clear())
    await waitTransaction(tx)
  } finally {
    db.close()
  }
}

export async function deleteWorkshopRowsExcept(keep: Set<string>): Promise<void> {
  const db = await openDatabase()
  try {
    const tx = db.transaction(STORE_WORKSHOP, 'readwrite')
    const store = tx.objectStore(STORE_WORKSHOP)
    const all = (await promisifyRequest(store.getAllKeys())) as string[]
    for (const key of all) {
      if (!keep.has(key)) {
        await promisifyRequest(store.delete(key))
      }
    }
    await waitTransaction(tx)
  } finally {
    db.close()
  }
}

export async function deleteDetectionRowsExcept(keep: Set<string>): Promise<void> {
  const db = await openDatabase()
  try {
    const tx = db.transaction(STORE_DETECTION, 'readwrite')
    const store = tx.objectStore(STORE_DETECTION)
    const all = (await promisifyRequest(store.getAllKeys())) as string[]
    for (const key of all) {
      if (!keep.has(key)) {
        await promisifyRequest(store.delete(key))
      }
    }
    await waitTransaction(tx)
  } finally {
    db.close()
  }
}

export async function withDb<T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  run: (tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await openDatabase()
  try {
    const tx = db.transaction(storeNames, mode)
    const result = await run(tx)
    await waitTransaction(tx)
    return result
  } finally {
    db.close()
  }
}

export { promisifyRequest, waitTransaction, openDatabase }