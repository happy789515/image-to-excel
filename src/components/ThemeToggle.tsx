import { useCallback, useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  applyTheme,
  getStoredTheme,
  getSystemTheme,
  resolveTheme,
  setTheme,
  type ResolvedTheme,
} from '@/lib/theme'
import { cn } from 'cn'

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setThemeState] = useState<ResolvedTheme>(() => resolveTheme())

  useEffect(() => {
    const stored = getStoredTheme()
    if (stored) return undefined

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => {
      const next = getSystemTheme()
      applyTheme(next)
      setThemeState(next)
    }
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  const onToggle = useCallback(() => {
    const next: ResolvedTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }, [theme])

  const label =
    theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(
        'border-border/80 bg-card shadow-sm',
        className,
      )}
      onClick={onToggle}
      aria-label={label}
      aria-pressed={theme === 'dark'}
      title={label}
    >
      {theme === 'dark' ? (
        <Sun className="size-4" aria-hidden />
      ) : (
        <Moon className="size-4" aria-hidden />
      )}
    </Button>
  )
}