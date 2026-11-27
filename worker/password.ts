/** PBKDF2 parameters. Keep in sync with scripts/manage-users.mjs. */
export const PASSWORD_ITERATIONS = 100_000
const HASH_BYTES = 32
const SALT_BYTES = 16

export type PasswordRecord = {
  passwordHash: string
  salt: string
  iterations: number
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    HASH_BYTES * 8,
  )
  return new Uint8Array(bits)
}

export async function hashPassword(password: string): Promise<PasswordRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derive(password, salt, PASSWORD_ITERATIONS)
  return {
    passwordHash: toBase64(hash),
    salt: toBase64(salt),
    iterations: PASSWORD_ITERATIONS,
  }
}

export async function verifyPassword(
  password: string,
  record: PasswordRecord,
): Promise<boolean> {
  const salt = fromBase64(record.salt)
  const expected = fromBase64(record.passwordHash)
  if (!salt || !expected || expected.length !== HASH_BYTES) return false
  const actual = await derive(password, salt, record.iterations)
  let mismatch = 0
  for (let i = 0; i < HASH_BYTES; i++) mismatch |= actual[i]! ^ expected[i]!
  return mismatch === 0
}
