'use client'

import { useCallback, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowRight, CalendarDays, Check, ChevronDown, Clock3, Crown, Gem, MapPin, Menu, Minus, Plus, Ticket, X } from 'lucide-react'

type PackageId = 'general' | 'platinum' | 'diamond'
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

const GENERAL_MAX = 10

const packages: Package[] = [
  { id: 'general', name: 'Entrada General', title: ['Entrada', 'General'], kind: 'Individual', price: 20, people: 1, description: 'Preventa · Elige cuántas entradas quieres.', perks: ['Acceso al evento', 'DJ en vivo toda la noche', 'Una noche para recordar'] },
  { id: 'platinum', name: 'Box Platinum', title: ['Box', 'Platinum'], kind: 'Experiencia', price: 300, people: 5, description: 'Un espacio para vivir la noche juntos.', perks: ['5 entradas', '1 botella de 750 ml a elegir', 'Jägermeister / Bacardi / Smirnoff'], featured: true },
  { id: 'diamond', name: 'Box Diamond', title: ['Box', 'Diamond'], kind: 'Experiencia', price: 600, people: 10, description: 'La experiencia definitiva. Sin límites.', perks: ['10 entradas', '1 botella premium a elegir', 'JW Double Black / Chivas Regal Extra / Flor de Caña Centenario'] },
]

const packageIcons: Record<PackageId, typeof Ticket> = { general: Ticket, platinum: Crown, diamond: Gem }

// Reemplaza `image` por la foto de cada trago (guárdalas en /public/drinks/).
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

function PurchaseModal({ selected, onClose }: { selected: Package; onClose: () => void }) {
  const isGeneral = selected.id === 'general'
  const [quantity, setQuantity] = useState(1)
  const [attendees, setAttendees] = useState<Attendee[]>(() => Array.from({ length: selected.people }, emptyAttendee))
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const [revealed, setRevealed] = useState<number[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

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

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const firstInvalid = attendees.findIndex(person => !isComplete(person))
    if (firstInvalid !== -1) {
      setRevealed(attendees.map((_, index) => index))
      setOpenIndex(firstInvalid)
      setError(multi ? `Faltan datos del asistente ${pad(firstInvalid + 1)}. Revisa los campos marcados.` : 'Revisa los campos marcados.')
      return
    }
    setError('')
    setConfirmed(true)
  }

  const qrValue = `Order: ${summary} | Titular: ${attendees[0]?.firstName} ${attendees[0]?.lastName} | Event: The Last Mini Fight Party - 28/11`

  return (
    <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="purchase-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-title">
        <button className="modal-close" onClick={onClose} aria-label="Cerrar ventana"><X /></button>
        {confirmed ? (
          <div className="confirmation">
            <div className="success-icon"><Check /></div>
            <Eyebrow>Tu noche empieza aquí</Eyebrow>
            <h2 id="purchase-title">¡Gracias por tu compra!</h2>
            <p className="confirmation-copy">Tu reserva simulada está lista. Guarda este código para tenerlo a mano.</p>
            <div className="qr-card">
              <QRCodeSVG value={qrValue} size={176} level="M" marginSize={2} />
              <div>
                <span>RESUMEN DE COMPRA</span>
                <strong>{summary}</strong>
                <p>S/. {total}</p>
              </div>
            </div>
            <p className="demo-note">Simulación de compra · No se realizó ningún cobro</p>
            <button className="button button-primary modal-done" onClick={onClose}>Cerrar</button>
          </div>
        ) : (
          <>
            <Eyebrow>Reserva tu lugar</Eyebrow>
            <h2 id="purchase-title">{selected.name}</h2>
            <p className="modal-intro">
              {isGeneral ? 'Elige cuántas entradas quieres y completa los datos de cada asistente.' : `Completa los datos de los ${selected.people} asistentes.`}
            </p>
            <form onSubmit={submit} noValidate>
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
                <button className="button button-primary" type="submit">Continuar <ArrowRight size={17} /></button>
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
  const closePurchase = useCallback(() => setSelected(null), [])
  const closeNav = () => setMobileNavOpen(false)

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
            return (
              <article className={`ticket tier-${item.id}`} key={item.id}>
                {item.featured && <span className="ticket-stamp">Más elegido</span>}
                <div className="ticket-main">
                  <div className="ticket-head">
                    <span>N° {pad(index + 1)} · {item.kind}</span>
                    <Icon />
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
                  <button className={`button ${item.featured ? 'button-light' : 'button-outline'}`} onClick={() => setSelected(item)}>
                    {item.id === 'general' ? 'Comprar entradas' : `Reservar ${item.name}`} <ArrowRight size={16} />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
        <p className="tickets-fineprint">Pago simulado · Las compras son una demostración interactiva. No se procesan pagos reales.</p>
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

      {selected && <PurchaseModal key={selected.id} selected={selected} onClose={closePurchase} />}
    </main>
  )
}
