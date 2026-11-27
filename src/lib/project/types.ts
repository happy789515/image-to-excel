/** Project domain types shared by the browser (IndexedDB) and the Gemini proxy Worker. */

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

export type TableRowJson = { cells: string[] }
export type TableExtractJson = {
  name: string
  rows: TableRowJson[]
}

export type GroupGeminiResponse = {
  groups: Array<{ sheetName: string; tableRefs: string[] }>
}
