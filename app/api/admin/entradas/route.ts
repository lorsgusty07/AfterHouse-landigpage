import { NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { rtdbGet } from '@/lib/firebase'
import type { EntradaRecord } from '@/lib/entradas'

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 })
  }

  try {
    const raw = await rtdbGet<Record<string, EntradaRecord>>('entrada')
    const items = raw
      ? Object.entries(raw)
          .map(([id, data]) => ({ id, ...data }))
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      : []

    let totalVendido = 0
    let totalEntradas = 0
    let totalAsistentes = 0
    let entradasEscaneadas = 0
    let asistentesEscaneados = 0
    const porTipo = { general: 0, platinum: 0, diamond: 0 }

    for (const item of items) {
      totalVendido += Number(item.precioTotal || 0)
      totalEntradas += Number(item.cantidad || 1)
      const countAsistentes = Array.isArray(item.asistentes) ? item.asistentes.length : 0
      totalAsistentes += countAsistentes
      if (item.escaneado) {
        entradasEscaneadas += 1
        asistentesEscaneados += countAsistentes
      }
      if (item.tipo === 'general') porTipo.general += Number(item.cantidad || 1)
      else if (item.tipo === 'platinum') porTipo.platinum += 1
      else if (item.tipo === 'diamond') porTipo.diamond += 1
    }

    return NextResponse.json({
      ok: true,
      stats: {
        totalCompras: items.length,
        totalEntradas,
        totalVendido,
        totalAsistentes,
        entradasEscaneadas,
        asistentesEscaneados,
        porTipo,
      },
      entradas: items,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al cargar entradas.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

