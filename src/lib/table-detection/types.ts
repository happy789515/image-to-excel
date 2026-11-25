export type TableDetectionBox = {
  label: string
  score: number
  box: {
    xmin: number
    ymin: number
    xmax: number
    ymax: number
  }
}

export const TABLE_DETECTION_MODEL_ID = 'Xenova/table-transformer-detection'

/** Microsoft Table Transformer (via Xenova ONNX). MIT — personal / non-commercial use. */
export const TABLE_DETECTION_ATTRIBUTION =
  '표 검출: Microsoft Table Transformer (MIT), 브라우저 실행 ONNX'