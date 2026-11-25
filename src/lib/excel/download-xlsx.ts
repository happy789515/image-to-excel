export function downloadXlsxFile(blob: Blob, downloadFileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = downloadFileName
  a.click()
  URL.revokeObjectURL(url)
}