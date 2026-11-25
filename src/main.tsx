import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppRoot } from './AppRoot.tsx'
import { MotionProvider } from '@/lib/motion/MotionProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionProvider>
      <AppRoot />
    </MotionProvider>
  </StrictMode>,
)
