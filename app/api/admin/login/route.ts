import { NextResponse } from 'next/server'
import {
  clearAdminSession,
  createAdminSession,
  isAdminAuthenticated,
  verifyAdminCredentials,
} from '@/lib/admin-auth'

export async function GET() {
  const authenticated = await isAdminAuthenticated()
  return NextResponse.json({ authenticated })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { usuario?: string; password?: string }
    const usuario = (body.usuario || '').trim()
    const password = body.password || ''

    if (!verifyAdminCredentials(usuario, password)) {
      return NextResponse.json({ ok: false, error: 'Usuario o contraseña incorrectos.' }, { status: 401 })
    }

    await createAdminSession()
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Error al iniciar sesión.' }, { status: 500 })
  }
}

export async function DELETE() {
  await clearAdminSession()
  return NextResponse.json({ ok: true })
}

