// Manage login accounts in the D1 `users` table.
//
//   node scripts/manage-users.mjs add <username> [--remote]   password is read from stdin
//   node scripts/manage-users.mjs seed [--remote]             imports AUTH_USERS (env, else .dev.vars)
//
// Apply migrations first: `npx wrangler d1 migrations apply DB --local` (or --remote).
// Hash parameters must match worker/password.ts.

import { randomBytes, randomUUID, pbkdf2 } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { promisify } from 'node:util'

const PBKDF2 = promisify(pbkdf2)
const ITERATIONS = 100_000
const HASH_BYTES = 32
const SALT_BYTES = 16
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const wranglerBin = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')

function fail(message) {
  console.error(message)
  process.exit(1)
}

async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES)
  const hash = await PBKDF2(password, salt, ITERATIONS, HASH_BYTES, 'sha256')
  return {
    passwordHash: hash.toString('base64'),
    salt: salt.toString('base64'),
    iterations: ITERATIONS,
  }
}

function insertSql(username, record) {
  return [
    'INSERT OR IGNORE INTO users (id, username, password_hash, salt, iterations, created_at)',
    `VALUES ('${randomUUID()}', '${username}', '${record.passwordHash}', '${record.salt}', ${record.iterations}, ${Date.now()});`,
  ].join(' ')
}

function runD1(sql, remote) {
  if (!existsSync(wranglerBin)) fail('wrangler is not installed. Run `npm install` first.')
  execFileSync(
    process.execPath,
    [wranglerBin, 'd1', 'execute', 'DB', remote ? '--remote' : '--local', '--command', sql],
    { stdio: 'inherit', cwd: root },
  )
}

function assertUsername(username) {
  if (!USERNAME_PATTERN.test(username)) {
    fail('username must be 1-64 chars of letters, digits, "_", ".", "-"')
  }
}

async function readPassword() {
  if (!process.stdin.isTTY) {
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '')
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return await rl.question('Password: ')
  } finally {
    rl.close()
  }
}

async function add(username, remote) {
  assertUsername(username)
  const password = await readPassword()
  if (!password) fail('password is empty')
  const record = await hashPassword(password)
  runD1(insertSql(username, record), remote)
}

function readAuthUsersFromDevVars() {
  const devVars = join(root, '.dev.vars')
  if (!existsSync(devVars)) return undefined
  for (const line of readFileSync(devVars, 'utf8').split(/\r?\n/)) {
    const match = /^AUTH_USERS=(.*)$/.exec(line.trim())
    if (!match) continue
    return match[1].replace(/^(['"])(.*)\1$/, '$2')
  }
  return undefined
}

async function seed(remote) {
  const raw = process.env.AUTH_USERS ?? readAuthUsersFromDevVars()
  if (!raw?.trim()) fail('AUTH_USERS not found in env or .dev.vars')
  let entries
  try {
    entries = JSON.parse(raw)
  } catch {
    fail('AUTH_USERS is not valid JSON')
  }
  if (!Array.isArray(entries)) fail('AUTH_USERS must be a JSON array')
  for (const entry of entries) {
    if (typeof entry?.username !== 'string' || typeof entry?.password !== 'string') continue
    assertUsername(entry.username)
    const record = await hashPassword(entry.password)
    runD1(insertSql(entry.username, record), remote)
    console.log(`seeded: ${entry.username}`)
  }
}

const [command, ...args] = process.argv.slice(2)
const remote = args.includes('--remote')
const positional = args.filter((arg) => !arg.startsWith('--'))

if (command === 'add' && positional[0]) {
  await add(positional[0], remote)
} else if (command === 'seed') {
  await seed(remote)
} else {
  fail(
    'usage:\n  node scripts/manage-users.mjs add <username> [--remote]\n  node scripts/manage-users.mjs seed [--remote]',
  )
}
