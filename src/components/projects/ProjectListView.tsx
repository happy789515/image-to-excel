import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import {
  createProject,
  deleteProject,
  listProjects,
  patchProject,
  type ProjectSummary,
} from '@/lib/api/projects'
import { formatUpdatedAt } from '@/lib/image-upload'

type Props = {
  onOpen: (project: ProjectSummary) => void
}

export function ProjectListView({ onOpen }: Props) {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('새 프로젝트')
  const [creating, setCreating] = useState(false)

  const [renameTarget, setRenameTarget] = useState<ProjectSummary | null>(null)
  const [renameName, setRenameName] = useState('')
  const [renaming, setRenaming] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const items = await listProjects()
      setProjects(items)
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void listProjects()
      .then((items) => {
        if (!cancelled) setProjects(items)
      })
      .catch((err) => {
        if (!cancelled && err instanceof Error) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleCreate = async () => {
    const name = createName.trim()
    if (!name) return
    setCreating(true)
    setError(null)
    try {
      const project = await createProject(name)
      setCreateOpen(false)
      onOpen(project)
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleRename = async () => {
    if (!renameTarget) return
    const name = renameName.trim()
    if (!name) return
    setRenaming(true)
    setError(null)
    try {
      await patchProject(renameTarget.id, name)
      setRenameTarget(null)
      await refresh()
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    } finally {
      setRenaming(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setError(null)
    try {
      await deleteProject(deleteTarget.id)
      setDeleteTarget(null)
      await refresh()
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">프로젝트</h1>
          <p className="text-sm text-muted-foreground">
            이미지 여러 장을 한 엑셀 파일로 묶습니다.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          새 프로젝트
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">프로젝트가 없습니다</CardTitle>
            <CardDescription>
              프로젝트를 만들고 이미지를 업로드해 표 검출을 시작하세요.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Card className="h-full transition-colors hover:border-primary/30">
                <CardHeader className="space-y-1 pb-2">
                  <CardTitle className="truncate text-base">{project.name}</CardTitle>
                  <CardDescription className="text-xs">
                    이미지 {project.imageCount}장 ·{' '}
                    {formatUpdatedAt(project.updatedAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 pt-0">
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1"
                    onClick={() => onOpen(project)}
                  >
                    열기
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="이름 변경"
                    onClick={() => {
                      setRenameTarget(project)
                      setRenameName(project.name)
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="삭제"
                    onClick={() => setDeleteTarget(project)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm" showCloseButton>
          <DialogHeader>
            <DialogTitle>새 프로젝트</DialogTitle>
            <DialogDescription>프로젝트 이름을 입력하세요.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="project-create-name">이름</Label>
            <Input
              id="project-create-name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreate()
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              disabled={creating || !createName.trim()}
              onClick={() => void handleCreate()}
            >
              {creating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              만들기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-sm" showCloseButton>
          <DialogHeader>
            <DialogTitle>이름 변경</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="project-rename-name">이름</Label>
            <Input
              id="project-rename-name"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleRename()
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameTarget(null)}
            >
              취소
            </Button>
            <Button
              type="button"
              disabled={renaming || !renameName.trim()}
              onClick={() => void handleRename()}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-sm" showCloseButton>
          <DialogHeader>
            <DialogTitle>프로젝트 삭제</DialogTitle>
            <DialogDescription>
              「{deleteTarget?.name}」과 모든 이미지·표·추출 결과가 삭제됩니다.
              되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
