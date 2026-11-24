export type PackageId = 'general' | 'platinum' | 'diamond'
export type MetodoPago = 'yape' | 'plin' | 'bcp' | 'interbank'

export type AsistenteInput = {
  nombres: string
  apellidos: string
  dni: string
  telefono: string
  correo: string
}

export type EntradaRecord = {
  codigoQr: string
  escaneado: boolean
  escaneadoEn: string | null
  tipo: PackageId
  tipoNombre: string
  cantidad: number
  precioTotal: number
  metodoPago: MetodoPago
  pagoId: string
  pagador: {
    nombreTitular: string
    codigoSeguridad: string | null
  }
  asistentes: AsistenteInput[]
  creadoEn: string
  timestamp: number
}

export type PagoYapeRecord = {
  app?: string
  fecha?: string
  monto?: number
  paquete?: string
  raw?: string
  tieneMonto?: boolean
  timestamp?: number
  titulo?: string
  usado?: boolean
}

export const PACKAGES_CATALOG: Record<PackageId, { name: string; price: number; people: number; maxQty: number }> = {
  general: { name: 'Entrada General', price: 20, people: 1, maxQty: 10 },
  platinum: { name: 'Box Platinum', price: 300, people: 5, maxQty: 1 },
  diamond: { name: 'Box Diamond', price: 600, people: 10, maxQty: 1 },
}

export const PAYMENT_WINDOW_MS = 30 * 60 * 1000 // 30 minutos
export const FUTURE_SKEW_MS = 5 * 60 * 1000 // 5 minutos de margen por desfase de reloj

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '')
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function normalizeFullName(nombres: string, apellidos: string): string {
  return normalizeText(`${nombres} ${apellidos}`)
}

export function validateAsistentesFormat(
  tipo: PackageId,
  cantidad: number,
  asistentes: AsistenteInput[]
): string | null {
  const pkg = PACKAGES_CATALOG[tipo]
  if (!pkg) return 'Tipo de entrada no válido.'

  const expectedCount = tipo === 'general' ? cantidad : pkg.people
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > pkg.maxQty) {
    return `Cantidad no válida para ${pkg.name}.`
  }
  if (!Array.isArray(asistentes) || asistentes.length !== expectedCount) {
    return `Se esperaban ${expectedCount} asistente(s).`
  }

  for (let i = 0; i < asistentes.length; i++) {
    const a = asistentes[i]
    const num = String(i + 1).padStart(2, '0')
    if (!a.nombres || a.nombres.trim().length < 2) return `Asistente ${num}: ingresa los nombres.`
    if (!a.apellidos || a.apellidos.trim().length < 2) return `Asistente ${num}: ingresa los apellidos.`
    if (!/^\d{8}$/.test(a.dni)) return `Asistente ${num}: el DNI debe tener exactamente 8 dígitos.`
    if (normalizePhone(a.telefono).length < 9) return `Asistente ${num}: el teléfono debe tener al menos 9 dígitos.`
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(a.correo))) return `Asistente ${num}: el correo no es válido.`
  }

  return null
}

export function findInternalDuplicates(asistentes: AsistenteInput[]): string | null {
  const dnis = new Map<string, number>()
  const phones = new Map<string, number>()
  const emails = new Map<string, number>()
  const names = new Map<string, number>()

  for (let i = 0; i < asistentes.length; i++) {
    const a = asistentes[i]
    const num = String(i + 1).padStart(2, '0')
    const dni = a.dni.trim()
    const phone = normalizePhone(a.telefono)
    const email = normalizeEmail(a.correo)
    const fullName = normalizeFullName(a.nombres, a.apellidos)

    if (dnis.has(dni)) {
      return `El DNI ${dni} está repetido entre los asistentes ${String(dnis.get(dni)! + 1).padStart(2, '0')} y ${num}.`
    }
    dnis.set(dni, i)

    if (phones.has(phone)) {
      return `El teléfono ${a.telefono} está repetido entre los asistentes ${String(phones.get(phone)! + 1).padStart(2, '0')} y ${num}.`
    }
    phones.set(phone, i)

    if (emails.has(email)) {
      return `El correo ${a.correo} está repetido entre los asistentes ${String(emails.get(email)! + 1).padStart(2, '0')} y ${num}.`
    }
    emails.set(email, i)

    if (names.has(fullName)) {
      return `El nombre completo "${a.nombres.trim()} ${a.apellidos.trim()}" está repetido entre los asistentes ${String(names.get(fullName)! + 1).padStart(2, '0')} y ${num}.`
    }
    names.set(fullName, i)
  }

  return null
}

export function findExistingDuplicates(
  asistentes: AsistenteInput[],
  existingEntradas: Record<string, EntradaRecord> | null
): string | null {
  if (!existingEntradas) return null

  const existingDnis = new Set<string>()
  const existingPhones = new Set<string>()
  const existingEmails = new Set<string>()
  const existingNames = new Set<string>()

  for (const entrada of Object.values(existingEntradas)) {
    if (!entrada || !Array.isArray(entrada.asistentes)) continue
    for (const a of entrada.asistentes) {
      if (a.dni) existingDnis.add(String(a.dni).trim())
      if (a.telefono) existingPhones.add(normalizePhone(String(a.telefono)))
      if (a.correo) existingEmails.add(normalizeEmail(String(a.correo)))
      if (a.nombres && a.apellidos) existingNames.add(normalizeFullName(a.nombres, a.apellidos))
    }
  }

  for (let i = 0; i < asistentes.length; i++) {
    const a = asistentes[i]
    const num = String(i + 1).padStart(2, '0')
    const dni = a.dni.trim()
    const phone = normalizePhone(a.telefono)
    const email = normalizeEmail(a.correo)
    const fullName = normalizeFullName(a.nombres, a.apellidos)

    if (existingDnis.has(dni)) {
      return `Asistente ${num}: el DNI ${dni} ya cuenta con una entrada registrada.`
    }
    if (existingPhones.has(phone)) {
      return `Asistente ${num}: el número ${a.telefono} ya fue registrado en otra entrada.`
    }
    if (existingEmails.has(email)) {
      return `Asistente ${num}: el correo ${a.correo} ya fue registrado en otra entrada.`
    }
    if (existingNames.has(fullName)) {
      return `Asistente ${num}: "${a.nombres.trim()} ${a.apellidos.trim()}" ya cuenta con una entrada registrada.`
    }
  }

  return null
}

function getPagoTimestamp(pago: PagoYapeRecord): number | null {
  if (typeof pago.timestamp === 'number' && Number.isFinite(pago.timestamp)) {
    return pago.timestamp
  }
  if (pago.fecha) {
    const parsed = Date.parse(pago.fecha)
    if (!Number.isNaN(parsed)) return parsed
  }
  return null
}

function extractSecurityCode(raw: string): string | null {
  const normalized = normalizeText(raw)
  const match = normalized.match(/seguridad\s*(?:es)?\s*:?\s*(\d{3})/)
  return match ? match[1] : null
}

function matchesTitularInRaw(nombreTitular: string, raw: string): boolean {
  const userWords = normalizeText(nombreTitular)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2)

  if (userWords.length === 0) return false

  // Extrae tokens de raw preservando asteriscos (ej. "cca*")
  const rawTokens = normalizeText(raw)
    .replace(/[^a-z0-9*\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  const exactTokens = new Set(rawTokens.filter(t => !t.includes('*')))
  const prefixTokens = rawTokens
    .filter(t => t.endsWith('*'))
    .map(t => t.replace(/\*+$/, ''))
    .filter(p => p.length >= 2)

  const matchesWord = (word: string) =>
    exactTokens.has(word) || prefixTokens.some(prefix => word.startsWith(prefix))

  if (userWords.length === 1) {
    return matchesWord(userWords[0])
  }

  // Coincide si al menos 2 palabras del titular hacen match (ej. nombre + apellido o apellido enmascarado con *),
  // o si coincide el primer nombre y alguna palabra del apellido
  const matchedCount = userWords.filter(matchesWord).length
  return matchedCount >= 2
}

export function findMatchingYapePago(
  pagos: Record<string, PagoYapeRecord> | null,
  params: {
    precioTotal: number
    nombreTitular: string
    codigoSeguridad?: string | null
    now?: number
  }
): { pagoId: string; pago: PagoYapeRecord } | null {
  if (!pagos) return null
  const now = params.now ?? Date.now()
  const cleanCode = params.codigoSeguridad?.replace(/\D/g, '') || null

  // Ordenar del más reciente al más antiguo
  const candidates = Object.entries(pagos)
    .map(([pagoId, pago]) => ({ pagoId, pago, ts: getPagoTimestamp(pago) }))
    .filter((item): item is { pagoId: string; pago: PagoYapeRecord; ts: number } => item.ts !== null)
    .sort((a, b) => b.ts - a.ts)

  for (const { pagoId, pago, ts } of candidates) {
    if (pago.usado === true) continue
    if (pago.tieneMonto === false) continue
    if (typeof pago.monto !== 'number' || Math.abs(pago.monto - params.precioTotal) > 0.01) continue

    // Ventana de tiempo
    const age = now - ts
    if (age > PAYMENT_WINDOW_MS || age < -FUTURE_SKEW_MS) continue

    const raw = pago.raw || ''
    if (!raw) continue

    // Si el usuario ingresó código de seguridad (3 dígitos) y el raw tiene código de seguridad, deben coincidir
    if (cleanCode) {
      const rawCode = extractSecurityCode(raw)
      if (rawCode && rawCode !== cleanCode) continue
      if (!rawCode && !raw.includes(cleanCode)) continue
    }

    if (!matchesTitularInRaw(params.nombreTitular, raw)) continue

    return { pagoId, pago }
  }

  return null
}

