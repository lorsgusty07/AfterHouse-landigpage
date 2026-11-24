import { NextResponse } from 'next/server'
import { rtdbGet } from '@/lib/firebase'
import { type EntradaRecord, getBoxAvailability } from '@/lib/entradas'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const existing = await rtdbGet<Record<string, EntradaRecord>>('entrada')
    const disponibilidad = getBoxAvailability(existing)
    return NextResponse.json({ ok: true, disponibilidad })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al consultar disponibilidad.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

