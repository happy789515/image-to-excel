const INVALID = /[\\/*?:[\]]/g
const MAX_LEN = 31

export function sanitizeSheetName(raw: string, used: Set<string>): string {
  let name = raw.trim().replace(INVALID, '').replace(/\s+/g, ' ')
  if (!name) name = 'Sheet'
  if (name.length > MAX_LEN) name = name.slice(0, MAX_LEN)

  let candidate = name
  let n = 2
  while (used.has(candidate)) {
    const suffix = ` (${n})`
    const base = name.slice(0, Math.max(1, MAX_LEN - suffix.length))
    candidate = `${base}${suffix}`
    n += 1
  }
  used.add(candidate)
  return candidate
}