import { apiFetch } from '@/lib/api/http'
import { ALLOWED_UPLOAD_MIME, hasImageSignature } from '@/lib/project/image'
import {
  MAX_BOXES_PER_IMAGE,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_PROJECT_IMAGES,
} from '@/lib/project/constants'
import { planRegroup, resolveGroupRefs } from '@/lib/project/regroup'
import {
  computeSheetExtractSignature,
  orderTablesForSignature,
  sheetIsStale,
  type SignatureTable,
} from '@/lib/project/signature'
import type {
  Box,
  CropInput,
  GroupGeminiResponse,
  ImageJson,
  ProjectDetail,
  ProjectSummary,
  SheetJson,
  TableJson,
} from '@/lib/project/types'

import {
  ALL_STORES,
  INDEX,
  STORE,
  requestToPromise,
  runTx,
  type ImageFileRecord,
  type ImageRecord,
  type ProjectRecord,
  type SheetRecord,
  type TableRecord,
} from './db'

export type DetectionPayload = {
  threshold: number
  emptyHint: boolean
  selectedId: string | null
  boxes: Box[]
}

type Snapshot = {
  images: ImageRecord[]
  tables: TableRecord[]
  sheets: SheetRecord[]
}

type CropPayload = Pick<CropInput, 'mimeType' | 'data'>

const NOT_FOUND_PROJECT = '프로젝트를 찾을 수 없습니다.'
const CLIENT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const RW = 'readwrite'
const RO = 'readonly'

function isClientId(id: string): boolean {
  return CLIENT_ID_RE.test(id)
}

function parseProjectName(raw: string): string {
  const name = raw.trim()
  if (!name || name.length > 200) throw new Error('프로젝트 이름을 입력해 주세요.')
  return name
}

function nextPosition(positions: number[]): number {
  return positions.reduce((max, p) => Math.max(max, p), -1) + 1
}

function getRecord<T>(tx: IDBTransaction, store: string, key: string): Promise<T | undefined> {
  return requestToPromise<T | undefined>(tx.objectStore(store).get(key))
}

function getAllByIndex<T>(
  tx: IDBTransaction,
  store: string,
  index: string,
  key: IDBValidKey,
): Promise<T[]> {
  return requestToPromise<T[]>(tx.objectStore(store).index(index).getAll(key))
}

function countImages(tx: IDBTransaction, projectId: string): Promise<number> {
  return requestToPromise<number>(
    tx.objectStore(STORE.images).index(INDEX.byProject).count(projectId),
  )
}

async function getProjectOrThrow(tx: IDBTransaction, projectId: string): Promise<ProjectRecord> {
  const project = await getRecord<ProjectRecord>(tx, STORE.projects, projectId)
  if (!project) throw new Error(NOT_FOUND_PROJECT)
  return project
}

async function touchProject(tx: IDBTransaction, projectId: string): Promise<void> {
  const project = await getProjectOrThrow(tx, projectId)
  tx.objectStore(STORE.projects).put({ ...project, updatedAt: Date.now() })
}

async function readSnapshot(tx: IDBTransaction, projectId: string): Promise<Snapshot> {
  const [images, tables, sheets] = await Promise.all([
    getAllByIndex<ImageRecord>(tx, STORE.images, INDEX.byProject, projectId),
    getAllByIndex<TableRecord>(tx, STORE.tables, INDEX.byProject, projectId),
    getAllByIndex<SheetRecord>(tx, STORE.sheets, INDEX.byProject, projectId),
  ])
  return { images, tables, sheets }
}

async function deleteEmptySheets(tx: IDBTransaction, projectId: string): Promise<void> {
  const sheets = await getAllByIndex<SheetRecord>(tx, STORE.sheets, INDEX.byProject, projectId)
  const tables = await getAllByIndex<TableRecord>(tx, STORE.tables, INDEX.byProject, projectId)
  const usedSheetIds = new Set<string>()
  for (const t of tables) {
    if (t.sheetId) usedSheetIds.add(t.sheetId)
  }
  for (const s of sheets) {
    if (!usedSheetIds.has(s.id)) tx.objectStore(STORE.sheets).delete(s.id)
  }
}

async function deleteByProject(tx: IDBTransaction, projectId: string): Promise<void> {
  for (const store of [STORE.images, STORE.imageFiles, STORE.sheets, STORE.tables]) {
    const keys = await requestToPromise<IDBValidKey[]>(
      tx.objectStore(store).index(INDEX.byProject).getAllKeys(projectId),
    )
    for (const key of keys) tx.objectStore(store).delete(key)
  }
}

function toSummary(project: ProjectRecord, imageCount: number): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    imageCount,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}

function toImageJson(image: ImageRecord): ImageJson {
  return {
    id: image.id,
    name: image.name,
    mime: image.mime,
    size: image.size,
    position: image.position,
    detection: image.detection,
  }
}

function toTableJson(table: TableRecord): TableJson {
  return {
    id: table.id,
    title: table.title,
    label: table.label,
    score: table.score,
    box: table.box,
    imageId: table.imageId,
    position: table.position,
    sheetId: table.sheetId,
    sheetManual: table.sheetManual,
  }
}

function toSignatureTable(table: TableRecord, imagePosition: Map<string, number>): SignatureTable {
  return {
    id: table.id,
    xmin: table.box.xmin,
    ymin: table.box.ymin,
    xmax: table.box.xmax,
    ymax: table.box.ymax,
    imagePosition: imagePosition.get(table.imageId) ?? 0,
    position: table.position,
  }
}

function orderedTables(tables: TableRecord[], images: ImageRecord[]): TableRecord[] {
  const imagePosition = new Map(images.map((i) => [i.id, i.position]))
  return [...tables].sort(
    (a, b) =>
      (imagePosition.get(a.imageId) ?? 0) - (imagePosition.get(b.imageId) ?? 0) ||
      a.position - b.position ||
      a.id.localeCompare(b.id),
  )
}

function buildDetail(project: ProjectRecord, snap: Snapshot): ProjectDetail {
  const imagePosition = new Map(snap.images.map((i) => [i.id, i.position]))

  const tablesBySheet = new Map<string, TableRecord[]>()
  for (const t of snap.tables) {
    if (!t.sheetId) continue
    const list = tablesBySheet.get(t.sheetId) ?? []
    list.push(t)
    tablesBySheet.set(t.sheetId, list)
  }

  const sheets: SheetJson[] = [...snap.sheets]
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map((s) => {
      const sigTables = (tablesBySheet.get(s.id) ?? []).map((t) =>
        toSignatureTable(t, imagePosition),
      )
      const ordered = orderTablesForSignature(sigTables)
      const currentSignature = computeSheetExtractSignature(sigTables)
      return {
        id: s.id,
        name: s.name,
        position: s.position,
        tableIds: ordered.map((t) => t.id),
        rows: s.rows,
        stale: sheetIsStale(s.rows != null, s.extractSignature, currentSignature),
      }
    })

  const images = [...snap.images]
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map(toImageJson)

  const tables = [...snap.tables]
    .sort((a, b) => {
      const imgA = imagePosition.get(a.imageId) ?? 0
      const imgB = imagePosition.get(b.imageId) ?? 0
      return imgA - imgB || a.position - b.position || a.id.localeCompare(b.id)
    })
    .map(toTableJson)

  return {
    project: toSummary(project, snap.images.length),
    images,
    tables,
    sheets,
  }
}

async function readDetailOrThrow(tx: IDBTransaction, projectId: string): Promise<ProjectDetail> {
  const project = await getProjectOrThrow(tx, projectId)
  return buildDetail(project, await readSnapshot(tx, projectId))
}

function loadSnapshot(projectId: string): Promise<Snapshot> {
  return runTx(RO, ALL_STORES, async (tx) => {
    await getProjectOrThrow(tx, projectId)
    return readSnapshot(tx, projectId)
  })
}

function assertCropsCover(crops: CropInput[], expectedIds: string[], message: string): void {
  const expected = new Set(expectedIds)
  const got = new Set(crops.map((c) => c.tableId))
  const covered = expectedIds.every((id) => got.has(id))
  if (crops.length !== expectedIds.length || got.size !== expected.size || !covered) {
    throw new Error(message)
  }
}

function cropPayloadFor(crops: Map<string, CropInput>, tableId: string): CropPayload {
  const crop = crops.get(tableId)
  if (!crop) throw new Error('크롭 정보가 누락되었습니다.')
  return { mimeType: crop.mimeType, data: crop.data }
}

function normalizeRows(rows: unknown): string[][] {
  if (!Array.isArray(rows)) throw new Error('행 데이터(rows) 형식이 올바르지 않습니다.')
  return rows.map((row) => {
    if (!Array.isArray(row)) throw new Error('행 데이터(rows) 형식이 올바르지 않습니다.')
    return row.map((c) => (typeof c === 'string' ? c : String(c ?? '')))
  })
}

function isValidBox(b: Box): boolean {
  const box = b?.box
  if (!box) return false
  return (
    Number.isFinite(box.xmin) &&
    Number.isFinite(box.ymin) &&
    Number.isFinite(box.xmax) &&
    Number.isFinite(box.ymax) &&
    box.xmax > box.xmin &&
    box.ymax > box.ymin
  )
}

function validateDetection(payload: DetectionPayload): void {
  if (!Number.isFinite(payload.threshold)) {
    throw new Error('검출 설정(threshold)이 올바르지 않습니다.')
  }
  if (typeof payload.emptyHint !== 'boolean') {
    throw new Error('검출 설정(emptyHint)이 올바르지 않습니다.')
  }
  if (!Array.isArray(payload.boxes)) {
    throw new Error('표 목록(boxes)이 올바르지 않습니다.')
  }
  if (payload.boxes.length > MAX_BOXES_PER_IMAGE) {
    throw new Error(`이미지당 표는 최대 ${MAX_BOXES_PER_IMAGE}개까지 저장할 수 있습니다.`)
  }
  const ids = new Set<string>()
  for (const b of payload.boxes) {
    if (!b || typeof b.id !== 'string' || !isClientId(b.id) || !isValidBox(b)) {
      throw new Error('표 좌표 형식이 올바르지 않습니다.')
    }
    if (ids.has(b.id)) throw new Error('표 id가 중복되었습니다.')
    ids.add(b.id)
  }
  if (payload.selectedId != null) {
    if (typeof payload.selectedId !== 'string' || !isClientId(payload.selectedId)) {
      throw new Error('선택된 표 id가 올바르지 않습니다.')
    }
    if (!ids.has(payload.selectedId)) throw new Error('선택된 표 id가 목록에 없습니다.')
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}

async function postGemini<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
}

export async function listProjects(): Promise<ProjectSummary[]> {
  return runTx(RO, ALL_STORES, async (tx) => {
    const [projects, images] = await Promise.all([
      requestToPromise<ProjectRecord[]>(tx.objectStore(STORE.projects).getAll()),
      requestToPromise<ImageRecord[]>(tx.objectStore(STORE.images).getAll()),
    ])
    const counts = new Map<string, number>()
    for (const img of images) {
      counts.set(img.projectId, (counts.get(img.projectId) ?? 0) + 1)
    }
    return projects
      .map((p) => toSummary(p, counts.get(p.id) ?? 0))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  })
}

export async function createProject(rawName: string): Promise<ProjectSummary> {
  const name = parseProjectName(rawName)
  return runTx(RW, ALL_STORES, async (tx) => {
    const now = Date.now()
    const record: ProjectRecord = {
      id: crypto.randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
    }
    tx.objectStore(STORE.projects).put(record)
    return toSummary(record, 0)
  })
}

export async function getProject(projectId: string): Promise<ProjectDetail> {
  return runTx(RO, ALL_STORES, (tx) => readDetailOrThrow(tx, projectId))
}

export async function patchProject(projectId: string, rawName: string): Promise<ProjectSummary> {
  const name = parseProjectName(rawName)
  return runTx(RW, ALL_STORES, async (tx) => {
    const project = await getProjectOrThrow(tx, projectId)
    const updated: ProjectRecord = { ...project, name, updatedAt: Date.now() }
    tx.objectStore(STORE.projects).put(updated)
    return toSummary(updated, await countImages(tx, projectId))
  })
}

export async function deleteProject(projectId: string): Promise<void> {
  await runTx(RW, ALL_STORES, async (tx) => {
    await getProjectOrThrow(tx, projectId)
    await deleteByProject(tx, projectId)
    tx.objectStore(STORE.projects).delete(projectId)
  })
}

export async function uploadImage(
  projectId: string,
  file: Blob,
  fileName: string,
  contentType: string,
): Promise<ImageJson> {
  if (!ALLOWED_UPLOAD_MIME.has(contentType)) {
    throw new Error('지원하지 않는 이미지 형식입니다. (PNG, JPEG, WebP)')
  }
  if (file.size === 0) throw new Error('빈 파일은 업로드할 수 없습니다.')
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error(`이미지는 ${MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024)}MB 이하만 업로드할 수 있습니다.`)
  }
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (!hasImageSignature(head, contentType)) {
    throw new Error('이미지 파일 내용이 선언된 형식과 맞지 않습니다.')
  }

  const name = fileName.trim().slice(0, 255) || 'image'
  const imageId = crypto.randomUUID()

  return runTx(RW, ALL_STORES, async (tx) => {
    const project = await getProjectOrThrow(tx, projectId)
    const existing = await getAllByIndex<ImageRecord>(tx, STORE.images, INDEX.byProject, projectId)
    if (existing.length >= MAX_PROJECT_IMAGES) {
      throw new Error(`프로젝트당 이미지는 최대 ${MAX_PROJECT_IMAGES}장까지 업로드할 수 있습니다.`)
    }
    const record: ImageRecord = {
      id: imageId,
      projectId,
      name,
      mime: contentType,
      size: file.size,
      position: nextPosition(existing.map((i) => i.position)),
      detection: null,
    }
    const fileRecord: ImageFileRecord = { id: imageId, projectId, blob: file }
    tx.objectStore(STORE.images).put(record)
    tx.objectStore(STORE.imageFiles).put(fileRecord)
    tx.objectStore(STORE.projects).put({ ...project, updatedAt: Date.now() })
    return toImageJson(record)
  })
}

export async function getImageBlob(projectId: string, imageId: string): Promise<Blob> {
  const record = await runTx(RO, ALL_STORES, (tx) =>
    getRecord<ImageFileRecord>(tx, STORE.imageFiles, imageId),
  )
  if (!record || record.projectId !== projectId) {
    throw new Error('이미지 파일을 찾을 수 없습니다.')
  }
  return record.blob
}

export async function deleteImage(projectId: string, imageId: string): Promise<ProjectDetail> {
  return runTx(RW, ALL_STORES, async (tx) => {
    const image = await getRecord<ImageRecord>(tx, STORE.images, imageId)
    if (!image || image.projectId !== projectId) throw new Error(NOT_FOUND_PROJECT)

    tx.objectStore(STORE.images).delete(imageId)
    tx.objectStore(STORE.imageFiles).delete(imageId)
    const tables = await getAllByIndex<TableRecord>(tx, STORE.tables, INDEX.byImage, imageId)
    for (const t of tables) tx.objectStore(STORE.tables).delete(t.id)

    await deleteEmptySheets(tx, projectId)
    await touchProject(tx, projectId)
    return readDetailOrThrow(tx, projectId)
  })
}

export async function putDetection(
  projectId: string,
  imageId: string,
  payload: DetectionPayload,
  signal?: AbortSignal,
): Promise<ProjectDetail> {
  throwIfAborted(signal)
  validateDetection(payload)

  return runTx(RW, ALL_STORES, async (tx) => {
    const image = await getRecord<ImageRecord>(tx, STORE.images, imageId)
    if (!image || image.projectId !== projectId) throw new Error(NOT_FOUND_PROJECT)

    for (const b of payload.boxes) {
      const other = await getRecord<TableRecord>(tx, STORE.tables, b.id)
      if (other && other.imageId !== imageId) {
        throw new Error(
          other.projectId !== projectId
            ? '표 id가 다른 프로젝트와 중복되었습니다. 다시 검출해 주세요.'
            : '표 id가 중복되었습니다. 다시 검출해 주세요.',
        )
      }
    }

    const existing = await getAllByIndex<TableRecord>(tx, STORE.tables, INDEX.byImage, imageId)
    const prevById = new Map(existing.map((t) => [t.id, t]))
    const keep = new Set(payload.boxes.map((b) => b.id))

    payload.boxes.forEach((b, index) => {
      const prev = prevById.get(b.id)
      const record: TableRecord = {
        id: b.id,
        projectId,
        imageId,
        sheetId: prev?.sheetId ?? null,
        sheetManual: prev?.sheetManual ?? false,
        title: (b.title ?? '').slice(0, 200),
        label: (b.label ?? '').slice(0, 200),
        score: Number.isFinite(b.score) ? b.score : 0,
        box: {
          xmin: b.box.xmin,
          ymin: b.box.ymin,
          xmax: b.box.xmax,
          ymax: b.box.ymax,
        },
        position: index,
      }
      tx.objectStore(STORE.tables).put(record)
    })

    for (const t of existing) {
      if (!keep.has(t.id)) tx.objectStore(STORE.tables).delete(t.id)
    }

    tx.objectStore(STORE.images).put({
      ...image,
      detection: {
        threshold: payload.threshold,
        emptyHint: payload.emptyHint,
        selectedId: payload.selectedId,
      },
    })

    await deleteEmptySheets(tx, projectId)
    await touchProject(tx, projectId)
    return readDetailOrThrow(tx, projectId)
  })
}

export async function patchTableSheet(
  projectId: string,
  tableId: string,
  body: { sheetId: string } | { newSheetName: string },
): Promise<ProjectDetail> {
  if (!isClientId(tableId)) throw new Error('표 id가 올바르지 않습니다.')
  const requestedSheetId = 'sheetId' in body ? body.sheetId : null
  const requestedName = 'newSheetName' in body ? body.newSheetName : null
  if ((requestedSheetId !== null) === (requestedName !== null)) {
    throw new Error('sheetId 또는 newSheetName 중 하나만 지정해 주세요.')
  }

  return runTx(RW, ALL_STORES, async (tx) => {
    const table = await getRecord<TableRecord>(tx, STORE.tables, tableId)
    if (!table || table.projectId !== projectId) throw new Error('표를 찾을 수 없습니다.')

    let targetSheetId: string
    if (requestedSheetId !== null) {
      if (!isClientId(requestedSheetId)) throw new Error('시트 id가 올바르지 않습니다.')
      const sheet = await getRecord<SheetRecord>(tx, STORE.sheets, requestedSheetId)
      if (!sheet || sheet.projectId !== projectId) throw new Error('시트를 찾을 수 없습니다.')
      targetSheetId = sheet.id
    } else {
      const name = (requestedName ?? '').trim().slice(0, 120)
      if (!name) throw new Error('시트 이름을 입력해 주세요.')
      const sheets = await getAllByIndex<SheetRecord>(tx, STORE.sheets, INDEX.byProject, projectId)
      targetSheetId = crypto.randomUUID()
      tx.objectStore(STORE.sheets).put({
        id: targetSheetId,
        projectId,
        name,
        position: nextPosition(sheets.map((s) => s.position)),
        rows: null,
        extractSignature: null,
      } satisfies SheetRecord)
    }

    const sourceSheetId = table.sheetId
    tx.objectStore(STORE.tables).put({ ...table, sheetId: targetSheetId, sheetManual: true })

    if (sourceSheetId && sourceSheetId !== targetSheetId) {
      const tables = await getAllByIndex<TableRecord>(tx, STORE.tables, INDEX.byProject, projectId)
      const remaining = tables.filter((t) => t.sheetId === sourceSheetId)
      if (remaining.length === 0) tx.objectStore(STORE.sheets).delete(sourceSheetId)
    }

    await touchProject(tx, projectId)
    return readDetailOrThrow(tx, projectId)
  })
}

export async function patchSheet(
  projectId: string,
  sheetId: string,
  body: { name?: string; rows?: string[][] },
  signal?: AbortSignal,
): Promise<ProjectDetail> {
  throwIfAborted(signal)
  if (body.name === undefined && body.rows === undefined) {
    throw new Error('변경할 항목(name 또는 rows)이 없습니다.')
  }
  if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
    throw new Error('시트 이름이 올바르지 않습니다.')
  }
  const rows = body.rows === undefined ? undefined : normalizeRows(body.rows)
  const nextName = body.name === undefined ? undefined : body.name.trim().slice(0, 120)

  return runTx(RW, ALL_STORES, async (tx) => {
    const sheet = await getRecord<SheetRecord>(tx, STORE.sheets, sheetId)
    if (!sheet || sheet.projectId !== projectId) throw new Error('시트를 찾을 수 없습니다.')
    tx.objectStore(STORE.sheets).put({
      ...sheet,
      name: nextName ?? sheet.name,
      rows: rows ?? sheet.rows,
    })
    await touchProject(tx, projectId)
    return readDetailOrThrow(tx, projectId)
  })
}

export async function postGroup(
  projectId: string,
  crops: CropInput[],
  signal?: AbortSignal,
): Promise<ProjectDetail> {
  const snap = await loadSnapshot(projectId)
  if (snap.tables.length === 0) {
    throw new Error('그룹핑할 표가 없습니다. 먼저 표를 검출해 주세요.')
  }

  const ordered = orderedTables(snap.tables, snap.images)
  const allIds = ordered.map((t) => t.id)
  assertCropsCover(crops, allIds, '프로젝트의 모든 표에 대한 크롭이 필요합니다.')

  const cropById = new Map(crops.map((c) => [c.tableId, c]))
  const imageNameById = new Map(snap.images.map((i) => [i.id, i.name]))
  const tableIdByRef = new Map<string, string>()
  const items = ordered.map((table, idx) => {
    const ref = `T${idx + 1}`
    tableIdByRef.set(ref, table.id)
    return {
      ref,
      imageName: imageNameById.get(table.imageId) ?? 'image',
      ...cropPayloadFor(cropById, table.id),
    }
  })

  const { groups } = await postGemini<GroupGeminiResponse>('/api/gemini/group', { items }, signal)
  const resolved = resolveGroupRefs(groups, tableIdByRef, allIds)
  throwIfAborted(signal)

  return runTx(RW, ALL_STORES, async (tx) => {
    await getProjectOrThrow(tx, projectId)
    const tables = await getAllByIndex<TableRecord>(tx, STORE.tables, INDEX.byProject, projectId)
    const sheets = await getAllByIndex<SheetRecord>(tx, STORE.sheets, INDEX.byProject, projectId)

    const manualSheetIds = new Set<string>()
    for (const t of tables) {
      if (t.sheetManual && t.sheetId) manualSheetIds.add(t.sheetId)
    }

    const plan = planRegroup(
      sheets.map((s) => ({
        id: s.id,
        name: s.name,
        position: s.position,
        hasManualTables: manualSheetIds.has(s.id),
      })),
      tables.map((t) => ({ id: t.id, sheetManual: t.sheetManual })),
      resolved,
    )

    const tableById = new Map(tables.map((t) => [t.id, t]))
    for (const sheetId of plan.deleteSheetIds) tx.objectStore(STORE.sheets).delete(sheetId)
    for (const sheet of plan.newSheets) {
      tx.objectStore(STORE.sheets).put({
        id: sheet.id,
        projectId,
        name: sheet.name,
        position: sheet.position,
        rows: null,
        extractSignature: null,
      } satisfies SheetRecord)
    }
    for (const [tableId, sheetId] of plan.assignTableIds) {
      const table = tableById.get(tableId)
      if (table && !table.sheetManual) {
        tx.objectStore(STORE.tables).put({ ...table, sheetId })
      }
    }

    await deleteEmptySheets(tx, projectId)
    await touchProject(tx, projectId)
    return readDetailOrThrow(tx, projectId)
  })
}

export async function postSheetExtract(
  projectId: string,
  sheetId: string,
  crops: CropInput[],
  signal?: AbortSignal,
): Promise<ProjectDetail> {
  const snap = await loadSnapshot(projectId)
  const sheet = snap.sheets.find((s) => s.id === sheetId)
  if (!sheet) throw new Error('시트를 찾을 수 없습니다.')

  const members = snap.tables.filter((t) => t.sheetId === sheetId)
  const ordered = orderedTables(members, snap.images)
  if (ordered.length === 0) throw new Error('이 시트에 추출할 표가 없습니다.')
  assertCropsCover(crops, ordered.map((t) => t.id), '이 시트의 모든 표에 대한 크롭이 필요합니다.')

  const cropById = new Map(crops.map((c) => [c.tableId, c]))
  const imageNameById = new Map(snap.images.map((i) => [i.id, i.name]))
  const items = ordered.map((table) => ({
    tableTitle: table.title || table.id,
    imageName: imageNameById.get(table.imageId) ?? 'image',
    ...cropPayloadFor(cropById, table.id),
  }))

  const { rows } = await postGemini<{ rows: string[][] }>('/api/gemini/extract-sheet', {
    sheetName: sheet.name,
    items,
  }, signal)

  // Signature reflects the tables whose crops were sent, not the state at write time.
  const imagePosition = new Map(snap.images.map((i) => [i.id, i.position]))
  const signature = computeSheetExtractSignature(
    ordered.map((t) => toSignatureTable(t, imagePosition)),
  )
  throwIfAborted(signal)

  return runTx(RW, ALL_STORES, async (tx) => {
    const current = await getRecord<SheetRecord>(tx, STORE.sheets, sheetId)
    if (!current || current.projectId !== projectId) throw new Error('시트를 찾을 수 없습니다.')
    tx.objectStore(STORE.sheets).put({ ...current, rows, extractSignature: signature })
    await touchProject(tx, projectId)
    return readDetailOrThrow(tx, projectId)
  })
}
