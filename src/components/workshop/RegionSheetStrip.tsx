import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { Trash2 } from 'lucide-react'

import type { EditableBox } from '@/components/EditableBBoxLayer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PanZoomViewport } from '@/components/PanZoomViewport'
import { drawCropPreview, PREVIEW_PAD_RATIO } from '@/lib/image/crop'
import { cn } from 'cn'

function boxKey(box: EditableBox['box']): string {
  return `${box.xmin.toFixed(2)}-${box.ymin.toFixed(2)}-${box.xmax.toFixed(2)}-${box.ymax.toFixed(2)}`
}

type Props = {
  imageRef: RefObject<HTMLImageElement | null>
  imageRevision: number
  boxes: EditableBox[]
  selectedId: string | null
  onSelect: (id: string) => void
  onTitleChange?: (id: string, title: string) => void
  onDelete?: (id: string) => void
  action?: ReactNode
  className?: string
}

export function RegionSheetStrip({
  imageRef,
  imageRevision,
  boxes,
  selectedId,
  onSelect,
  onTitleChange,
  onDelete,
  action,
  className,
}: Props) {
  const thumbRefs = useRef<Map<string, HTMLCanvasElement>>(new Map())
  const rafRef = useRef(0)

  const signature = useMemo(
    () => boxes.map((b) => `${b.id}:${boxKey(b.box)}:${b.title}`).join('|'),
    [boxes],
  )

  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const img = imageRef.current
      if (!img?.naturalWidth) return

      for (const item of boxes) {
        const canvas = thumbRefs.current.get(item.id)
        if (!canvas) continue
        drawCropPreview(img, item.box, canvas, {
          padRatio: PREVIEW_PAD_RATIO,
          maxDimension: 320,
        })
      }
    })
    return () => cancelAnimationFrame(rafRef.current)
  }, [imageRef, imageRevision, signature, boxes])

  const setThumbRef = (id: string) => (el: HTMLCanvasElement | null) => {
    if (el) thumbRefs.current.set(id, el)
    else thumbRefs.current.delete(id)
  }

  if (boxes.length === 0) return null

  const editable = Boolean(onTitleChange)

  return (
    <Card
      size="sm"
      className={cn('shrink-0 bg-card py-0', className)}
      role="region"
      aria-label="시트 영역 목록"
    >
      <CardHeader className="border-b border-border px-3 py-2">
        <CardTitle className="text-xs">
          시트 영역 {boxes.length > 1 ? `${boxes.length}개` : ''}
        </CardTitle>
        <CardDescription className="text-[10px]">
          {editable ? '이름은 Excel 시트로 저장됩니다' : '카드를 눌러 영역을 바꿉니다'}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex items-stretch gap-0 p-0">
        <div className="scrollbar-thin min-w-0 flex-1 overflow-x-auto p-2">
          <div className="flex w-max min-w-full gap-2">
            {boxes.map((b, i) => {
              const active = b.id === selectedId
              return (
                <Card
                  key={b.id}
                  size="sm"
                  className={cn(
                    'w-[11.5rem] shrink-0 bg-card py-0 transition-colors',
                    active && 'bg-primary/10 ring-2 ring-inset ring-primary/25',
                    !active && 'hover:bg-muted/40',
                  )}
                >
                  <div className="relative">
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => onSelect(b.id)}
                      className="block w-full cursor-pointer overflow-hidden text-left transition-opacity hover:opacity-95 active:opacity-90"
                    >
                      <SheetThumbPanZoom
                        id={b.id}
                        setThumbRef={setThumbRef(b.id)}
                        resetKey={`${signature}:${b.id}`}
                      />
                    </button>
                    {onDelete ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-xs"
                        className={cn(
                          'absolute right-1 top-1 z-20 size-7 border border-destructive/40 shadow-md',
                          'bg-destructive text-white hover:bg-destructive/90',
                          'dark:bg-destructive dark:text-white dark:hover:bg-destructive/90',
                        )}
                        aria-label={`시트 ${i + 1} 영역 삭제`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(b.id)
                        }}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                  <CardFooterInner className="flex min-w-0 items-center gap-1 border-t border-border px-2 py-1.5">
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      {i + 1}
                    </Badge>
                    {editable ? (
                      <Input
                        value={b.title}
                        maxLength={31}
                        onClick={() => onSelect(b.id)}
                        onChange={(e) => onTitleChange?.(b.id, e.target.value)}
                        className="h-7 min-w-0 flex-1 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                        aria-label={`시트 ${i + 1} 이름`}
                        placeholder="시트 이름"
                      />
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                        {b.title}
                      </span>
                    )}
                    <Badge variant="outline" className="h-5 px-1.5 text-[9px] font-normal">
                      {b.score > 0 ? `${(b.score * 100).toFixed(0)}%` : '수동'}
                    </Badge>
                  </CardFooterInner>
                </Card>
              )
            })}
          </div>
        </div>
        {action ? (
          <div className="flex shrink-0 items-center border-l border-border p-2 pl-3">
            {action}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function SheetThumbPanZoom({
  id,
  setThumbRef,
  resetKey,
}: {
  id: string
  setThumbRef: (el: HTMLCanvasElement | null) => void
  resetKey: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const mergeRef = (el: HTMLCanvasElement | null) => {
    canvasRef.current = el
    setThumbRef(el)
  }

  return (
    <div className="relative aspect-[184/72] w-full bg-background">
      <PanZoomViewport
        className="absolute inset-0"
        minimap={{ kind: 'canvas', canvasRef }}
        minimapClassName="h-10 w-14"
        resetKey={resetKey}
      >
        <canvas
          ref={mergeRef}
          width={184}
          height={72}
          data-thumb-id={id}
          className="block w-[11.5rem] max-w-none"
          aria-hidden
        />
      </PanZoomViewport>
    </div>
  )
}

function CardFooterInner({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={className}>{children}</div>
}
