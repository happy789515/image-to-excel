export type SignatureTable = {
  id: string
  xmin: number
  ymin: number
  xmax: number
  ymax: number
  imagePosition: number
  position: number
}

function roundCoord(n: number): string {
  return n.toFixed(2)
}

/** Member tables ordered by image position, then table position. */
export function orderTablesForSignature<T extends SignatureTable>(
  tables: T[],
): T[] {
  return [...tables].sort(
    (a, b) =>
      a.imagePosition - b.imagePosition || a.position - b.position,
  )
}

export function computeSheetExtractSignature(tables: SignatureTable[]): string {
  const ordered = orderTablesForSignature(tables)
  return ordered
    .map(
      (t) =>
        `${t.id}:${roundCoord(t.xmin)},${roundCoord(t.ymin)},${roundCoord(t.xmax)},${roundCoord(t.ymax)}`,
    )
    .join('|')
}

export function sheetIsStale(
  rowsJson: string | null,
  storedSignature: string | null,
  currentSignature: string,
): boolean {
  if (!rowsJson || storedSignature == null) return false
  return storedSignature !== currentSignature
}