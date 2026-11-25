import type { EditableBox } from '@/components/EditableBBoxLayer'

export function defaultBoxTitle(index: number): string {
  return `표 ${index + 1}`
}

export function normalizeBoxTitles(boxes: EditableBox[]): EditableBox[] {
  return boxes.map((box, index) => {
    const title = 'title' in box ? box.title : undefined
    return {
      ...box,
      title:
        typeof title === 'string' && title.trim().length > 0
          ? title.trim()
          : defaultBoxTitle(index),
    }
  })
}

export function withTitleOnAppend(
  boxes: EditableBox[],
  entry: Omit<EditableBox, 'title'> & { title?: string },
): EditableBox {
  return {
    ...entry,
    title: entry.title?.trim() || defaultBoxTitle(boxes.length),
  }
}