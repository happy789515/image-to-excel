import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppRoot } from './AppRoot.tsx'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'
import { MotionProvider } from '@/lib/motion/MotionProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <MotionProvider>
        <AppRoot />
      </MotionProvider>
    </AppErrorBoundary>
  </StrictMode>,
)
