import { NextResponse } from 'next/server'
import { rtdbGet, rtdbPatch, rtdbPost } from '@/lib/firebase'
import {
  type AsistenteInput,
  type EntradaRecord,
  type MetodoPago,
  PACKAGES_CATALOG,
  type PackageId,
  type PagoYapeRecord,
  checkBoxStock,
  findExistingDuplicates,
  findInternalDuplicates,
  findMatchingYapePago,
  validateAsistentesFormat,
} from '@/lib/entradas'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      tipo?: PackageId
      cantidad?: number
      metodoPago?: MetodoPago
      nombreTitular?: string
      codigoSeguridad?: string
      asistentes?: AsistenteInput[]
    }

    const tipo = body.tipo
    const cantidad = Number(body.cantidad ?? 1)
    const metodoPago: MetodoPago = body.metodoPago || 'yape'
    const nombreTitular = (body.nombreTitular || '').trim()
    const codigoSeguridad = (body.codigoSeguridad || '').replace(/\D/g, '').slice(0, 3) || null
    const asistentes = body.asistentes ?? []

    if (!tipo || !PACKAGES_CATALOG[tipo]) {
      return NextResponse.json({ ok: false, error: 'Tipo de entrada no válido.' }, { status: 400 })
    }
    if (metodoPago !== 'yape') {
      return NextResponse.json({ ok: false, error: 'Por el momento solo está habilitado el pago con Yape.' }, { status: 400 })
    }
    if (nombreTitular.length < 3) {
      return NextResponse.json({ ok: false, error: 'Ingresa el nombre y apellido del titular que realiza el pago.' }, { status: 400 })
    }

    const formatError = validateAsistentesFormat(tipo, cantidad, asistentes)
    if (formatError) {
      return NextResponse.json({ ok: false, error: formatError }, { status: 400 })
    }

    const internalError = findInternalDuplicates(asistentes)
    if (internalError) {
      return NextResponse.json({ ok: false, error: internalError }, { status: 400 })
    }

    // Revalidar stock de boxes y duplicados en Firebase antes de consumir el pago
    const existingEntradas = await rtdbGet<Record<string, EntradaRecord>>('entrada')
    const stockError = checkBoxStock(tipo, existingEntradas)
    if (stockError) {
      return NextResponse.json({ ok: false, error: stockError }, { status: 409 })
    }

    const existingError = findExistingDuplicates(asistentes, existingEntradas)
    if (existingError) {
      return NextResponse.json({ ok: false, error: existingError }, { status: 409 })
    }

    const pkg = PACKAGES_CATALOG[tipo]
    const precioTotal = pkg.price * (tipo === 'general' ? cantidad : 1)

    const pagos = await rtdbGet<Record<string, PagoYapeRecord>>('pagos_yape')
    const match = findMatchingYapePago(pagos, {
      precioTotal,
      nombreTitular,
      codigoSeguridad,
    })

    if (!match) {
      return NextResponse.json(
        {
          ok: false,
          pending: true,
          error: 'Aún no encontramos tu pago. Verifica el monto exacto y el nombre del titular e intenta nuevamente.',
        },
        { status: 404 }
      )
    }

    // Doble chequeo rápido para evitar que el mismo pago se use dos veces
    const freshPago = await rtdbGet<PagoYapeRecord>(`pagos_yape/${match.pagoId}`)
    if (!freshPago || freshPago.usado === true) {
      return NextResponse.json(
        { ok: false, pending: true, error: 'Ese pago ya fue utilizado. Intenta nuevamente.' },
        { status: 409 }
      )
    }

    // Marcar pago como usado antes de crear la entrada
    await rtdbPatch(`pagos_yape/${match.pagoId}`, { usado: true })

    const now = Date.now()
    const cleanAsistentes: AsistenteInput[] = asistentes.map(a => ({
      nombres: a.nombres.trim(),
      apellidos: a.apellidos.trim(),
      dni: a.dni.trim(),
      telefono: a.telefono.trim(),
      correo: a.correo.trim().toLowerCase(),
    }))

    const draftEntrada: EntradaRecord = {
      codigoQr: '',
      escaneado: false,
      escaneadoEn: null,
      tipo,
      tipoNombre: pkg.name,
      cantidad: tipo === 'general' ? cantidad : 1,
      precioTotal,
      metodoPago,
      pagoId: match.pagoId,
      pagador: {
        nombreTitular,
        codigoSeguridad,
      },
      asistentes: cleanAsistentes,
      creadoEn: new Date(now).toISOString(),
      timestamp: now,
    }

    const { name: entradaId } = await rtdbPost('entrada', draftEntrada)
    const codigoQr = `TLMF-${entradaId}`
    await rtdbPatch(`entrada/${entradaId}`, { codigoQr })

    return NextResponse.json({
      ok: true,
      entradaId,
      codigoQr,
      entrada: { ...draftEntrada, codigoQr },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al verificar el pago.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

