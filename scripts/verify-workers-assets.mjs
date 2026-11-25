import fs from 'node:fs'
import path from 'node:path'

/** Cloudflare Workers static asset per-file limit */
const MAX_BYTES = 25 * 1024 * 1024
const DIST = path.resolve('dist')

if (!fs.existsSync(DIST)) {
  console.error('dist/ not found — run npm run build first.')
  process.exit(1)
}

/** @type {string[]} */
const oversized = []

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      walk(filePath)
      continue
    }
    const { size } = fs.statSync(filePath)
    if (size > MAX_BYTES) {
      oversized.push(
        `${path.relative(process.cwd(), filePath)} (${(size / 1024 / 1024).toFixed(2)} MiB)`,
      )
    }
  }
}

walk(DIST)

if (oversized.length > 0) {
  console.error('Workers asset limit exceeded (max 25 MiB per file):\n')
  for (const line of oversized) console.error(`  - ${line}`)
  process.exit(1)
}

console.log('Workers static assets OK (no file over 25 MiB).')