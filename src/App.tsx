import { useCallback, useState } from 'react'
import { ArrowLeft, Loader2, LogOut, Table2 } from 'lucide-react'
import { m } from 'motion/react'

import { ProjectListView } from '@/components/projects/ProjectListView'
import { Workshop } from '@/components/workshop/Workshop'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ProjectWorkshopProvider } from '@/context/ProjectWorkshopContext'
import {
  getProject,
  type ProjectDetail,
  type ProjectSummary,
} from '@/lib/api/projects'
import {
  motionFrom,
  motionInitial,
  motionTransition,
  useReducedMotion,
} from '@/lib/motion/use-reduced-motion'
import {
  fadeUp,
  springSnappy,
  staggerContainerFast,
  staggerItem,
} from '@/lib/motion/variants'

type AppProps = {
  username: string
  onLogout: () => void
}

export default function App({ username, onLogout }: AppProps) {
  const reduced = useReducedMotion()
  const transition = motionTransition(reduced, springSnappy)

  const [openProject, setOpenProject] = useState<ProjectDetail | null>(null)
  const [opening, setOpening] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)

  const handleOpenProject = useCallback(async (summary: ProjectSummary) => {
    setOpening(true)
    setOpenError(null)
    try {
      const detail = await getProject(summary.id)
      setOpenProject(detail)
    } catch (err) {
      if (err instanceof Error) setOpenError(err.message)
    } finally {
      setOpening(false)
    }
  }, [])

  const handleBack = useCallback(() => {
    setOpenProject(null)
    setOpenError(null)
  }, [])

  return (
    <m.div
      className="flex h-svh flex-col overflow-hidden"
      variants={staggerContainerFast}
      initial={motionInitial(reduced)}
      animate="animate"
    >
      <m.header
        variants={staggerItem}
        transition={transition}
        className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4"
      >
        {openProject ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1"
            onClick={handleBack}
          >
            <ArrowLeft className="size-4" aria-hidden />
            목록
          </Button>
        ) : null}
        <m.div
          className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"
          initial={motionFrom(reduced, { opacity: 0, scale: 0.9 })}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...transition, delay: reduced ? 0 : 0.05 }}
          aria-hidden
        >
          <Table2 className="size-4.5" strokeWidth={2} />
        </m.div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight text-foreground">
            {openProject ? openProject.project.name : 'Image to Excel'}
          </p>
          <p className="text-xs text-muted-foreground">
            {username}으로 로그인됨
            {openProject ? '' : ' · 프로젝트를 선택하세요'}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={onLogout}
        >
          <LogOut className="size-3.5" aria-hidden />
          로그아웃
        </Button>
        <ThemeToggle className="shrink-0 self-center" />
      </m.header>

      {openError ? (
        <Alert variant="destructive" className="m-3 mb-0 shrink-0">
          <AlertDescription>{openError}</AlertDescription>
        </Alert>
      ) : null}

      <m.div
        className="flex min-h-0 flex-1 flex-col"
        variants={fadeUp}
        initial={motionInitial(reduced)}
        animate="animate"
        transition={{ ...transition, delay: reduced ? 0 : 0.05 }}
      >
        {opening ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : openProject ? (
          <ProjectWorkshopProvider
            key={openProject.project.id}
            projectId={openProject.project.id}
            initialDetail={openProject}
          >
            <Workshop />
          </ProjectWorkshopProvider>
        ) : (
          <ProjectListView onOpen={(p) => void handleOpenProject(p)} />
        )}
      </m.div>
    </m.div>
  )
}