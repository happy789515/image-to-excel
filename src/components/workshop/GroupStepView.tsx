import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Pencil, Wand2 } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { useProjectWorkshop } from '@/hooks/use-project-workshop'
import { patchSheet, patchTableSheet, postGroup } from '@/lib/api/projects'
import { drawCropPreview, PREVIEW_PAD_RATIO } from '@/lib/image/crop'
import {
  buildCropsForTables,
  CROP_PAYLOAD_TOO_LARGE_MSG,
  cropPayloadOverLimit,
  GROUP_CROP_PROFILE,
} from '@/lib/project/crop-payload'
import {
  imageNameById,
  sheetsSorted,
  tablesForImage,
  tablesInSheet,
  tablesSorted,
  unassignedTables,
} from '@/lib/project/selectors'
import { cn } from 'cn'

const NEW_SHEET_VALUE = '__new__'

type Props = {
  fetchImageBlob: (imageId: string, signal?: AbortSignal) => Promise<Blob>
}

export function GroupStepView({ fetchImageBlob }: Props) {
  const { projectId, detail, setDetail } = useProjectWorkshop()
  const [grouping, setGrouping] = useState(false)
  const [groupProgress, setGroupProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [newSheetOpen, setNewSheetOpen] = useState(false)
  const [newSheetName, setNewSheetName] = useState('')
  const [moveTableId, setMoveTableId] = useState<string | null>(null)
  const [renamingSheetId, setRenamingSheetId] = useState<string | null>(null)
  const [renameSheetName, setRenameSheetName] = useState('')
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null)

  const names = useMemo(() => imageNameById(detail), [detail])
  const sheets = useMemo(() => sheetsSorted(detail), [detail])
  const unassigned = useMemo(() => unassignedTables(detail), [detail])
  const allTables = useMemo(() => tablesSorted(detail), [detail])
  const undetectedCount = useMemo(
    () => detail.images.filter((img) => img.detection == null).length,
    [detail.images],
  )

  const runGroup = useCallback(async () => {
    if (allTables.length === 0) return
    setError(null)
    setGrouping(true)
    setGroupProgress(5)
    try {
      const blobById = new Map<string, Blob>()
      const imageIds = [...new Set(allTables.map((t) => t.imageId))]
      for (let i = 0; i < imageIds.length; i += 1) {
        const iid = imageIds[i]!
        blobById.set(iid, await fetchImageBlob(iid))
        setGroupProgress(5 + Math.round(((i + 1) / imageIds.length) * 40))
      }
      setGroupProgress(50)
      const crops = await buildCropsForTables(
        allTables,
        blobById,
        GROUP_CROP_PROFILE,
      )
      setGroupProgress(70)
      if (cropPayloadOverLimit(crops)) {
        setError(CROP_PAYLOAD_TOO_LARGE_MSG)
        return
      }
      const next = await postGroup(projectId, crops)
      setDetail(next)
      setGroupProgress(100)
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message)
      }
    } finally {
      setGrouping(false)
    }
  }, [allTables, fetchImageBlob, projectId, setDetail])

  const handleMove = async (
    tableId: string,
    body: { sheetId: string } | { newSheetName: string },
  ) => {
    setError(null)
    try {
      const next = await patchTableSheet(projectId, tableId, body)
      setDetail(next)
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    }
  }

  const endDrag = () => {
    setDraggingTableId(null)
    setDragOverTarget(null)
  }

  const draggingTable = draggingTableId
    ? detail.tables.find((t) => t.id === draggingTableId)
    : undefined

  const dropTargetProps = (target: string, onDropTable: (tableId: string) => void) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!draggingTable || draggingTable.sheetId === target) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDragOverTarget(target)
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
        setDragOverTarget((cur) => (cur === target ? null : cur))
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      const table = draggingTable
      endDrag()
      if (table && table.sheetId !== target) onDropTable(table.id)
    },
  })

  const confirmNewSheet = async () => {
    const name = newSheetName.trim()
    if (!moveTableId || !name) return
    await handleMove(moveTableId, { newSheetName: name })
    setNewSheetOpen(false)
    setMoveTableId(null)
    setNewSheetName('')
  }

  const handleRenameSheet = async () => {
    if (!renamingSheetId) return
    const name = renameSheetName.trim()
    if (!name) return
    setError(null)
    try {
      const next = await patchSheet(projectId, renamingSheetId, { name })
      setDetail(next)
      setRenamingSheetId(null)
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={grouping || allTables.length === 0 || undetectedCount > 0}
          onClick={() => void runGroup()}
        >
          {grouping ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Wand2 className="size-4" />
          )}
          자동 그룹핑
        </Button>
        <p className="text-xs text-muted-foreground">
          {undetectedCount > 0
            ? `표 검출이 끝나지 않은 이미지가 ${undetectedCount}장 있습니다. 검출이 끝나면 그룹핑할 수 있습니다.`
            : '재그룹핑해도 수동으로 옮긴 표는 유지됩니다.'}
        </p>
      </div>

      {grouping ? (
        <div className="space-y-2">
          <Progress value={groupProgress} />
          <p className="text-xs text-muted-foreground">그룹핑 요청 중…</p>
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {unassigned.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">미배정 표</h2>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((table) => (
              <TableChip
                key={table.id}
                table={table}
                imageName={names.get(table.imageId) ?? '이미지'}
                fetchImageBlob={fetchImageBlob}
                onMove={(sheetId) => void handleMove(table.id, { sheetId })}
                onNewSheet={() => {
                  setMoveTableId(table.id)
                  setNewSheetName('')
                  setNewSheetOpen(true)
                }}
                otherSheets={sheets}
                dragging={draggingTableId === table.id}
                onDragStart={() => setDraggingTableId(table.id)}
                onDragEnd={endDrag}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {sheets.map((sheet) => {
          const members = tablesInSheet(detail, sheet.id)
          const manual = members.some((t) => t.sheetManual)
          return (
            <Card
              key={sheet.id}
              {...dropTargetProps(sheet.id, (tableId) =>
                void handleMove(tableId, { sheetId: sheet.id }),
              )}
              className={cn(
                'transition-[transform,box-shadow] duration-200 ease-out motion-reduce:transition-none',
                dragOverTarget === sheet.id && 'scale-[1.01] shadow-md ring-2 ring-primary',
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="truncate text-base">{sheet.name}</CardTitle>
                <div className="flex shrink-0 items-center gap-1">
                  {manual ? (
                    <Badge variant="outline" className="text-[10px]">
                      수동
                    </Badge>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="시트 이름 변경"
                    onClick={() => {
                      setRenamingSheetId(sheet.id)
                      setRenameSheetName(sheet.name)
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 pt-0">
                {members.length === 0 ? (
                  <p className="text-xs text-muted-foreground">표 없음</p>
                ) : (
                  members.map((table) => (
                    <TableChip
                      key={table.id}
                      table={table}
                      imageName={names.get(table.imageId) ?? '이미지'}
                      fetchImageBlob={fetchImageBlob}
                      onMove={(sheetId) => void handleMove(table.id, { sheetId })}
                      onNewSheet={() => {
                        setMoveTableId(table.id)
                        setNewSheetName('')
                        setNewSheetOpen(true)
                      }}
                      otherSheets={sheets.filter((s) => s.id !== sheet.id)}
                      dragging={draggingTableId === table.id}
                      onDragStart={() => setDraggingTableId(table.id)}
                      onDragEnd={endDrag}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          )
        })}
        {draggingTable ? (
          <div
            {...dropTargetProps(NEW_SHEET_VALUE, (tableId) => {
              setMoveTableId(tableId)
              setNewSheetName('')
              setNewSheetOpen(true)
            })}
            className={cn(
              'flex min-h-24 animate-in fade-in-0 zoom-in-95 items-center justify-center rounded-xl border-2 border-dashed px-4 text-center text-xs text-muted-foreground duration-200 transition-[background-color,border-color,color,transform] ease-out motion-reduce:animate-none motion-reduce:transition-none',
              dragOverTarget === NEW_SHEET_VALUE && 'scale-[1.01] border-primary bg-primary/5 text-foreground',
            )}
          >
            여기에 놓아 새 시트 만들기
          </div>
        ) : null}
      </div>

      <Dialog open={newSheetOpen} onOpenChange={setNewSheetOpen}>
        <DialogContent className="sm:max-w-sm" showCloseButton>
          <DialogHeader>
            <DialogTitle>새 시트</DialogTitle>
            <DialogDescription>표를 넣을 시트 이름을 입력하세요.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="new-sheet-name">시트 이름</Label>
            <Input
              id="new-sheet-name"
              value={newSheetName}
              onChange={(e) => setNewSheetName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewSheetOpen(false)}>
              취소
            </Button>
            <Button
              type="button"
              disabled={!newSheetName.trim()}
              onClick={() => void confirmNewSheet()}
            >
              만들기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renamingSheetId !== null}
        onOpenChange={(open) => {
          if (!open) setRenamingSheetId(null)
        }}
      >
        <DialogContent className="sm:max-w-sm" showCloseButton>
          <DialogHeader>
            <DialogTitle>시트 이름 변경</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="rename-sheet-name">이름</Label>
            <Input
              id="rename-sheet-name"
              value={renameSheetName}
              onChange={(e) => setRenameSheetName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenamingSheetId(null)}>
              취소
            </Button>
            <Button
              type="button"
              disabled={!renameSheetName.trim()}
              onClick={() => void handleRenameSheet()}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TableChip({
  table,
  imageName,
  fetchImageBlob,
  onMove,
  onNewSheet,
  otherSheets,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  table: ReturnType<typeof tablesForImage>[number]
  imageName: string
  fetchImageBlob: (imageId: string) => Promise<Blob>
  onMove: (sheetId: string) => void
  onNewSheet: () => void
  otherSheets: { id: string; name: string }[]
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const [thumb, setThumb] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const blob = await fetchImageBlob(table.imageId)
        const url = URL.createObjectURL(blob)
        const img = new Image()
        img.src = url
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject()
        })
        const canvas = document.createElement('canvas')
        drawCropPreview(img, table.box, canvas, {
          padRatio: PREVIEW_PAD_RATIO,
          maxDimension: 160,
        })
        URL.revokeObjectURL(url)
        if (!cancelled) setThumb(canvas.toDataURL('image/jpeg', 0.85))
      } catch {
        /* ignore thumbnail errors */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fetchImageBlob, table.box, table.imageId])

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', table.id)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'flex w-36 cursor-grab flex-col gap-1 rounded-lg border border-border bg-card p-2 text-left text-xs shadow-sm transition-[transform,opacity,box-shadow,border-color] duration-200 ease-out active:cursor-grabbing',
        'hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md',
        dragging && 'scale-95 opacity-40 shadow-none',
        'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
      )}
    >
      <div className="aspect-[4/3] w-full overflow-hidden rounded bg-muted">
        {thumb ? (
          <img src={thumb} alt="" draggable={false} className="size-full object-cover" />
        ) : null}
      </div>
      <span className="truncate font-medium">{table.title}</span>
      <span
        className="truncate text-[10px] text-muted-foreground"
        title={imageName}
      >
        {imageName}
      </span>
      <select
        aria-label={`${imageName} ${table.title} 시트로 이동`}
        value=""
        onChange={(e) => {
          const value = e.target.value
          if (value === NEW_SHEET_VALUE) onNewSheet()
          else if (value) onMove(value)
        }}
        className="h-7 w-full rounded-md border border-input bg-background px-1 text-[11px]"
      >
        <option value="">시트로 이동…</option>
        {otherSheets.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
        <option value={NEW_SHEET_VALUE}>새 시트…</option>
      </select>
    </div>
  )
}