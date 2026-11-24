'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Crown,
  Download,
  FileDown,
  Gem,
  Loader2,
  MapPin,
  Menu,
  Minus,
  Plus,
  RefreshCw,
  Smartphone,
  Ticket,
  X,
} from 'lucide-react'
import {
  type AsistenteInput,
  type BoxAvailability,
  type PackageId,
  findInternalDuplicates,
} from '@/lib/entradas'
import { downloadTicketPdf } from '@/lib/ticket-pdf'

type Package = {
  id: PackageId
  name: string
  title: [string, string]
  kind: string
  price: number
  people: number
  description: string
  perks: string[]
  featured?: boolean
}
type Attendee = { firstName: string; lastName: string; dni: string; phone: string; email: string }
type ModalStep = 'attendees' | 'payment' | 'confirmed'

const GENERAL_MAX = 10
const PAYMENT_PHONE = '915 989 987'
const PAYMENT_PHONE_RAW = '915989987'

const packages: Package[] = [
  { id: 'general', name: 'Entrada General', title: ['Entrada', 'General'], kind: 'Individual', price: 20, people: 1, description: 'Preventa · Elige cuántas entradas quieres.', perks: ['Acceso al evento', 'DJ en vivo toda la noche', 'Una noche para recordar'] },
  { id: 'platinum', name: 'Box Platinum', title: ['Box', 'Platinum'], kind: 'Experiencia', price: 300, people: 5, description: 'Un espacio para vivir la noche juntos.', perks: ['5 entradas', '1 botella de 750 ml a elegir', 'Jägermeister / Bacardi / Smirnoff'], featured: true },
  { id: 'diamond', name: 'Box Diamond', title: ['Box', 'Diamond'], kind: 'Experiencia', price: 600, people: 10, description: 'La experiencia definitiva. Sin límites.', perks: ['10 entradas', '1 botella premium a elegir', 'JW Double Black / Chivas Regal Extra / Flor de Caña Centenario'] },
]

const packageIcons: Record<PackageId, typeof Ticket> = { general: Ticket, platinum: Crown, diamond: Gem }

const drinks = [
  { name: 'Jägermeister', bottle: 'Botella 700 ml', mixer: 'Jugo Gloria', price: 170, image: '/jagger.png' },
  { name: 'Vodka Smirnoff', bottle: 'Botella 700 ml', mixer: 'Gaseosa', price: 160, image: '/vodka.png' },
  { name: 'Ron Bacardi', bottle: 'Botella 700 ml', mixer: 'Coca-Cola', price: 160, image: '/bacardi.png' },
]

const tickerItems = ['Boxeo en vivo', 'DJ toda la noche', 'Bar premium', 'Boxes VIP', 'Sábado 28 · Noviembre', 'Hacienda Nápoles', 'Corcho libre 9–10 PM']

const attendeeFields: { key: keyof Attendee; label: string; type: string; placeholder: string; hint: string; maxLength: number; inputMode?: 'numeric' | 'tel' | 'email'; autoComplete: string }[] = [
  { key: 'firstName', label: 'Nombres', type: 'text', placeholder: 'Nombres', hint: 'Ingresa los nombres', maxLength: 80, autoComplete: 'given-name' },
  { key: 'lastName', label: 'Apellidos', type: 'text', placeholder: 'Apellidos', hint: 'Ingresa los apellidos', maxLength: 80, autoComplete: 'family-name' },
  { key: 'dni', label: 'DNI', type: 'text', placeholder: '8 dígitos', hint: 'El DNI debe tener 8 dígitos', maxLength: 8, inputMode: 'numeric', autoComplete: 'off' },
  { key: 'phone', label: 'Número de teléfono', type: 'tel', placeholder: '999 999 999', hint: 'Mínimo 9 dígitos', maxLength: 15, inputMode: 'tel', autoComplete: 'tel' },
  { key: 'email', label: 'Correo electrónico', type: 'email', placeholder: 'correo@ejemplo.com', hint: 'Correo no válido', maxLength: 120, inputMode: 'email', autoComplete: 'email' },
]

const validators: Record<keyof Attendee, (value: string) => boolean> = {
  firstName: value => value.trim().length >= 2,
  lastName: value => value.trim().length >= 2,
  dni: value => /^\d{8}$/.test(value),
  phone: value => value.replace(/\D/g, '').length >= 9,
  email: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()),
}

const emptyAttendee = (): Attendee => ({ firstName: '', lastName: '', dni: '', phone: '', email: '' })
const isComplete = (attendee: Attendee) => attendeeFields.every(field => validators[field.key](attendee[field.key]))
const pad = (value: number) => String(value).padStart(2, '0')
const toApiAsistentes = (list: Attendee[]): AsistenteInput[] =>
  list.map(a => ({
    nombres: a.firstName.trim(),
    apellidos: a.lastName.trim(),
    dni: a.dni.trim(),
    telefono: a.phone.trim(),
    correo: a.email.trim().toLowerCase(),
  }))

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow"><span />{children}</p>
}

function AttendeeFields({ attendee, showErrors, onChange }: { attendee: Attendee; showErrors: boolean; onChange: (key: keyof Attendee, value: string) => void }) {
  return (
    <div className="form-grid">
      {attendeeFields.map(field => {
        const invalid = showErrors && !validators[field.key](attendee[field.key])
        return (
          <label className={`form-field ${field.key === 'email' ? 'form-field-wide' : ''}`} key={field.key}>
            <span>{field.label}</span>
            <input
              className={invalid ? 'is-invalid' : undefined}
              aria-invalid={invalid}
              type={field.type}
              value={attendee[field.key]}
              placeholder={field.placeholder}
              maxLength={field.maxLength}
              inputMode={field.inputMode}
              autoComplete={field.autoComplete}
              onChange={event => onChange(field.key, event.target.value)}
            />
            {invalid && <small className="field-hint">{field.hint}</small>}
          </label>
        )
      })}
    </div>
  )
}

function PurchaseModal({ selected, onClose, onConfirmed }: { selected: Package; onClose: () => void; onConfirmed: () => void }) {
  const isGeneral = selected.id === 'general'
  const [step, setStep] = useState<ModalStep>('attendees')
  const [quantity, setQuantity] = useState(1)
  const [attendees, setAttendees] = useState<Attendee[]>(() => Array.from({ length: selected.people }, emptyAttendee))
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const [revealed, setRevealed] = useState<number[]>([])
  const [error, setError] = useState('')
  const [validating, setValidating] = useState(false)

  // Paso de pago
  const [nombreTitular, setNombreTitular] = useState('')
  const [codigoSeguridad, setCodigoSeguridad] = useState('')
  const [copiedPhone, setCopiedPhone] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [notFoundNotice, setNotFoundNotice] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const cancelVerifyRef = useRef(false)

  // Confirmación
  const [codigoQr, setCodigoQr] = useState('')
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const qrWrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !verifying) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelVerifyRef.current = true
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, verifying])

  const multi = attendees.length > 1
  const completeCount = attendees.filter(isComplete).length
  const total = selected.price * (isGeneral ? quantity : 1)
  const summary = isGeneral ? `${quantity}x Entrada General` : `${selected.name} · ${selected.people} personas`

  const changeQuantity = (next: number) => {
    const value = Math.min(GENERAL_MAX, Math.max(1, next))
    setQuantity(value)
    setAttendees(current => value > current.length ? [...current, ...Array.from({ length: value - current.length }, emptyAttendee)] : current.slice(0, value))
    setRevealed(current => current.filter(index => index < value))
    setOpenIndex(current => (current !== null && current >= value ? value - 1 : current))
    setError('')
  }

  const updateAttendee = (index: number, key: keyof Attendee, value: string) => {
    const clean = key === 'dni' ? value.replace(/\D/g, '').slice(0, 8) : value
    setAttendees(current => current.map((person, personIndex) => (personIndex === index ? { ...person, [key]: clean } : person)))
  }

  const reveal = (index: number) => setRevealed(current => (current.includes(index) ? current : [...current, index]))

  const goNext = (index: number) => {
    if (!isComplete(attendees[index])) { reveal(index); return }
    setOpenIndex(index + 1 < attendees.length ? index + 1 : null)
  }

  const handleAttendeesSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const firstInvalid = attendees.findIndex(person => !isComplete(person))
    if (firstInvalid !== -1) {
      setRevealed(attendees.map((_, index) => index))
      setOpenIndex(firstInvalid)
      setError(multi ? `Faltan datos del asistente ${pad(firstInvalid + 1)}. Revisa los campos marcados.` : 'Revisa los campos marcados.')
      return
    }

    const apiAsistentes = toApiAsistentes(attendees)
    const internalDup = findInternalDuplicates(apiAsistentes)
    if (internalDup) {
      setError(internalDup)
      return
    }

    setError('')
    setValidating(true)
    try {
      const res = await fetch('/api/entradas/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: selected.id,
          cantidad: isGeneral ? quantity : 1,
          asistentes: apiAsistentes,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error || 'No se pudieron validar los asistentes.')
        return
      }
      if (!nombreTitular.trim()) {
        setNombreTitular(`${attendees[0].firstName.trim()} ${attendees[0].lastName.trim()}`)
      }
      setStep('payment')
    } catch {
      setError('Error de conexión al validar los datos. Intenta de nuevo.')
    } finally {
      setValidating(false)
    }
  }

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(PAYMENT_PHONE_RAW)
      setCopiedPhone(true)
      setTimeout(() => setCopiedPhone(false), 2000)
    } catch {
      // Fallback silencioso
    }
  }

  const handleVerifyPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const titular = nombreTitular.trim()
    if (titular.length < 3) {
      setError('Ingresa el nombre y apellido del titular que realizó el Yape.')
      return
    }
    const cleanCode = codigoSeguridad.replace(/\D/g, '')
    if (cleanCode && cleanCode.length !== 3) {
      setError('El código de seguridad debe tener 3 dígitos (o déjalo vacío si pagaste desde Plin).')
      return
    }

    setError('')
    setNotFoundNotice(false)
    setVerifying(true)
    cancelVerifyRef.current = false

    const maxAttempts = 10
    const apiAsistentes = toApiAsistentes(attendees)

    for (let i = 1; i <= maxAttempts; i++) {
      if (cancelVerifyRef.current) break
      setAttempt(i)
      try {
        const res = await fetch('/api/entradas/verificar-pago', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: selected.id,
            cantidad: isGeneral ? quantity : 1,
            metodoPago: 'yape',
            nombreTitular: titular,
            codigoSeguridad: cleanCode || null,
            asistentes: apiAsistentes,
          }),
        })
        const data = (await res.json()) as { ok?: boolean; pending?: boolean; codigoQr?: string; error?: string }
        if (res.ok && data.ok && data.codigoQr) {
          setCodigoQr(data.codigoQr)
          setStep('confirmed')
          setVerifying(false)
          onConfirmed()
          return
        }
        // Si es error definitivo (duplicado, validación, servidor), detener polling
        if (!data.pending) {
          setError(data.error || 'No se pudo completar la verificación.')
          setVerifying(false)
          return
        }
      } catch {
        setError('Error de red al verificar el pago. Intenta nuevamente.')
        setVerifying(false)
        return
      }

      if (i < maxAttempts && !cancelVerifyRef.current) {
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    }

    if (!cancelVerifyRef.current) {
      setNotFoundNotice(true)
    }
    setVerifying(false)
  }

  const downloadQr = () => {
    const canvas = qrWrapperRef.current?.querySelector('canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = url
    link.download = `qr-${codigoQr || 'after-hours'}.png`
    link.click()
  }

  const handleDownloadPdf = async () => {
    const canvas = qrWrapperRef.current?.querySelector('canvas')
    if (!canvas || !codigoQr) return
    setDownloadingPdf(true)
    try {
      const qrDataUrl = canvas.toDataURL('image/png')
      await downloadTicketPdf({
        codigoQr,
        qrDataUrl,
        tipo: selected.id,
        tipoNombre: selected.name,
        cantidadEntradas: isGeneral ? quantity : 1,
        totalPersonas: attendees.length,
        precioTotal: total,
        nombreTitular: nombreTitular.trim() || `${attendees[0].firstName.trim()} ${attendees[0].lastName.trim()}`,
        asistentes: toApiAsistentes(attendees),
      })
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !verifying) onClose() }}>
      <section className="purchase-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-title">
        <button className="modal-close" onClick={() => { if (!verifying) onClose() }} aria-label="Cerrar ventana" disabled={verifying}><X /></button>

        {step === 'confirmed' ? (
          <div className="confirmation">
            <div className="success-icon"><Check /></div>
            <Eyebrow>Pago verificado · Tu noche empieza aquí</Eyebrow>
            <h2 id="purchase-title">¡Entrada confirmada!</h2>
            <p className="confirmation-copy">Guarda o descarga este código QR. Deberás presentarlo en la puerta el día del evento.</p>
            <div className="qr-card">
              <div ref={qrWrapperRef} className="qr-canvas-box">
                <QRCodeCanvas value={codigoQr} size={184} level="M" marginSize={2} />
              </div>
              <div>
                <span>CÓDIGO ÚNICO</span>
                <strong>{summary}</strong>
                <p>S/. {total} · Yape verificado</p>
                <code className="qr-code-text">{codigoQr}</code>
              </div>
            </div>
            <div className="confirmation-actions">
              <button type="button" className="button button-primary" onClick={handleDownloadPdf} disabled={downloadingPdf}>
                {downloadingPdf ? <><Loader2 size={16} className="spin-icon" /> Generando PDF...</> : <><FileDown size={16} /> Descargar entrada (PDF)</>}
              </button>
              <button type="button" className="button button-outline" onClick={downloadQr}>
                <Download size={16} /> Solo QR (PNG)
              </button>
              <button type="button" className="button button-outline" onClick={onClose}>Cerrar</button>
            </div>
            <p className="demo-note">Código válido para un solo ingreso · After Hours</p>
          </div>
        ) : step === 'payment' ? (
          <>
            <Eyebrow>Paso 2 de 2 · Pago seguro</Eyebrow>
            <h2 id="purchase-title">Paga con Yape</h2>
            <p className="modal-intro">Realiza el pago exacto de <strong>S/. {total}</strong> y luego presiona verificar.</p>
            <form onSubmit={handleVerifyPayment} noValidate>
              <div className="payment-scroll">
                <div className="method-tabs" role="tablist" aria-label="Método de pago">
                  <button type="button" role="tab" aria-selected="true" className="method-tab is-active">
                    <Smartphone size={15} /> Yape
                  </button>
                  <button type="button" role="tab" aria-selected="false" className="method-tab is-disabled" disabled>
                    <Smartphone size={15} /> Plin <span>Pronto</span>
                  </button>
                </div>

                <div className="yape-box">
                  <div className="yape-qr-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/yape.png" alt="Código QR de Yape" />
                  </div>
                  <div className="yape-details">
                    <span className="yape-label">Número Yape / Plin</span>
                    <div className="yape-phone-row">
                      <strong>{PAYMENT_PHONE}</strong>
                      <button type="button" className="copy-btn" onClick={copyPhone}>
                        {copiedPhone ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                      </button>
                    </div>
                    <div className="yape-amount">
                      <span>Monto exacto</span>
                      <strong>S/. {total}</strong>
                    </div>
                    <p className="yape-tip">Puedes yapear escaneando el QR o desde Plin al número indicado.</p>
                  </div>
                </div>

                <div className="form-grid payment-fields">
                  <label className="form-field form-field-wide">
                    <span>Nombre del titular que realiza el pago</span>
                    <input
                      type="text"
                      value={nombreTitular}
                      placeholder="Ej. Gustavo Ccallo"
                      maxLength={100}
                      disabled={verifying}
                      onChange={e => setNombreTitular(e.target.value)}
                    />
                    <small className="field-subtle">Tal como aparece en tu cuenta de Yape o Plin.</small>
                  </label>
                  <label className="form-field form-field-wide">
                    <span>Código de seguridad de Yape (opcional)</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={codigoSeguridad}
                      placeholder="3 dígitos (ej. 226)"
                      maxLength={3}
                      disabled={verifying}
                      onChange={e => setCodigoSeguridad(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    />
                    <small className="field-subtle">Si pagas desde Plin hacia Yape, déjalo vacío.</small>
                  </label>
                </div>

                {verifying && (
                  <div className="verifying-box" role="status" aria-live="polite">
                    <Loader2 size={18} className="spin-icon" />
                    <div>
                      <strong>Buscando tu pago en Yape...</strong>
                      <span>Intento {attempt} de 10 · Esto puede tardar unos segundos</span>
                    </div>
                    <button
                      type="button"
                      className="cancel-verify-btn"
                      onClick={() => { cancelVerifyRef.current = true; setVerifying(false) }}
                    >
                      Detener
                    </button>
                  </div>
                )}
                {notFoundNotice && !verifying && (
                  <div className="verify-not-found" role="alert">
                    <AlertCircle size={18} />
                    <div>
                      <strong>No se pudo corroborar tu pago todavía</strong>
                      <p>
                        Espera unos momentos y vuelve a intentarlo — a veces la notificación de Yape tarda unos segundos en llegar.
                        Asegúrate también de haber enviado exactamente <strong>S/. {total}</strong> al <strong>{PAYMENT_PHONE}</strong> y que el nombre del titular coincida.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {error && <p className="form-error" role="alert">{error}</p>}

              <div className="modal-footer">
                <button
                  type="button"
                  className="button button-outline"
                  disabled={verifying}
                  onClick={() => { setError(''); setNotFoundNotice(false); setStep('attendees') }}
                >
                  <ArrowLeft size={16} /> Volver
                </button>
                <button className="button button-primary" type="submit" disabled={verifying}>
                  {verifying ? (
                    <><Loader2 size={16} className="spin-icon" /> Verificando...</>
                  ) : notFoundNotice ? (
                    <><RefreshCw size={15} /> Volver a corroborar</>
                  ) : (
                    <>Ya pagué · Verificar <ArrowRight size={17} /></>
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <Eyebrow>Paso 1 de 2 · Reserva tu lugar</Eyebrow>
            <h2 id="purchase-title">{selected.name}</h2>
            <p className="modal-intro">
              {isGeneral ? 'Elige cuántas entradas quieres y completa los datos únicos de cada asistente.' : `Completa los datos únicos de los ${selected.people} asistentes.`}
            </p>
            <form onSubmit={handleAttendeesSubmit} noValidate>
              {isGeneral && (
                <div className="qty-picker">
                  <div>
                    <strong>Cantidad de entradas</strong>
                    <small>S/. {selected.price} c/u · máximo {GENERAL_MAX}</small>
                  </div>
                  <div className="qty-control">
                    <button type="button" onClick={() => changeQuantity(quantity - 1)} disabled={quantity <= 1} aria-label="Quitar una entrada"><Minus size={16} /></button>
                    <output aria-live="polite">{quantity}</output>
                    <button type="button" onClick={() => changeQuantity(quantity + 1)} disabled={quantity >= GENERAL_MAX} aria-label="Agregar una entrada"><Plus size={16} /></button>
                  </div>
                </div>
              )}

              {multi && (
                <div className="attendee-progress">
                  <div className="progress-bar"><span style={{ width: `${(completeCount / attendees.length) * 100}%` }} /></div>
                  <span className="progress-label">{completeCount}/{attendees.length} asistentes listos</span>
                </div>
              )}

              <div className="attendee-list">
                {multi ? attendees.map((person, index) => {
                  const open = openIndex === index
                  const complete = isComplete(person)
                  const showErrors = revealed.includes(index)
                  const fullName = `${person.firstName} ${person.lastName}`.trim()
                  return (
                    <div key={index} className={`attendee ${complete ? 'is-complete' : ''} ${open ? 'is-open' : ''} ${showErrors && !complete ? 'has-errors' : ''}`}>
                      <button type="button" className="attendee-toggle" aria-expanded={open} aria-controls={`attendee-${index}`} onClick={() => setOpenIndex(current => (current === index ? null : index))}>
                        <span className="attendee-num">{complete ? <Check size={16} /> : pad(index + 1)}</span>
                        <span className="attendee-summary">
                          <strong>{fullName || `Asistente ${pad(index + 1)}`}</strong>
                          <small>{complete ? `DNI ${person.dni} · Datos completos` : showErrors ? 'Faltan datos' : index === 0 ? 'Titular de la compra' : 'Toca para completar'}</small>
                        </span>
                        <ChevronDown className="attendee-chevron" size={18} />
                      </button>
                      <div className="attendee-body" id={`attendee-${index}`} inert={!open}>
                        <div className="attendee-inner">
                          <div className="attendee-content">
                            <AttendeeFields attendee={person} showErrors={showErrors} onChange={(key, value) => updateAttendee(index, key, value)} />
                            {index < attendees.length - 1 && (
                              <button type="button" className="attendee-next" onClick={() => goNext(index)}>
                                Siguiente asistente <ArrowRight size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }) : (
                  <div className="attendee-single">
                    <AttendeeFields attendee={attendees[0]} showErrors={revealed.includes(0)} onChange={(key, value) => updateAttendee(0, key, value)} />
                  </div>
                )}
              </div>

              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="modal-footer">
                <div>
                  <span>Total{isGeneral && quantity > 1 ? ` · ${quantity} × S/. ${selected.price}` : ''}</span>
                  <strong>S/. {total}</strong>
                </div>
                <button className="button button-primary" type="submit" disabled={validating}>
                  {validating ? <><Loader2 size={16} className="spin-icon" /> Validando...</> : <>Siguiente <ArrowRight size={17} /></>}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  )
}

function TickerTrack() {
  return (
    <div className="ticker-track">
      {[...tickerItems, ...tickerItems].map((item, index) => <span key={index}>{item}</span>)}
    </div>
  )
}

export default function EventLanding() {
  const [selected, setSelected] = useState<Package | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [boxAvailability, setBoxAvailability] = useState<BoxAvailability | null>(null)
  const closePurchase = useCallback(() => setSelected(null), [])
  const closeNav = () => setMobileNavOpen(false)

  const refreshAvailability = useCallback(() => {
    fetch('/api/entradas/disponibilidad', { cache: 'no-store' })
      .then(res => res.json())
      .then((data: { ok?: boolean; disponibilidad?: BoxAvailability }) => {
        if (data.ok && data.disponibilidad) {
          setBoxAvailability(data.disponibilidad)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshAvailability()
  }, [refreshAvailability])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <main>
      <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
        <a className="brand" href="#inicio" aria-label="After Hours, inicio">
          <span className="brand-mark">AH</span>
          <span>AFTER<span className="brand-muted">HOURS</span></span>
        </a>
        <button className="mobile-menu" aria-label="Abrir menú" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(value => !value)}>
          {mobileNavOpen ? <X /> : <Menu />}
        </button>
        <nav className={mobileNavOpen ? 'nav-links nav-open' : 'nav-links'} aria-label="Navegación principal">
          <a href="#entradas" onClick={closeNav}>Entradas</a>
          <a href="#bar" onClick={closeNav}>Bar</a>
          <a href="#estelar" onClick={closeNav}>Evento estelar</a>
          <a className="nav-cta" href="#entradas" onClick={closeNav}>Conseguir entradas <ArrowRight size={14} /></a>
        </nav>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-image" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <h1 className="hero-title">
            <span className="t-outline">The Last</span>
            <span className="t-neon">Mini Fight</span>
            <span className="t-party">
              Party<span className="t-bang">!</span>
              <span className="hero-sticker" aria-hidden="true"><small>Sáb</small>28 Nov</span>
            </span>
          </h1>
          <p className="hero-subtitle">
            Guantes arriba, vasos arriba. <strong>Boxeo, DJ en vivo y bar premium</strong> en una sola noche que nadie va a querer que termine.
          </p>
          <div className="event-meta">
            <div><CalendarDays /><span><small>FECHA</small>Sábado 28 de noviembre</span></div>
            <div><Clock3 /><span><small>HORA</small>9:00 PM</span></div>
            <div><MapPin /><span><small>LUGAR</small>Hacienda Nápoles, Socabaya</span></div>
          </div>
          <div className="hero-actions">
            <a href="#entradas" className="button button-primary button-lg">Quiero mi entrada <ArrowRight size={18} /></a>
            <a href="#bar" className="button button-ghost button-lg">Ver la barra</a>
          </div>
        </div>
        <div className="hero-side-label">AREQUIPA · 2026</div>
      </section>

      <div className="ticker-wrap" aria-hidden="true">
        <div className="ticker ticker-back"><TickerTrack /></div>
        <div className="ticker ticker-front"><TickerTrack /></div>
      </div>

      <section className="tickets-section" id="entradas">
        <div className="section-heading">
          <div>
            <Eyebrow>Acceso limitado · Aforo exclusivo</Eyebrow>
            <h2>ASEGURA TU <span>LUGAR.</span></h2>
          </div>
          <p>Elige cómo quieres vivir<br className="desktop-break" /> la noche más esperada.</p>
        </div>
        <div className="ticket-grid">
          {packages.map((item, index) => {
            const Icon = packageIcons[item.id]
            const stock =
              item.id === 'platinum' || item.id === 'diamond'
                ? boxAvailability?.[item.id] ?? null
                : null
            const isSoldOut = stock !== null && stock.disponibles <= 0
            const isLowStock = stock !== null && stock.disponibles === 1
            return (
              <article className={`ticket tier-${item.id} ${isSoldOut ? 'is-sold-out' : ''}`} key={item.id}>
                {item.featured && !isSoldOut && <span className="ticket-stamp">Más elegido</span>}
                {isSoldOut && <span className="ticket-stamp ticket-stamp-soldout">Agotado</span>}
                <div className="ticket-main">
                  <div className="ticket-head">
                    <span>N° {pad(index + 1)} · {item.kind}</span>
                    {stock ? (
                      <span className={`stock-badge ${isSoldOut ? 'is-empty' : isLowStock ? 'is-low' : ''}`}>
                        {isSoldOut
                          ? 'Agotado'
                          : isLowStock
                            ? `¡Último! (1/${stock.total})`
                            : `${stock.disponibles}/${stock.total} disp.`}
                      </span>
                    ) : (
                      <Icon />
                    )}
                  </div>
                  <h3 className="ticket-name">{item.title[0]}<em>{item.title[1]}</em></h3>
                  <p className="ticket-tagline">{item.description}</p>
                  <ul className="ticket-perks">
                    {item.perks.map(perk => <li key={perk}><Check />{perk}</li>)}
                  </ul>
                </div>
                <div className="ticket-tear" aria-hidden="true" />
                <div className="ticket-stub">
                  <div className="ticket-price"><small>S/.</small>{item.price}</div>
                  <div className="ticket-admit">
                    {item.id === 'general' ? 'Por persona' : 'Admite'}
                    <strong>{item.id === 'general' ? `x${GENERAL_MAX} máx.` : `${item.people} pers.`}</strong>
                  </div>
                  <div className="barcode" aria-hidden="true" />
                  <button
                    className={`button ${isSoldOut ? 'button-soldout' : item.featured ? 'button-light' : 'button-outline'}`}
                    disabled={isSoldOut}
                    onClick={() => { if (!isSoldOut) setSelected(item) }}
                  >
                    {isSoldOut
                      ? 'Box agotado'
                      : item.id === 'general'
                        ? <>Comprar entradas <ArrowRight size={16} /></>
                        : <>Reservar {item.name} <ArrowRight size={16} /></>}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
        <p className="tickets-fineprint">Pago verificado al instante vía Yape · Código QR único por compra.</p>
      </section>

      <section className="bar-section" id="bar">
        <div className="section-heading">
          <div>
            <Eyebrow>Bar &amp; drinks · Menú</Eyebrow>
            <h2>PIDE TU<br /><span>BOTELLA.</span></h2>
          </div>
          <div className="neon-sign">
            <strong>¡Corcho libre de latas!</strong>
            <span>9:00 PM — 10:00 PM</span>
          </div>
        </div>
        <div className="drink-grid">
          {drinks.map((drink, index) => (
            <article className="drink-card" key={drink.name}>
              <div className="drink-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={drink.image} alt={`Botella de ${drink.name}`} loading="lazy" />
                <span className="drink-index">{pad(index + 1)}</span>
                <span className="price-sticker"><small>S/.</small>{drink.price}</span>
              </div>
              <div className="drink-info">
                <h3>{drink.name}</h3>
                <div className="drink-meta">
                  <span>{drink.bottle}</span>
                  <span className="drink-mixer">+ {drink.mixer}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
        <p className="bar-note">Barra abierta toda la noche · Precios en soles</p>
      </section>

      <section className="main-event" id="estelar">
        <div className="ring-lines" />
        <div className="main-event-inner">
          <Eyebrow>El momento que estabas esperando</Eyebrow>
          <span className="midnight">00:00 <span>AM</span></span>
          <h2>EL EVENTO<br /><span>ESTELAR.</span></h2>
          <p>Prepárate para la pelea más esperada de la noche. Cuando el reloj marque la medianoche, el ring se encenderá para una batalla épica que no te puedes perder. Este es el momento que todos esperan.</p>
          <a href="#entradas" className="text-link">Asegura tu lugar <ArrowRight size={17} /></a>
        </div>
        <div className="event-glow" />
      </section>

      <footer className="site-footer">
        <div className="footer-main">
          <div className="brand footer-brand">
            <span className="brand-mark">AH</span>
            <span>AFTER<span className="brand-muted">HOURS</span></span>
          </div>
          <div className="footer-event">
            <strong>THE LAST MINI FIGHT PARTY</strong>
            <span>Organizado por After Hours</span>
          </div>
          <a className="button button-primary" href="#entradas">¡Compra tus entradas ahora! <ArrowRight size={16} /></a>
        </div>
        <div className="footer-bottom">
          <span>© 2026 AFTER HOURS · TODOS LOS DERECHOS RESERVADOS</span>
          <a href="#inicio">VOLVER ARRIBA ↑</a>
          <span>HECHO PARA UNA NOCHE INOLVIDABLE</span>
        </div>
      </footer>

      {selected && <PurchaseModal key={selected.id} selected={selected} onClose={closePurchase} onConfirmed={refreshAvailability} />}
    </main>
  )
}
