import { useEffect, useRef } from 'react'

import { putDetection, type ProjectDetail } from '@/lib/api/projects'
import { defaultBoxTitle } from '@/lib/bbox/box-title'
import { DEFAULT_DETECTION_THRESHOLD } from '@/lib/project/constants'
import { detectTablesInImage } from '@/lib/table-detection/detector'

type Options = {
  projectId: string
  detail: ProjectDetail
  /** The active image is detected by the preview itself. */
  activeId: string | null
  fetchImageBlob: (imageId: string, signal?: AbortSignal) => Promise<Blob>
  onDetail: (detail: ProjectDetail) => void
}

/** Detects tables for every image that has no saved detection, one at a time. */
export function useDetectPendingImages({
  projectId,
  detail,
  activeId,
  fetchImageBlob,
  onDetail,
}: Options) {
  const settled = useRef(new Set<string>())

  const pendingKey = detail.images
    .filter((img) => img.detection === null && img.id !== activeId)
    .map((img) => img.id)
    .join(',')

  useEffect(() => {
    if (!pendingKey) return undefined
    const ac = new AbortController()

    void (async () => {
      for (const imageId of pendingKey.split(',')) {
        if (ac.signal.aborted) return
        if (settled.current.has(imageId)) continue
        try {
          const blob = await fetchImageBlob(imageId, ac.signal)
          const found = await detectTablesInImage(blob, {
            threshold: DEFAULT_DETECTION_THRESHOLD,
          })
          if (ac.signal.aborted) return
          const next = await putDetection(
            projectId,
            imageId,
            {
              threshold: DEFAULT_DETECTION_THRESHOLD,
              emptyHint: found.length === 0,
              selectedId: null,
              boxes: found.map((item, index) => ({
                id: `det-${index}-${crypto.randomUUID()}`,
                title: defaultBoxTitle(index),
                label: item.label,
                score: item.score,
                box: item.box,
              })),
            },
            ac.signal,
          )
          if (ac.signal.aborted) return
          settled.current.add(imageId)
          onDetail(next)
        } catch (err) {
          if (ac.signal.aborted) return
          settled.current.add(imageId)
          console.error('Background detection failed', imageId, err)
        }
      }
    })()

    return () => ac.abort()
  }, [fetchImageBlob, onDetail, pendingKey, projectId])
}
