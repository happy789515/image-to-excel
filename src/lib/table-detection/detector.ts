import {
  AutoModelForObjectDetection,
  AutoProcessor,
  ObjectDetectionPipeline,
} from '@huggingface/transformers'

import { configureTransformersEnv } from '@/lib/transformers-env'
import {
  TABLE_DETECTION_MODEL_ID,
  type TableDetectionBox,
} from '@/lib/table-detection/types'

configureTransformersEnv()

/** Same defaults as `pipeline('object-detection', …)` — ONNX subfolder, quantized weights. */
const DETECTOR_LOAD_OPTIONS = {
  subfolder: 'onnx',
} as const

let detectorPromise: Promise<ObjectDetectionPipeline> | null = null

/**
 * `pipeline('object-detection')` treats the task as multimodal and probes
 * `tokenizer_config.json` on the Hub (404 for this vision-only model). Load
 * model + processor directly instead to avoid the stray network error.
 */
export function loadTableDetector(): Promise<ObjectDetectionPipeline> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const [model, processor] = await Promise.all([
        AutoModelForObjectDetection.from_pretrained(
          TABLE_DETECTION_MODEL_ID,
          DETECTOR_LOAD_OPTIONS,
        ),
        AutoProcessor.from_pretrained(
          TABLE_DETECTION_MODEL_ID,
          DETECTOR_LOAD_OPTIONS,
        ),
      ])
      return new ObjectDetectionPipeline({
        task: 'object-detection',
        model,
        processor,
      })
    })()
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