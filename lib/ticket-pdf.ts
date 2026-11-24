import type { AsistenteInput, PackageId } from '@/lib/entradas'

export type TicketPdfData = {
  codigoQr: string
  qrDataUrl: string
  tipo: PackageId
  tipoNombre: string
  cantidadEntradas: number
  totalPersonas: number
  precioTotal: number
  nombreTitular: string
  asistentes: AsistenteInput[]
}

export async function downloadTicketPdf(data: TicketPdfData): Promise<void> {
  const { jsPDF } = await import('jspdf')

  const rows = Math.ceil(data.asistentes.length / 2)
  const width = 210
  const height = Math.max(122, 92 + rows * 9.5)

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [width, height],
  })

  // Fondo exterior oscuro
  doc.setFillColor(19, 13, 26) // #130d1a
  doc.rect(0, 0, width, height, 'F')

  // Margen de la entrada
  const m = 6
  const cardX = m
  const cardY = m
  const cardW = width - m * 2
  const cardH = height - m * 2
  const stubX = 144

  // Cuerpo principal de la entrada
  doc.setFillColor(27, 20, 34) // #1b1422
  doc.roundedRect(cardX, cardY, cardW, cardH, 5, 5, 'F')

  // Fondo del talón derecho (stub del QR)
  doc.setFillColor(38, 20, 58) // #26143a
  doc.roundedRect(stubX, cardY, cardX + cardW - stubX, cardH, 5, 5, 'F')
  // Rellena las esquinas izquierdas del talón para que queden rectas en la perforación
  doc.rect(stubX, cardY, 5, cardH, 'F')

  // Borde exterior lila sutil
  doc.setDrawColor(125, 36, 216) // #7d24d8
  doc.setLineWidth(0.55)
  doc.roundedRect(cardX, cardY, cardW, cardH, 5, 5, 'S')

  // Franja morada superior izquierda
  doc.setFillColor(125, 36, 216)
  doc.roundedRect(cardX + 0.3, cardY + 0.3, stubX - cardX - 0.3, 3.2, 2, 2, 'F')
  doc.rect(cardX + 0.3, cardY + 2, stubX - cardX - 0.3, 1.5, 'F')

  // Línea perforada vertical + muescas de ticket
  doc.setDrawColor(168, 90, 238)
  doc.setLineWidth(0.45)
  doc.setLineDashPattern([2.2, 2.2], 0)
  doc.line(stubX, cardY + 5, stubX, cardY + cardH - 5)
  doc.setLineDashPattern([], 0)

  // Muescas semicirculares superior e inferior
  doc.setFillColor(19, 13, 26)
  doc.circle(stubX, cardY, 4.2, 'F')
  doc.circle(stubX, cardY + cardH, 4.2, 'F')

  // ───────── SECCIÓN IZQUIERDA (DETALLES) ─────────
  const leftX = cardX + 9

  // Monograma AH + Eyebrow
  doc.setFillColor(125, 36, 216)
  doc.roundedRect(leftX, cardY + 8, 9.5, 9.5, 1.5, 1.5, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('AH', leftX + 4.75, cardY + 14.1, { align: 'center' })

  doc.setTextColor(196, 132, 241) // #c484f1
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text('AFTER HOURS PRESENTA  ·  ENTRADA OFICIAL', leftX + 12.5, cardY + 11.6)

  doc.setTextColor(169, 157, 176)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Sábado 28 de Noviembre  ·  9:00 PM  ·  Hacienda Nápoles, Socabaya', leftX + 12.5, cardY + 16.1)

  // Título del evento
  doc.setTextColor(248, 245, 251)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('THE LAST MINI FIGHT PARTY', leftX, cardY + 28.5)

  // Franja de resumen de tipo + monto
  const pillY = cardY + 33
  const pillW = stubX - leftX - 7
  doc.setFillColor(42, 24, 62)
  doc.setDrawColor(110, 62, 160)
  doc.setLineWidth(0.35)
  doc.roundedRect(leftX, pillY, pillW, 16.5, 2.5, 2.5, 'FD')

  const cantidadLabel =
    data.tipo === 'general'
      ? `${data.cantidadEntradas} ${data.cantidadEntradas === 1 ? 'Entrada' : 'Entradas'}`
      : `${data.tipoNombre} (${data.totalPersonas} pers.)`

  doc.setTextColor(196, 132, 241)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('TIPO DE ENTRADA', leftX + 4, pillY + 5.2)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  doc.text(data.tipoNombre.toUpperCase(), leftX + 4, pillY + 12.2)

  doc.setTextColor(196, 132, 241)
  doc.setFontSize(7)
  doc.text('CANTIDAD / AFORO', leftX + 54, pillY + 5.2)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10.5)
  doc.text(cantidadLabel, leftX + 54, pillY + 12.2)

  doc.setTextColor(196, 132, 241)
  doc.setFontSize(7)
  doc.text('TOTAL PAGADO', leftX + pillW - 4, pillY + 5.2, { align: 'right' })
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.text(`S/. ${data.precioTotal}`, leftX + pillW - 4, pillY + 12.2, { align: 'right' })

  // Comprador / Titular del pago
  const buyerY = pillY + 23
  doc.setTextColor(169, 157, 176)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('COMPRADO POR (TITULAR DEL PAGO)', leftX, buyerY)
  doc.setTextColor(248, 245, 251)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.text(`${data.nombreTitular}  ·  Yape verificado`, leftX, buyerY + 5.2)

  // Línea separadora sutil
  doc.setDrawColor(62, 49, 72)
  doc.setLineWidth(0.25)
  doc.line(leftX, buyerY + 8.5, stubX - 7, buyerY + 8.5)

  // Lista de asistentes en 2 columnas
  const listTitleY = buyerY + 13.5
  doc.setTextColor(196, 132, 241)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.2)
  doc.text(`ASISTENTES REGISTRADOS (${data.asistentes.length})`, leftX, listTitleY)

  const colW = (stubX - leftX - 10) / 2
  data.asistentes.forEach((a, idx) => {
    const col = idx % 2
    const row = Math.floor(idx / 2)
    const x = leftX + col * (colW + 4)
    const y = listTitleY + 5.8 + row * 9.2

    const fullName = `${a.nombres} ${a.apellidos}`.trim()
    const clippedName = fullName.length > 26 ? `${fullName.slice(0, 25)}…` : fullName

    doc.setTextColor(248, 245, 251)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.2)
    doc.text(`${String(idx + 1).padStart(2, '0')}. ${clippedName}`, x, y)

    doc.setTextColor(169, 157, 176)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(`DNI ${a.dni}`, x + 5.5, y + 3.6)
  })

  // ───────── SECCIÓN DERECHA (TALÓN QR) ─────────
  const stubCenterX = stubX + (cardX + cardW - stubX) / 2

  doc.setTextColor(233, 201, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('PASE DE INGRESO', stubCenterX, cardY + 13, { align: 'center' })

  // Tarjeta blanca para el QR
  const qrSize = 44
  const qrBoxSize = 50
  const qrBoxX = stubCenterX - qrBoxSize / 2
  const qrBoxY = cardY + 17.5

  doc.setFillColor(255, 255, 255)
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 3.5, 3.5, 'F')
  doc.addImage(data.qrDataUrl, 'PNG', qrBoxX + 3, qrBoxY + 3, qrSize, qrSize)

  // Código único debajo del QR
  doc.setTextColor(196, 132, 241)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.text('CÓDIGO ÚNICO', stubCenterX, qrBoxY + qrBoxSize + 6.5, { align: 'center' })

  doc.setTextColor(255, 255, 255)
  doc.setFont('courier', 'bold')
  doc.setFontSize(7.2)
  doc.text(data.codigoQr, stubCenterX, qrBoxY + qrBoxSize + 11.2, { align: 'center', maxWidth: 52 })

  // Etiqueta de personas permitidas
  const admitY = cardY + cardH - 17
  doc.setFillColor(125, 36, 216)
  doc.roundedRect(stubCenterX - 24, admitY, 48, 8.5, 4, 4, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(
    `ADMITE ${data.totalPersonas} ${data.totalPersonas === 1 ? 'PERSONA' : 'PERSONAS'}`,
    stubCenterX,
    admitY + 5.6,
    { align: 'center' }
  )

  doc.setTextColor(182, 168, 196)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.2)
  doc.text('VÁLIDO PARA UN SOLO INGRESO', stubCenterX, cardY + cardH - 4.5, { align: 'center' })

  doc.save(`entrada-${data.codigoQr}.pdf`)
}

