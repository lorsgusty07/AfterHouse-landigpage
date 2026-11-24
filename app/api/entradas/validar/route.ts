import { NextResponse } from 'next/server'
import { rtdbGet } from '@/lib/firebase'
import {
  type AsistenteInput,
  type EntradaRecord,
  type PackageId,
  findExistingDuplicates,
  findInternalDuplicates,
  validateAsistentesFormat,
} from '@/lib/entradas'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      tipo?: PackageId
      cantidad?: number
      asistentes?: AsistenteInput[]
    }

    const tipo = body.tipo
    const cantidad = Number(body.cantidad ?? 1)
    const asistentes = body.asistentes ?? []

    if (!tipo) {
      return NextResponse.json({ ok: false, error: 'Falta el tipo de entrada.' }, { status: 400 })
    }

    const formatError = validateAsistentesFormat(tipo, cantidad, asistentes)
    if (formatError) {
      return NextResponse.json({ ok: false, error: formatError }, { status: 400 })
    }

    const internalError = findInternalDuplicates(asistentes)
    if (internalError) {
      return NextResponse.json({ ok: false, error: internalError }, { status: 400 })
    }

    const existing = await rtdbGet<Record<string, EntradaRecord>>('entrada')
    const existingError = findExistingDuplicates(asistentes, existing)
    if (existingError) {
      return NextResponse.json({ ok: false, error: existingError }, { status: 409 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al validar los datos.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

