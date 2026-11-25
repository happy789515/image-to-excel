export const THEME_STORAGE_KEY = 'image-to-excel-theme'

export type ResolvedTheme = 'light' | 'dark'

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function getStoredTheme(): ResolvedTheme | null {
  if (typeof localStorage === 'undefined') return null
  const value = localStorage.getItem(THEME_STORAGE_KEY)
  if (value === 'light' || value === 'dark') return value
  return null
}

export function hasStoredTheme(): boolean {
  return getStoredTheme() !== null
}

export function resolveTheme(): ResolvedTheme {
  return getStoredTheme() ?? getSystemTheme()
}

export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function setTheme(theme: ResolvedTheme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme)
  applyTheme(theme)
}

export function toggleTheme(): ResolvedTheme {
  const current: ResolvedTheme = document.documentElement.classList.contains(
    'dark',
  )
    ? 'dark'
    : 'light'
  const next: ResolvedTheme = current === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}