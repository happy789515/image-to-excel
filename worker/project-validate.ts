const CLIENT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/

export function isClientId(id: string): boolean {
  return CLIENT_ID_RE.test(id)
}

export function parseProjectName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.trim()
  if (!name || name.length > 200) return null
  return name
}

const ALLOWED_CROP_MIME = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
])

export function parseCropInput(raw: unknown): import('./project-types').CropInput | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const tableId = typeof o.tableId === 'string' ? o.tableId : ''
  if (!isClientId(tableId)) return null
  const mimeType = o.mimeType
  if (typeof mimeType !== 'string' || !ALLOWED_CROP_MIME.has(mimeType)) {
    return null
  }
  if (typeof o.data !== 'string' || !o.data.trim()) return null
  const data = o.data.trim().replace(/^data:[^;]+;base64,/, '')
  return {
    tableId,
    mimeType: mimeType as import('./project-types').CropInput['mimeType'],
    data,
  }
}

export function parseCropsBody(
  body: unknown,
): import('./project-types').CropInput[] | null {
  if (!body || typeof body !== 'object') return null
  const cropsRaw = (body as { crops?: unknown }).crops
  if (!Array.isArray(cropsRaw)) return null
  const crops: import('./project-types').CropInput[] = []
  for (const item of cropsRaw) {
    const crop = parseCropInput(item)
    if (!crop) return null
    crops.push(crop)
  }
  return crops
}

export function parseBox(raw: unknown): import('./project-types').Box | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || !isClientId(o.id)) return null
  const title = typeof o.title === 'string' ? o.title : ''
  const label = typeof o.label === 'string' ? o.label : ''
  const score = typeof o.score === 'number' && Number.isFinite(o.score) ? o.score : 0
  const boxRaw = o.box
  if (!boxRaw || typeof boxRaw !== 'object') return null
  const b = boxRaw as Record<string, unknown>
  const xmin = b.xmin
  const ymin = b.ymin
  const xmax = b.xmax
  const ymax = b.ymax
  if (
    typeof xmin !== 'number' ||
    typeof ymin !== 'number' ||
    typeof xmax !== 'number' ||
    typeof ymax !== 'number' ||
    !Number.isFinite(xmin) ||
    !Number.isFinite(ymin) ||
    !Number.isFinite(xmax) ||
    !Number.isFinite(ymax) ||
    xmax <= xmin ||
    ymax <= ymin
  ) {
    return null
  }
  return {
    id: o.id,
    title: title.slice(0, 200),
    label: label.slice(0, 200),
    score,
    box: { xmin, ymin, xmax, ymax },
  }
}