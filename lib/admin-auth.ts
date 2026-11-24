import crypto from 'node:crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'ah_admin_session'

function getSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || 'afterhours-party-session-secret-2026'
}

export function verifyAdminCredentials(user: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USER || 'admin'
  const expectedPass = process.env.ADMIN_PASSWORD || 'afterHouse123.'
  return user === expectedUser && password === expectedPass
}

function signToken(payload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
}

export async function createAdminSession(): Promise<void> {
  const issuedAt = String(Date.now())
  const signature = signToken(`admin:${issuedAt}`)
  const value = `${issuedAt}.${signature}`
  const store = await cookies()
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12, // 12 horas
  })
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies()
  const value = store.get(COOKIE_NAME)?.value
  if (!value) return false
  const [issuedAt, signature] = value.split('.')
  if (!issuedAt || !signature) return false
  const expected = signToken(`admin:${issuedAt}`)
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

