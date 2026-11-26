import { NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { rtdbDelete, rtdbGet, rtdbPost } from '@/lib/firebase'
import {
  type EntradaRecord,
  type PromotorRecord,
  generatePromoCode,
  normalizePromoCode,
} from '@/lib/entradas'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 })
  }

  try {
    const [rawPromotores, rawEntradas] = await Promise.all([
      rtdbGet<Record<string, PromotorRecord>>('promotores'),
      rtdbGet<Record<string, EntradaRecord>>('entrada'),
    ])

    const statsByCode = new Map<
      string,
      {
        compras: number
        entradas: number
        asistentes: number
        totalVendido: number
        porTipo: { general: number; platinum: number; diamond: number }
      }
    >()

    if (rawEntradas) {
      for (const item of Object.values(rawEntradas)) {
        if (!item || !item.codigoPromotor) continue
        const code = normalizePromoCode(item.codigoPromotor)
        if (!code) continue

        const current = statsByCode.get(code) ?? {
          compras: 0,
          entradas: 0,
          asistentes: 0,
          totalVendido: 0,
          porTipo: { general: 0, platinum: 0, diamond: 0 },
        }

        current.compras += 1
        current.entradas += Number(item.cantidad || 1)
        current.asistentes += Array.isArray(item.asistentes) ? item.asistentes.length : 0
        current.totalVendido += Number(item.precioTotal || 0)
        if (item.tipo === 'general') current.porTipo.general += Number(item.cantidad || 1)
        else if (item.tipo === 'platinum') current.porTipo.platinum += 1
        else if (item.tipo === 'diamond') current.porTipo.diamond += 1

        statsByCode.set(code, current)
      }
    }

    const promotores = rawPromotores
      ? Object.entries(rawPromotores)
          .map(([id, data]) => {
            const code = normalizePromoCode(data.codigo)
            const stats = statsByCode.get(code) ?? {
              compras: 0,
              entradas: 0,
              asistentes: 0,
              totalVendido: 0,
              porTipo: { general: 0, platinum: 0, diamond: 0 },
            }
            return { id, ...data, stats }
          })
          .sort((a, b) => b.stats.entradas - a.stats.entradas || (b.timestamp || 0) - (a.timestamp || 0))
      : []

    return NextResponse.json({ ok: true, promotores })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al cargar promotores.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as { nombre?: string; codigo?: string }
    const nombre = (body.nombre || '').trim()
    if (nombre.length < 2) {
      return NextResponse.json({ ok: false, error: 'Ingresa el nombre del promotor (mínimo 2 caracteres).' }, { status: 400 })
    }

    const existing = await rtdbGet<Record<string, PromotorRecord>>('promotores')
    const existingCodes = new Set<string>()
    if (existing) {
      for (const p of Object.values(existing)) {
        if (p?.codigo) existingCodes.add(normalizePromoCode(p.codigo))
      }
    }

    let codigo = body.codigo ? normalizePromoCode(body.codigo) : ''
    if (codigo) {
      if (codigo.length < 3 || codigo.length > 20) {
        return NextResponse.json({ ok: false, error: 'El código debe tener entre 3 y 20 caracteres (letras o números).' }, { status: 400 })
      }
      if (existingCodes.has(codigo)) {
        return NextResponse.json({ ok: false, error: `El código "${codigo}" ya existe.` }, { status: 409 })
      }
    } else {
      codigo = generatePromoCode(nombre, existingCodes)
    }

    const now = Date.now()
    const record: PromotorRecord = {
      nombre,
      codigo,
      creadoEn: new Date(now).toISOString(),
      timestamp: now,
    }

    const { name: id } = await rtdbPost('promotores', record)
    return NextResponse.json({ ok: true, id, promotor: record })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al crear promotor.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = (searchParams.get('id') || '').trim()
    if (!id || /[.#$[\]/]/.test(id)) {
      return NextResponse.json({ ok: false, error: 'ID de promotor no válido.' }, { status: 400 })
    }

    await rtdbDelete(`promotores/${id}`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al eliminar promotor.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

