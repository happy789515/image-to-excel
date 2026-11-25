import { env, pipeline, type ObjectDetectionPipeline } from '@huggingface/transformers'

import {
  TABLE_DETECTION_MODEL_ID,
  type TableDetectionBox,
} from '@/lib/table-detection/types'

env.useBrowserCache = true

let detectorPromise: Promise<ObjectDetectionPipeline> | null = null

export function loadTableDetector(): Promise<ObjectDetectionPipeline> {
  if (!detectorPromise) {
    detectorPromise = pipeline('object-detection', TABLE_DETECTION_MODEL_ID)
  }
  return detectorPromise
}

export async function detectTablesInImage(
  image: Blob | string,
  options?: { threshold?: number },
): Promise<TableDetectionBox[]> {
  const threshold = options?.threshold ?? 0.5
  const detector = await loadTableDetector()

  const objectUrl = image instanceof Blob ? URL.createObjectURL(image) : null
  const source = objectUrl ?? image

  try {
    const raw = await detector(source, {
      threshold,
      percentage: false,
    })

    const list = Array.isArray(raw) ? raw : [raw]

    return list.map((item) => ({
      label: item.label,
      score: item.score,
      box: {
        xmin: item.box.xmin,
        ymin: item.box.ymin,
        xmax: item.box.xmax,
        ymax: item.box.ymax,
      },
    }))
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}