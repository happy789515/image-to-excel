export const ALLOWED_UPLOAD_MIME = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/webp',
])

export function hasImageSignature(head: Uint8Array, mime: string): boolean {
  const startsWith = (sig: number[], offset = 0) =>
    sig.every((byte, i) => head[offset + i] === byte)
  if (mime === 'image/jpeg') return startsWith([0xff, 0xd8, 0xff])
  if (mime === 'image/png') return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (mime === 'image/webp')
    return startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)
  return false
}
