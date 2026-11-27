import type { ImageJson } from '@/lib/project/types'

export type ImageDetection = NonNullable<ImageJson['detection']>

export type ProjectRecord = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export type ImageRecord = {
  id: string
  projectId: string
  name: string
  mime: string
  size: number
  position: number
  detection: ImageDetection | null
}

export type ImageFileRecord = {
  id: string
  projectId: string
  blob: Blob
}

export type SheetRecord = {
  id: string
  projectId: string
  name: string
  position: number
  rows: string[][] | null
  extractSignature: string | null
}

export type TableRecord = {
  id: string
  projectId: string
  imageId: string
  sheetId: string | null
  title: string
  label: string
  score: number
  box: { xmin: number; ymin: number; xmax: number; ymax: number }
  position: number
  sheetManual: boolean
}

export const STORE = {
  projects: 'projects',
  images: 'images',
  imageFiles: 'imageFiles',
  sheets: 'sheets',
  tables: 'tables',
} as const

export const ALL_STORES = [STORE.projects, STORE.images, STORE.imageFiles, STORE.sheets, STORE.tables]

export const INDEX = {
  byProject: 'byProject',
  byImage: 'byImage',
} as const

const DB_VERSION = 1

let activeUser: string | null = null
let dbPromise: Promise<IDBDatabase> | null = null

/** Binds local storage to a username. Each user gets an isolated IndexedDB database. */
export function setLocalUser(username: string | null): void {
  if (username === activeUser) return
  activeUser = username
  const previous = dbPromise
  dbPromise = null
  previous?.then((db) => db.close(), () => undefined)
}

function createStores(db: IDBDatabase): void {
  db.createObjectStore(STORE.projects, { keyPath: 'id' })

  const images = db.createObjectStore(STORE.images, { keyPath: 'id' })
  images.createIndex(INDEX.byProject, 'projectId')

  const imageFiles = db.createObjectStore(STORE.imageFiles, { keyPath: 'id' })
  imageFiles.createIndex(INDEX.byProject, 'projectId')

  const sheets = db.createObjectStore(STORE.sheets, { keyPath: 'id' })
  sheets.createIndex(INDEX.byProject, 'projectId')

  const tables = db.createObjectStore(STORE.tables, { keyPath: 'id' })
  tables.createIndex(INDEX.byProject, 'projectId')
  tables.createIndex(INDEX.byImage, 'imageId')
}

async function requestPersistence(): Promise<void> {
  try {
    await navigator.storage?.persist?.()
  } catch (err) {
    console.warn('storage.persist() failed', err)
  }
}

function openDb(): Promise<IDBDatabase> {
  if (!activeUser) return Promise.reject(new Error('로그인이 필요합니다.'))
  if (dbPromise) return dbPromise

  const name = `image-to-excel:${activeUser}`
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION)
    req.onupgradeneeded = () => createStores(req.result)
    req.onsuccess = () => {
      const db = req.result
      db.onversionchange = () => {
        db.close()
        if (dbPromise === opening) dbPromise = null
      }
      resolve(db)
    }
    req.onerror = () => reject(req.error ?? new Error('로컬 저장소를 열지 못했습니다.'))
  })

  dbPromise = opening
  opening.catch(() => {
    if (dbPromise === opening) dbPromise = null
  })
  void requestPersistence()
  return opening
}

export function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('로컬 저장소 요청이 실패했습니다.'))
  })
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('로컬 저장소 트랜잭션이 실패했습니다.'))
    tx.onabort = () => reject(tx.error ?? new Error('로컬 저장소 트랜잭션이 중단되었습니다.'))
  })
}

/**
 * Runs `fn` inside one IndexedDB transaction. Do not await network calls inside `fn`;
 * the transaction commits as soon as no requests are pending.
 */
export async function runTx<T>(
  mode: IDBTransactionMode,
  stores: readonly string[],
  fn: (tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await openDb()
  const tx = db.transaction(stores as string[], mode)
  const done = transactionDone(tx)
  try {
    const result = await fn(tx)
    await done
    return result
  } catch (err) {
    try {
      tx.abort()
    } catch {
      // Transaction already finished; nothing to abort.
    }
    await done.catch(() => undefined)
    throw err
  }
}
