export type Box = {
  id: string
  title: string
  label: string
  score: number
  box: { xmin: number; ymin: number; xmax: number; ymax: number }
}

export type TableJson = Box & {
  imageId: string
  position: number
  sheetId: string | null
  sheetManual: boolean
}

export type ImageJson = {
  id: string
  name: string
  mime: string
  size: number
  position: number
  detection: {
    threshold: number
    emptyHint: boolean
    selectedId: string | null
  } | null
}

export type SheetJson = {
  id: string
  name: string
  position: number
  tableIds: string[]
  rows: string[][] | null
  stale: boolean
}

export type ProjectSummary = {
  id: string
  name: string
  imageCount: number
  createdAt: number
  updatedAt: number
}

export type ProjectDetail = {
  project: ProjectSummary
  images: ImageJson[]
  tables: TableJson[]
  sheets: SheetJson[]
}

export type CropInput = {
  tableId: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  data: string
}

type ApiErrorBody = { error?: string }

export const AUTH_EXPIRED_EVENT = 'auth-expired'

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      credentials: 'include',
    })
  } catch {
    throw new Error('네트워크 오류로 서버에 연결할 수 없습니다.')
  }

  if (res.ok) {
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  if (res.status === 401) {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
    throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.')
  }

  const body = (await res.json().catch(() => ({}))) as ApiErrorBody
  throw new Error(
    body.error ?? `요청이 실패했습니다. (${res.status})`,
  )
}

export async function listProjects(signal?: AbortSignal): Promise<ProjectSummary[]> {
  const data = await apiFetch<{ projects: ProjectSummary[] }>(
    '/api/projects',
    { signal },
  )
  return data.projects
}

export async function createProject(
  name: string,
  signal?: AbortSignal,
): Promise<ProjectSummary> {
  const data = await apiFetch<{ project: ProjectSummary }>('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
    signal,
  })
  return data.project
}

export async function getProject(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(`/api/projects/${projectId}`, { signal })
}

export async function patchProject(
  projectId: string,
  name: string,
  signal?: AbortSignal,
): Promise<ProjectSummary> {
  const data = await apiFetch<{ project: ProjectSummary }>(
    `/api/projects/${projectId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
      signal,
    },
  )
  return data.project
}

export async function deleteProject(
  projectId: string,
  signal?: AbortSignal,
): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/projects/${projectId}`, {
    method: 'DELETE',
    signal,
  })
}

export async function uploadImage(
  projectId: string,
  file: Blob,
  fileName: string,
  contentType: string,
  signal?: AbortSignal,
): Promise<ImageJson> {
  const data = await apiFetch<{ image: ImageJson }>(
    `/api/projects/${projectId}/images`,
    {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'X-File-Name': encodeURIComponent(fileName),
      },
      body: file,
      signal,
    },
  )
  return data.image
}

export function imageFileUrl(projectId: string, imageId: string): string {
  return `/api/projects/${projectId}/images/${imageId}/file`
}

export async function deleteImage(
  projectId: string,
  imageId: string,
  signal?: AbortSignal,
): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(
    `/api/projects/${projectId}/images/${imageId}`,
    { method: 'DELETE', signal },
  )
}

export type DetectionPayload = {
  threshold: number
  emptyHint: boolean
  selectedId: string | null
  boxes: Box[]
}

export async function putDetection(
  projectId: string,
  imageId: string,
  payload: DetectionPayload,
  signal?: AbortSignal,
): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(
    `/api/projects/${projectId}/images/${imageId}/detection`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    },
  )
}

export async function postGroup(
  projectId: string,
  crops: CropInput[],
  signal?: AbortSignal,
): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(`/api/projects/${projectId}/group`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ crops }),
    signal,
  })
}

export async function patchTableSheet(
  projectId: string,
  tableId: string,
  body: { sheetId: string } | { newSheetName: string },
  signal?: AbortSignal,
): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(
    `/api/projects/${projectId}/tables/${tableId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    },
  )
}

export async function patchSheet(
  projectId: string,
  sheetId: string,
  body: { name?: string; rows?: string[][] },
  signal?: AbortSignal,
): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(
    `/api/projects/${projectId}/sheets/${sheetId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    },
  )
}

export async function postSheetExtract(
  projectId: string,
  sheetId: string,
  crops: CropInput[],
  signal?: AbortSignal,
): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(
    `/api/projects/${projectId}/sheets/${sheetId}/extract`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crops }),
      signal,
    },
  )
}