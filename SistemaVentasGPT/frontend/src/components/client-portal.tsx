import { useEffect, useMemo, useState } from 'react'
import {
  getClientPortalMe,
  getErrorMessage,
  getStoredClientPortalToken,
  loginClientPortal,
  logoutClientPortal,
  setStoredClientPortalToken,
} from '../api'
import type { ClientPortalData } from '../types'
import logo from '../assets/GPT.png'
import './client-portal.css'

const DEVICE_KEY = 'sistema-cobro-client-device-id'

function getDeviceId() {
  let id = window.localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

function getDeviceName() {
  const ua = navigator.userAgent
  const mobile = /Android|iPhone|iPad|Mobile/i.test(ua)
  const browser = /Edg/i.test(ua) ? 'Edge' : /Firefox/i.test(ua) ? 'Firefox' : /Chrome/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : 'Navegador'
  return `${mobile ? 'Celular' : 'Computadora'} · ${browser}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Por confirmar'
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value))
}

function money(value: number | undefined) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value || 0)
}

export function ClientPortal() {
  const [portal, setPortal] = useState<ClientPortalData | null>(null)
  const [telefono, setTelefono] = useState('')
  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(!!getStoredClientPortalToken())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!getStoredClientPortalToken()) return
    getClientPortalMe()
      .then((result) => setPortal(result.portal))
      .catch(() => setStoredClientPortalToken(''))
      .finally(() => setLoading(false))
  }, [])

  const status = useMemo(() => {
    if (!portal?.servicio) return { label: 'Pendiente de configuración', className: 'pending' }
    if (portal.servicio.estado === 'PAGADO') return { label: 'Servicio activo', className: 'active' }
    if (portal.servicio.estado === 'BAJA') return { label: 'Servicio finalizado', className: 'inactive' }
    return { label: 'Pago pendiente', className: 'pending' }
  }, [portal])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const result = await loginClientPortal({
        telefono: telefono.replace(/\D/g, ''),
        codigo,
        identificador: getDeviceId(),
        nombreDispositivo: getDeviceName(),
      })
      setStoredClientPortalToken(result.token)
      setPortal(result.portal)
    } catch (loginError) {
      setError(getErrorMessage(loginError, 'No se pudo ingresar.'))
    } finally {
      setSubmitting(false)
    }
  }

  const logout = async () => {
    try { await logoutClientPortal() } catch { /* La sesión puede haber vencido. */ }
    setStoredClientPortalToken('')
    setPortal(null)
    setCodigo('')
  }

  if (loading) {
    return <div className="client-portal-page"><div className="client-portal-loader"><img src={logo} alt="" /><span>Abriendo tu portal…</span></div></div>
  }

  if (!portal) {
    return (
      <main className="client-portal-page">
        <div className="client-portal-orb orb-one" /><div className="client-portal-orb orb-two" />
        <section className="client-portal-login">
          <div className="client-portal-brand"><div className="client-portal-logo"><img src={logo} alt="Logo" /></div><div><span>ACCESO SEGURO</span><h1>Portal del cliente</h1></div></div>
          <p className="client-portal-lead">Consulta tu servicio, próxima fecha de pago y dispositivos autorizados.</p>
          <form onSubmit={submit}>
            {error && <div className="client-portal-error">{error}</div>}
            <label>Teléfono registrado<input inputMode="tel" autoComplete="tel" maxLength={15} value={telefono} onChange={(event) => setTelefono(event.target.value)} placeholder="999 999 999" required /></label>
            <label>Código de acceso<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(event) => setCodigo(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" required /></label>
            <button type="submit" disabled={submitting || codigo.length !== 6}>{submitting ? 'Verificando…' : 'Ingresar a mi portal'}<span>→</span></button>
          </form>
          <div className="client-portal-privacy"><span>◉</span><p>El código te lo brinda el administrador. Por seguridad, registraremos este dispositivo y su IP cuando ingreses.</p></div>
        </section>
      </main>
    )
  }

  return (
    <main className="client-portal-page is-dashboard">
      <div className="client-portal-orb orb-one" /><div className="client-portal-orb orb-two" />
      <section className="client-portal-dashboard">
        <header className="client-portal-dashboard__header">
          <div className="client-portal-brand"><div className="client-portal-logo"><img src={logo} alt="Logo" /></div><div><span>PORTAL DEL CLIENTE</span><h1>Hola, {portal.cliente.nombre.split(' ')[0]}</h1></div></div>
          <button type="button" onClick={logout}>Cerrar sesión</button>
        </header>

        <div className="client-portal-welcome">
          <div><span className={`client-portal-status ${status.className}`}>{status.label}</span><h2>{portal.cliente.carpeta || 'Tu servicio'}</h2><p>Aquí tienes el resumen actualizado de tu servicio.</p></div>
          <div className="client-portal-amount"><span>Pago mensual</span><strong>{money(portal.servicio?.monto || portal.cliente.monto)}</strong></div>
        </div>

        <div className="client-portal-grid">
          <article><div className="card-icon blue">▣</div><span>Correo de acceso</span><strong>{portal.servicio?.correoAcceso || 'Por asignar'}</strong><small>Cuenta vinculada a tu servicio</small></article>
          <article><div className="card-icon cyan">◇</div><span>Próximo pago</span><strong>{formatDate(portal.servicio?.fechaCierre)}</strong><small>Inicio: {formatDate(portal.servicio?.fechaInicio)}</small></article>
          <article><div className="card-icon green">✓</div><span>Dispositivos autorizados</span><strong>{portal.dispositivos.activos} de {portal.dispositivos.limite}</strong><div className="device-progress"><i style={{ width: `${Math.min(100, (portal.dispositivos.activos / portal.dispositivos.limite) * 100)}%` }} /></div></article>
          <article><div className="card-icon violet">⌁</div><span>Este dispositivo</span><strong>{portal.dispositivos.actual?.nombre || 'Dispositivo actual'}</strong><small>IP: {portal.dispositivos.actual?.ip || 'No disponible'}</small></article>
        </div>

        <div className="client-portal-note"><div>i</div><p><strong>Control de acceso activo.</strong> Este portal registra el dispositivo y la IP usados para ingresar aquí. No supervisa accesos realizados directamente en Gmail u otros servicios externos.</p></div>
      </section>
    </main>
  )
}
