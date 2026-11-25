import { useState, type FormEvent } from 'react'
import { Loader2, Table2 } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loginApi } from '@/lib/api/auth'
import { ThemeToggle } from '@/components/ThemeToggle'

type Props = {
  onLoggedIn: (username: string) => void
  backendMessage?: string | null
}

export function LoginScreen({ onLoggedIn, backendMessage }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const user = await loginApi(username.trim(), password)
      onLoggedIn(user.username)
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <ThemeToggle className="fixed top-4 right-4 z-50 sm:top-5 sm:right-6" />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <Card className="w-full max-w-sm border-border shadow-sm">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Table2 className="size-5" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <CardTitle className="text-lg tracking-tight">Image to Excel</CardTitle>
              <CardDescription>계정으로 로그인한 뒤 표 추출을 시작합니다.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {backendMessage ? (
              <Alert variant="destructive">
                <AlertDescription>{backendMessage}</AlertDescription>
              </Alert>
            ) : null}
            <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
              <div className="space-y-2">
                <Label htmlFor="login-username">아이디</Label>
                <Input
                  id="login-username"
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">비밀번호</Label>
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    로그인 중…
                  </>
                ) : (
                  '로그인'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}