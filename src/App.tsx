import { ImageDropzone } from '@/components/ImageDropzone'
import { TABLE_DETECTION_ATTRIBUTION } from '@/lib/table-detection/types'
import { Table2 } from 'lucide-react'

function App() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-border/80 bg-card/90 shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-5 pr-16 sm:px-6 sm:pr-20">
          <div
            className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_1px_2px_color-mix(in_oklch,var(--primary),transparent_40%),0_8px_24px_color-mix(in_oklch,var(--primary),transparent_75%)]"
            aria-hidden
          >
            <Table2 className="size-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight text-foreground">
              Image to Excel
            </p>
            <p className="text-sm text-muted-foreground">
              로그인 없이 이미지에서 표를 추출합니다
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 max-w-prose">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            변환할 이미지를 올려주세요
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            이미지·PDF를 받습니다. 드래그, 파일 선택, Ctrl+V 붙여넣기를
            지원합니다.
          </p>
        </div>

        <ImageDropzone />
      </main>

      <footer className="border-t border-border/80 bg-card/40 py-6">
        <p className="text-center text-xs text-muted-foreground">
          파일은 브라우저에서 처리되며 서버에 업로드하지 않습니다.
          <br />
          {TABLE_DETECTION_ATTRIBUTION}
        </p>
      </footer>
    </div>
  )
}

export default App