import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type Props = { children: ReactNode }
type State = { failed: boolean }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>화면을 표시하지 못했습니다</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>예기치 않은 오류가 발생했습니다. 새로고침하면 저장된 프로젝트를 그대로 볼 수 있습니다.</p>
            <Button type="button" size="sm" onClick={() => window.location.reload()}>
              새로고침
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }
}
