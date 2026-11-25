import { LogOut, Table2 } from 'lucide-react'

import { Workshop } from '@/components/workshop/Workshop'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'

type AppProps = {
  username: string
  onLogout: () => void
}

function App({ username, onLogout }: AppProps) {
  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
        <div
          className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"
          aria-hidden
        >
          <Table2 className="size-4.5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight text-foreground">
            Image to Excel
          </p>
          <p className="hidden text-xs text-muted-foreground sm:block">
            {username}으로 로그인됨 · 이미지에서 표를 추출합니다
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
      </header>

      <Workshop />
    </div>
  )
}

export default App