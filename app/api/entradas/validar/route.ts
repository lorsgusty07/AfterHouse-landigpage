import { NextResponse } from 'next/server'
import { rtdbGet } from '@/lib/firebase'
import {
  type AsistenteInput,
  type EntradaRecord,
  type PackageId,
  type PromotorRecord,
  checkBoxStock,
  findExistingDuplicates,
  findInternalDuplicates,
  findPromotorByCode,
  normalizePromoCode,
  validateAsistentesFormat,
} from '@/lib/entradas'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      tipo?: PackageId
      cantidad?: number
      codigoPromotor?: string
      asistentes?: AsistenteInput[]
    }

    const tipo = body.tipo
    const cantidad = Number(body.cantidad ?? 1)
    const rawPromo = (body.codigoPromotor || '').trim()
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

    let promotorValido: { codigo: string; nombre: string } | null = null
    if (rawPromo) {
      const cleanPromo = normalizePromoCode(rawPromo)
      const promotores = await rtdbGet<Record<string, PromotorRecord>>('promotores')
      const found = findPromotorByCode(promotores, cleanPromo)
      if (!found) {
        return NextResponse.json(
          { ok: false, error: `El código de promotor "${rawPromo}" no existe. Verifícalo o déjalo vacío.` },
          { status: 400 }
        )
      }
      promotorValido = { codigo: found.promotor.codigo, nombre: found.promotor.nombre }
    }

    const existing = await rtdbGet<Record<string, EntradaRecord>>('entrada')
    const stockError = checkBoxStock(tipo, existing)
    if (stockError) {
      return NextResponse.json({ ok: false, error: stockError }, { status: 409 })
    }

    const existingError = findExistingDuplicates(asistentes, existing)
    if (existingError) {
      return NextResponse.json({ ok: false, error: existingError }, { status: 409 })
    }

    return NextResponse.json({ ok: true, promotor: promotorValido })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al validar los datos.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

