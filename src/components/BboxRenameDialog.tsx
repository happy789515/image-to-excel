import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  open: boolean
  title: string
  onOpenChange: (open: boolean) => void
  onSave: (title: string) => void
}

export function BboxRenameDialog({ open, title, onOpenChange, onSave }: Props) {
  const [draft, setDraft] = useState(title)

  useEffect(() => {
    if (open) setDraft(title)
  }, [open, title])

  const save = () => {
    const next = draft.trim()
    if (!next) return
    onSave(next.slice(0, 31))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs" showCloseButton>
        <DialogHeader>
          <DialogTitle>시트 이름 변경</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="bbox-sheet-title">시트 이름</Label>
          <Input
            id="bbox-sheet-title"
            value={draft}
            maxLength={31}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
            }}
          />
        </div>
        <DialogFooter className="border-t-0 bg-transparent p-0 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button type="button" onClick={save} disabled={!draft.trim()}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}