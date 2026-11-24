import { NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { rtdbGet, rtdbPatch } from '@/lib/firebase'
import type { EntradaRecord } from '@/lib/entradas'

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as { codigo?: string }
    const rawCode = (body.codigo || '').trim()
    if (!rawCode) {
      return NextResponse.json({ ok: false, status: 'not_found', message: 'Código vacío.' }, { status: 400 })
    }

    // Extraer ID si viene como "TLMF-<id>" o directamente "<id>"
    const candidateId = rawCode.startsWith('TLMF-') ? rawCode.slice(5).trim() : rawCode

    let entradaId: string | null = null
    let entrada: EntradaRecord | null = null

    if (candidateId && !/[.#$[\]/]/.test(candidateId)) {
      const direct = await rtdbGet<EntradaRecord>(`entrada/${candidateId}`)
      if (direct) {
        entradaId = candidateId
        entrada = direct
      }
    }

    // Fallback: buscar por campo codigoQr en todo el nodo entrada
    if (!entrada) {
      const all = await rtdbGet<Record<string, EntradaRecord>>('entrada')
      if (all) {
        const found = Object.entries(all).find(
          ([id, item]) => item?.codigoQr === rawCode || id === rawCode
        )
        if (found) {
          entradaId = found[0]
          entrada = found[1]
        }
      }
    }

    if (!entrada || !entradaId) {
      return NextResponse.json(
        { ok: false, status: 'not_found', message: 'Código QR no válido o no registrado.' },
        { status: 404 }
      )
    }

    if (entrada.escaneado) {
      return NextResponse.json({
        ok: false,
        status: 'already_scanned',
        message: 'Esta entrada ya fue escaneada · ya ingresó al evento.',
        entradaId,
        entrada,
      })
    }

    const escaneadoEn = new Date().toISOString()
    await rtdbPatch(`entrada/${entradaId}`, {
      escaneado: true,
      escaneadoEn,
    })

    return NextResponse.json({
      ok: true,
      status: 'ok',
      message: 'Acceso permitido · Entrada validada correctamente.',
      entradaId,
      entrada: { ...entrada, escaneado: true, escaneadoEn },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al escanear el código.'
    return NextResponse.json({ ok: false, status: 'error', message }, { status: 500 })
  }
}

