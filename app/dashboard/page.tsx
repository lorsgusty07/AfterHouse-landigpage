'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  Copy,
  DollarSign,
  Loader2,
  Lock,
  LogOut,
  Megaphone,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Ticket,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react'
import type { EntradaRecord, PromotorRecord } from '@/lib/entradas'
import './dashboard.css'

type EntradaItem = EntradaRecord & { id: string }
type PromotorStats = {
  compras: number
  entradas: number
  asistentes: number
  totalVendido: number
  porTipo: { general: number; platinum: number; diamond: number }
}
type PromotorItem = PromotorRecord & { id: string; stats: PromotorStats }

type Stats = {
  totalCompras: number
  totalEntradas: number
  totalVendido: number
  totalAsistentes: number
  entradasEscaneadas: number
  asistentesEscaneados: number
  porTipo: { general: number; platinum: number; diamond: number }
}

type ScanResult = {
  status: 'ok' | 'already_scanned' | 'not_found' | 'error'
  message: string
  entradaId?: string
  entrada?: EntradaRecord
}

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function DashboardPage() {
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  // Login form
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  // Dashboard state
  const [tab, setTab] = useState<'resumen' | 'promotores' | 'escaner'>('resumen')
  const [loadingData, setLoadingData] = useState(false)
  const [dataError, setDataError] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [entradas, setEntradas] = useState<EntradaItem[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'scanned'>('all')

  // Promotores state
  const [promotores, setPromotores] = useState<PromotorItem[]>([])
  const [promoNombre, setPromoNombre] = useState('')
  const [promoCodigo, setPromoCodigo] = useState('')
  const [creatingPromo, setCreatingPromo] = useState(false)
  const [promoError, setPromoError] = useState('')
  const [createdPromo, setCreatedPromo] = useState<PromotorRecord | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [deletingPromoId, setDeletingPromoId] = useState<string | null>(null)

  // Scanner state
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [scanningApi, setScanningApi] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null)
  const scanBusyRef = useRef(false)

  const fetchAll = useCallback(async () => {
    setLoadingData(true)
    setDataError('')
    try {
      const [resEntradas, resPromos] = await Promise.all([
        fetch('/api/admin/entradas', { cache: 'no-store' }),
        fetch('/api/admin/promotores', { cache: 'no-store' }),
      ])

      if (resEntradas.status === 401 || resPromos.status === 401) {
        setAuthenticated(false)
        return
      }

      const dataEntradas = (await resEntradas.json()) as {
        ok?: boolean
        stats?: Stats
        entradas?: EntradaItem[]
        error?: string
      }
      if (!resEntradas.ok || !dataEntradas.ok) {
        setDataError(dataEntradas.error || 'Error al cargar las entradas.')
      } else {
        setStats(dataEntradas.stats ?? null)
        setEntradas(dataEntradas.entradas ?? [])
      }

      const dataPromos = (await resPromos.json()) as {
        ok?: boolean
        promotores?: PromotorItem[]
        error?: string
      }
      if (resPromos.ok && dataPromos.ok) {
        setPromotores(dataPromos.promotores ?? [])
      }
    } catch {
      setDataError('Error de conexión con el servidor.')
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    fetch('/api/admin/login', { cache: 'no-store' })
      .then(r => r.json())
      .then((data: { authenticated?: boolean }) => {
        if (data.authenticated) {
          setAuthenticated(true)
          fetchAll()
        }
      })
      .catch(() => {})
      .finally(() => setCheckingAuth(false))
  }, [fetchAll])

  const stopCamera = useCallback(async () => {
    const instance = scannerRef.current
    scannerRef.current = null
    setCameraActive(false)
    if (instance) {
      try {
        await instance.stop()
      } catch {
        // already stopped
      }
      try {
        instance.clear()
      } catch {
        // ignore
      }
    }
  }, [])

  useEffect(() => {
    if (tab !== 'escaner') {
      stopCamera()
    }
    return () => {
      stopCamera()
    }
  }, [tab, stopCamera])

  const verifyCode = useCallback(
    async (codigo: string) => {
      const trimmed = codigo.trim()
      if (!trimmed || scanBusyRef.current) return
      scanBusyRef.current = true
      setScanningApi(true)
      setScanResult(null)
      try {
        const res = await fetch('/api/admin/escanear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo: trimmed }),
        })
        if (res.status === 401) {
          setAuthenticated(false)
          return
        }
        const data = (await res.json()) as ScanResult
        setScanResult(data)
        if (data.status === 'ok') {
          fetchAll()
        }
      } catch {
        setScanResult({ status: 'error', message: 'Error de red al validar el código.' })
      } finally {
        setScanningApi(false)
      }
    },
    [fetchAll]
  )

  const startCamera = async () => {
    setCameraError('')
    setScanResult(null)
    scanBusyRef.current = false
    await stopCamera()

    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const qr = new Html5Qrcode('qr-reader')
      scannerRef.current = qr
      setCameraActive(true)
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        decodedText => {
          if (scanBusyRef.current) return
          stopCamera()
          verifyCode(decodedText)
        },
        () => {}
      )
    } catch (err) {
      setCameraActive(false)
      scannerRef.current = null
      const msg = err instanceof Error ? err.message : 'No se pudo acceder a la cámara.'
      setCameraError(`No se pudo iniciar la cámara (${msg}). Puedes usar el campo manual abajo.`)
    }
  }

  const resetForNextScan = () => {
    setScanResult(null)
    setManualCode('')
    scanBusyRef.current = false
  }

  const handleCreatePromotor = async (event: React.FormEvent) => {
    event.preventDefault()
    setPromoError('')
    setCreatedPromo(null)
    const nombre = promoNombre.trim()
    if (nombre.length < 2) {
      setPromoError('Ingresa el nombre del promotor.')
      return
    }

    setCreatingPromo(true)
    try {
      const res = await fetch('/api/admin/promotores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          codigo: promoCodigo.trim() || undefined,
        }),
      })
      if (res.status === 401) {
        setAuthenticated(false)
        return
      }
      const data = (await res.json()) as { ok?: boolean; promotor?: PromotorRecord; error?: string }
      if (!res.ok || !data.ok || !data.promotor) {
        setPromoError(data.error || 'No se pudo crear el promotor.')
        return
      }
      setCreatedPromo(data.promotor)
      setPromoNombre('')
      setPromoCodigo('')
      fetchAll()
    } catch {
      setPromoError('Error de conexión al crear el promotor.')
    } finally {
      setCreatingPromo(false)
    }
  }

  const handleDeletePromotor = async (id: string, nombre: string) => {
    if (!window.confirm(`¿Eliminar al promotor "${nombre}"? Las entradas ya vendidas conservarán su registro.`)) {
      return
    }
    setDeletingPromoId(id)
    try {
      const res = await fetch(`/api/admin/promotores?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (res.status === 401) {
        setAuthenticated(false)
        return
      }
      if (res.ok) {
        setPromotores(current => current.filter(p => p.id !== id))
      }
    } finally {
      setDeletingPromoId(null)
    }
  }

  const copyPromoCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 1800)
    } catch {
      // ignore
    }
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoginError('')
    setLoggingIn(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, password }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setLoginError(data.error || 'Credenciales inválidas.')
        return
      }
      setAuthenticated(true)
      setPassword('')
      fetchAll()
    } catch {
      setLoginError('Error de conexión.')
    } finally {
      setLoggingIn(false)
    }
  }

  const handleLogout = async () => {
    await stopCamera()
    await fetch('/api/admin/login', { method: 'DELETE' })
    setAuthenticated(false)
    setEntradas([])
    setPromotores([])
    setStats(null)
  }

  const filteredEntradas = entradas.filter(item => {
    if (statusFilter === 'scanned' && !item.escaneado) return false
    if (statusFilter === 'pending' && item.escaneado) return false
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    const inHeader =
      (item.codigoQr || '').toLowerCase().includes(q) ||
      (item.tipoNombre || '').toLowerCase().includes(q) ||
      (item.pagador?.nombreTitular || '').toLowerCase().includes(q) ||
      (item.codigoPromotor || '').toLowerCase().includes(q) ||
      (item.promotorNombre || '').toLowerCase().includes(q)
    const inAttendees = (item.asistentes || []).some(
      a =>
        `${a.nombres} ${a.apellidos}`.toLowerCase().includes(q) ||
        (a.dni || '').includes(q) ||
        (a.correo || '').toLowerCase().includes(q) ||
        (a.telefono || '').includes(q)
    )
    return inHeader || inAttendees
  })

  if (checkingAuth) {
    return (
      <div className="dash-center">
        <Loader2 size={28} className="spin-icon" />
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="dash-center">
        <form className="dash-login-card" onSubmit={handleLogin}>
          <div className="dash-login-brand">
            <span className="brand-mark">AH</span>
            <div>
              <strong>AFTER HOURS</strong>
              <small>Panel de administración</small>
            </div>
          </div>
          <h1>Iniciar sesión</h1>
          <label className="form-field">
            <span>Usuario</span>
            <input
              type="text"
              value={usuario}
              onChange={e => setUsuario(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              required
            />
          </label>
          <label className="form-field">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>
          {loginError && <p className="form-error">{loginError}</p>}
          <button type="submit" className="button button-primary dash-login-btn" disabled={loggingIn}>
            {loggingIn ? <Loader2 size={16} className="spin-icon" /> : <Lock size={15} />}
            {loggingIn ? 'Ingresando...' : 'Ingresar al panel'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="dash-shell">
      <header className="dash-header">
        <div className="dash-header-left">
          <a href="/" className="brand">
            <span className="brand-mark">AH</span>
            <span>AFTER<span className="brand-muted">ADMIN</span></span>
          </a>
          <nav className="dash-tabs" aria-label="Secciones del panel">
            <button
              type="button"
              className={`dash-tab ${tab === 'resumen' ? 'is-active' : ''}`}
              onClick={() => setTab('resumen')}
            >
              <Ticket size={15} /> Ventas y asistentes
            </button>
            <button
              type="button"
              className={`dash-tab ${tab === 'promotores' ? 'is-active' : ''}`}
              onClick={() => setTab('promotores')}
            >
              <Megaphone size={15} /> Promotores ({promotores.length})
            </button>
            <button
              type="button"
              className={`dash-tab ${tab === 'escaner' ? 'is-active' : ''}`}
              onClick={() => setTab('escaner')}
            >
              <QrCode size={15} /> Escáner QR
            </button>
          </nav>
        </div>
        <div className="dash-header-actions">
          <button type="button" className="dash-icon-btn" onClick={fetchAll} disabled={loadingData} title="Actualizar">
            <RefreshCw size={15} className={loadingData ? 'spin-icon' : ''} />
            <span>Actualizar</span>
          </button>
          <button type="button" className="dash-icon-btn dash-logout" onClick={handleLogout}>
            <LogOut size={15} />
            <span>Salir</span>
          </button>
        </div>
      </header>

      <main className="dash-main">
        {dataError && <div className="dash-alert-error">{dataError}</div>}

        {tab === 'resumen' ? (
          <>
            <section className="dash-kpis">
              <article className="dash-kpi dash-kpi-highlight">
                <div className="dash-kpi-head">
                  <span>Total vendido</span>
                  <DollarSign size={18} />
                </div>
                <strong>S/. {stats?.totalVendido ?? 0}</strong>
                <small>{stats?.totalCompras ?? 0} compras confirmadas</small>
              </article>

              <article className="dash-kpi">
                <div className="dash-kpi-head">
                  <span>Entradas vendidas</span>
                  <Ticket size={18} />
                </div>
                <strong>{stats?.totalEntradas ?? 0}</strong>
                <small>
                  Gen: {stats?.porTipo.general ?? 0} · Plat: {stats?.porTipo.platinum ?? 0} · Diam: {stats?.porTipo.diamond ?? 0}
                </small>
              </article>

              <article className="dash-kpi">
                <div className="dash-kpi-head">
                  <span>Total asistentes</span>
                  <Users size={18} />
                </div>
                <strong>{stats?.totalAsistentes ?? 0}</strong>
                <small>Personas registradas</small>
              </article>

              <article className="dash-kpi">
                <div className="dash-kpi-head">
                  <span>Ya ingresaron</span>
                  <CheckCircle2 size={18} />
                </div>
                <strong>
                  {stats?.entradasEscaneadas ?? 0}
                  <span>/{stats?.totalCompras ?? 0}</span>
                </strong>
                <small>{stats?.asistentesEscaneados ?? 0} asistentes dentro</small>
              </article>
            </section>

            <section className="dash-toolbar">
              <div className="dash-search">
                <Search size={16} />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar por nombre, DNI, correo, promotor o código QR..."
                />
              </div>
              <div className="dash-filters">
                {(['all', 'pending', 'scanned'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    className={`dash-filter ${statusFilter === f ? 'is-active' : ''}`}
                    onClick={() => setStatusFilter(f)}
                  >
                    {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : 'Escaneados'}
                  </button>
                ))}
              </div>
            </section>

            <section className="dash-list">
              {loadingData && entradas.length === 0 ? (
                <div className="dash-empty">Cargando entradas...</div>
              ) : filteredEntradas.length === 0 ? (
                <div className="dash-empty">No hay entradas que coincidan con la búsqueda.</div>
              ) : (
                filteredEntradas.map(item => (
                  <article key={item.id} className={`dash-entry ${item.escaneado ? 'is-scanned' : ''}`}>
                    <div className="dash-entry-top">
                      <div className="dash-entry-title">
                        <div className="dash-badges-row">
                          <span className={`dash-badge ${item.escaneado ? 'badge-ok' : 'badge-pending'}`}>
                            {item.escaneado ? '✓ Escaneado · Ingresó' : 'Pendiente de ingreso'}
                          </span>
                          {item.codigoPromotor && (
                            <span className="dash-badge badge-promo">
                              Promotor: {item.promotorNombre ? `${item.promotorNombre} (${item.codigoPromotor})` : item.codigoPromotor}
                            </span>
                          )}
                        </div>
                        <h3>
                          {item.tipoNombre} {item.tipo === 'general' && item.cantidad > 1 ? `×${item.cantidad}` : ''}
                        </h3>
                        <code>{item.codigoQr || item.id}</code>
                      </div>
                      <div className="dash-entry-meta">
                        <strong>S/. {item.precioTotal}</strong>
                        <span>{(item.metodoPago || 'yape').toUpperCase()} · {item.pagador?.nombreTitular}</span>
                        <small>
                          Compra: {formatDate(item.creadoEn)}
                          {item.escaneadoEn ? ` · Ingresó: ${formatDate(item.escaneadoEn)}` : ''}
                        </small>
                      </div>
                    </div>
                    <div className="dash-attendees-grid">
                      {(item.asistentes || []).map((a, i) => (
                        <div key={i} className="dash-attendee-pill">
                          <strong>{a.nombres} {a.apellidos}</strong>
                          <span>DNI {a.dni} · {a.telefono}</span>
                          <small>{a.correo}</small>
                        </div>
                      ))}
                    </div>
                  </article>
                ))
              )}
            </section>
          </>
        ) : tab === 'promotores' ? (
          <section className="promo-section">
            <form className="promo-create-card" onSubmit={handleCreatePromotor}>
              <div>
                <h2>Registrar promotor</h2>
                <p>Ingresa el nombre del promotor y genera su código único para rastrear sus ventas.</p>
              </div>
              <div className="promo-create-grid">
                <label className="form-field">
                  <span>Nombre del promotor</span>
                  <input
                    type="text"
                    value={promoNombre}
                    onChange={e => setPromoNombre(e.target.value)}
                    placeholder="Ej. Carlos Mendoza"
                    maxLength={80}
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Código personalizado (opcional)</span>
                  <input
                    type="text"
                    value={promoCodigo}
                    onChange={e => setPromoCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                    placeholder="Vacío = generar automático"
                    maxLength={20}
                  />
                </label>
                <button type="submit" className="button button-primary promo-create-btn" disabled={creatingPromo}>
                  {creatingPromo ? <Loader2 size={16} className="spin-icon" /> : <Plus size={16} />}
                  {creatingPromo ? 'Creando...' : 'Generar promotor'}
                </button>
              </div>
              {promoError && <p className="form-error">{promoError}</p>}
              {createdPromo && (
                <div className="promo-created-banner">
                  <span>
                    Promotor <strong>{createdPromo.nombre}</strong> creado con código{' '}
                    <code>{createdPromo.codigo}</code>
                  </span>
                  <button type="button" className="copy-btn" onClick={() => copyPromoCode(createdPromo.codigo)}>
                    {copiedCode === createdPromo.codigo ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar código</>}
                  </button>
                </div>
              )}
            </form>

            <div className="promo-list">
              {loadingData && promotores.length === 0 ? (
                <div className="dash-empty">Cargando promotores...</div>
              ) : promotores.length === 0 ? (
                <div className="dash-empty">Aún no hay promotores registrados. Crea el primero arriba.</div>
              ) : (
                promotores.map(promo => (
                  <article key={promo.id} className="promo-card">
                    <div className="promo-card-head">
                      <div className="promo-card-info">
                        <h3>{promo.nombre}</h3>
                        <div className="promo-code-row">
                          <code className="promo-code-chip">{promo.codigo}</code>
                          <button type="button" className="copy-btn" onClick={() => copyPromoCode(promo.codigo)}>
                            {copiedCode === promo.codigo ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="promo-delete-btn"
                        disabled={deletingPromoId === promo.id}
                        onClick={() => handleDeletePromotor(promo.id, promo.nombre)}
                        title="Eliminar promotor"
                        aria-label={`Eliminar promotor ${promo.nombre}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="promo-metrics">
                      <div className="promo-metric promo-metric-accent">
                        <span>Entradas</span>
                        <strong>{promo.stats.entradas}</strong>
                        <small>
                          Gen: {promo.stats.porTipo.general} · Plat: {promo.stats.porTipo.platinum} · Diam: {promo.stats.porTipo.diamond}
                        </small>
                      </div>
                      <div className="promo-metric">
                        <span>Asistentes</span>
                        <strong>{promo.stats.asistentes}</strong>
                        <small>{promo.stats.compras} {promo.stats.compras === 1 ? 'compra' : 'compras'}</small>
                      </div>
                      <div className="promo-metric">
                        <span>Total vendido</span>
                        <strong>S/. {promo.stats.totalVendido}</strong>
                        <small>Recaudado</small>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        ) : (
          <section className="dash-scanner-wrap">
            <div className="dash-scanner-card">
              <div className="dash-scanner-head">
                <div>
                  <h2>Escáner de acceso</h2>
                  <p>Apunta la cámara al código QR de la entrada para validar el ingreso.</p>
                </div>
                {!cameraActive ? (
                  <button type="button" className="button button-primary" onClick={startCamera}>
                    <Camera size={16} /> Activar cámara
                  </button>
                ) : (
                  <button type="button" className="button button-outline" onClick={stopCamera}>
                    <CameraOff size={16} /> Detener cámara
                  </button>
                )}
              </div>

              <div className={`qr-reader-frame ${cameraActive ? 'is-active' : ''}`}>
                <div id="qr-reader" />
                {!cameraActive && !scanResult && (
                  <div className="qr-reader-placeholder">
                    <QrCode size={42} />
                    <span>Presiona &ldquo;Activar cámara&rdquo; para comenzar a escanear</span>
                  </div>
                )}
              </div>

              {cameraError && <p className="form-error">{cameraError}</p>}

              {scanningApi && (
                <div className="scan-loading">
                  <Loader2 size={20} className="spin-icon" /> Validando código en Firebase...
                </div>
              )}

              {scanResult && (
                <div className={`scan-result scan-${scanResult.status}`}>
                  <div className="scan-result-head">
                    {scanResult.status === 'ok' ? (
                      <CheckCircle2 size={32} />
                    ) : scanResult.status === 'already_scanned' ? (
                      <AlertTriangle size={32} />
                    ) : (
                      <XCircle size={32} />
                    )}
                    <div>
                      <h3>
                        {scanResult.status === 'ok'
                          ? 'ACCESO PERMITIDO'
                          : scanResult.status === 'already_scanned'
                            ? 'YA FUE ESCANEADO'
                            : 'CÓDIGO NO VÁLIDO'}
                      </h3>
                      <p>{scanResult.message}</p>
                    </div>
                  </div>

                  {scanResult.entrada && (
                    <div className="scan-result-details">
                      <div className="scan-result-summary">
                        <span><strong>Tipo:</strong> {scanResult.entrada.tipoNombre}</span>
                        <span><strong>Total:</strong> S/. {scanResult.entrada.precioTotal}</span>
                        <span><strong>Titular pago:</strong> {scanResult.entrada.pagador?.nombreTitular}</span>
                        {scanResult.entrada.codigoPromotor && (
                          <span><strong>Promotor:</strong> {scanResult.entrada.promotorNombre || scanResult.entrada.codigoPromotor}</span>
                        )}
                        {scanResult.entrada.escaneadoEn && (
                          <span><strong>Escaneado:</strong> {formatDate(scanResult.entrada.escaneadoEn)}</span>
                        )}
                      </div>
                      <div className="dash-attendees-grid">
                        {(scanResult.entrada.asistentes || []).map((a, i) => (
                          <div key={i} className="dash-attendee-pill">
                            <strong>{a.nombres} {a.apellidos}</strong>
                            <span>DNI {a.dni}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="scan-result-actions">
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => {
                        resetForNextScan()
                        startCamera()
                      }}
                    >
                      <Camera size={16} /> Escanear siguiente
                    </button>
                    <button type="button" className="button button-outline" onClick={resetForNextScan}>
                      Limpiar
                    </button>
                  </div>
                </div>
              )}

              <form
                className="manual-scan-form"
                onSubmit={e => {
                  e.preventDefault()
                  scanBusyRef.current = false
                  verifyCode(manualCode)
                }}
              >
                <input
                  type="text"
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  placeholder="O ingresa el código QR manualmente (ej. TLMF-...)"
                />
                <button type="submit" className="button button-outline" disabled={scanningApi || !manualCode.trim()}>
                  Validar código
                </button>
              </form>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
