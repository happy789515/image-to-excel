import type { EditableBox } from '@/components/EditableBBoxLayer'
import type { StoredWorkshopSession } from '@/lib/workshop-persist'

/** Stable across refresh; ignores ephemeral bbox ids. */
export function boxesGeometrySignature(boxes: EditableBox[]): string {
  return boxes
    .map(
      (b) =>
        `${b.title}:${b.box.xmin.toFixed(2)},${b.box.ymin.toFixed(2)},${b.box.xmax.toFixed(2)},${b.box.ymax.toFixed(2)}`,
    )
    .join('|')
}

function boxesIdSignature(boxes: EditableBox[]): string {
  return boxes
    .map(
      (b) =>
        `${b.id}:${b.title}:${b.box.xmin},${b.box.ymin},${b.box.xmax},${b.box.ymax}`,
    )
    .join('|')
}

export function exportSessionMatches(
  session: Pick<StoredWorkshopSession, 'exportSheets' | 'exportSignature'>,
  boxes: EditableBox[],
): boolean {
  if (!session.exportSheets?.length || session.exportSignature == null) {
    return false
  }
  const sig = session.exportSignature
  return (
    sig === boxesGeometrySignature(boxes) || sig === boxesIdSignature(boxes)
  )
}

export function exportStillValid(
  boxes: EditableBox[],
  exportSignature: string | null,
): boolean {
  if (exportSignature == null) return false
  return (
    exportSignature === boxesGeometrySignature(boxes) ||
    exportSignature === boxesIdSignature(boxes)
  )
}