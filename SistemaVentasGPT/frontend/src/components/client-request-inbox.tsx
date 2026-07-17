import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  approveClientRequest,
  getCuentas,
  getClientRequests,
  getErrorMessage,
  rejectClientRequest,
} from '../api'
import type { CuentaAcceso, SolicitudCliente, SolicitudClienteReviewPayload } from '../types'
import { formatCurrencyPen, formatDateDisplay, toInputDate } from '../utils/ui'
import { AppIcon } from './icons'
import './client-request-inbox.css'

type ClientRequestInboxProps = {
  isMobile: boolean
  onApproved?: () => void | Promise<void>
}

type ReviewForm = SolicitudClienteReviewPayload & { motivoRechazo: string }

function requestToForm(request: SolicitudCliente): ReviewForm {
  return {
    nombre: request.nombre,
    telefono: request.telefono,
    monto: Number(request.monto),
    carpeta: request.carpeta || '',
    observacion: request.observacion || '',
    tipoDispositivo: request.tipoDispositivo,
    cantidadDispositivos: request.cantidadDispositivos,
    fechaInicio: toInputDate(request.fechaInicio),
    fechaCierre: toInputDate(request.fechaCierre),
    estadoVenta: request.pagoRegistrado ? 'PAGADO' : 'PENDIENTE',
    cuentaAccesoId: request.cuentaAccesoId ?? null,
    motivoRechazo: '',
  }
}

export function ClientRequestInbox({ isMobile, onApproved }: ClientRequestInboxProps) {
  const [requests, setRequests] = useState<SolicitudCliente[]>([])
  const [accounts, setAccounts] = useState<CuentaAcceso[]>([])
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [form, setForm] = useState<ReviewForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false)

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedId) || null,
    [requests, selectedId],
  )
  const formUrl = `${window.location.origin}/formulario-cliente?v=1`

  const loadRequests = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true)
      const [data, accountData] = await Promise.all([
        getClientRequests('PENDIENTE'),
        getCuentas(),
      ])
      setRequests(data)
      setAccounts(accountData)
      setSelectedId((current) =>
        current && data.some((request) => request.id === current)
          ? current
          : data[0]?.id || null,
      )
      setError('')
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'No se pudieron cargar las solicitudes.'))
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRequests()
    const timer = window.setInterval(() => void loadRequests(true), 30000)
    return () => window.clearInterval(timer)
  }, [loadRequests])

  useEffect(() => {
    setForm(selectedRequest ? requestToForm(selectedRequest) : null)
    setMessage('')
    setError('')
    setRejectConfirmOpen(false)
  }, [selectedRequest])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])

  async function copyFormLink() {
    try {
      await navigator.clipboard.writeText(formUrl)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 1800)
    } catch {
      setError('No se pudo copiar el enlace. Puedes seleccionarlo directamente en la parte superior.')
    }
  }

  async function approve() {
    if (!selectedRequest || !form) return
    setError('')
    setMessage('')

    if (!form.nombre.trim() || !form.telefono.trim()) return setError('Nombre y teléfono son obligatorios.')
    if (Number(form.monto) <= 0) return setError('El monto debe ser mayor a cero.')
    if (!form.carpeta.trim()) return setError('El nombre del proyecto es obligatorio.')
    if (!form.cuentaAccesoId) return setError('Selecciona el correo de acceso del cliente.')
    if (!form.fechaInicio || !form.fechaCierre) return setError('Revisa las fechas del servicio.')

    try {
      setSaving(true)
      await approveClientRequest(selectedRequest.id, {
        ...form,
        monto: Number(form.monto),
        cantidadDispositivos: Number(form.cantidadDispositivos),
      })
      setMessage(`Solicitud #${selectedRequest.id} aprobada. El cliente y la venta ya fueron creados.`)
      await loadRequests(true)
      await onApproved?.()
    } catch (approveError) {
      setError(getErrorMessage(approveError, 'No se pudo aprobar la solicitud.'))
    } finally {
      setSaving(false)
    }
  }

  async function reject() {
    if (!selectedRequest || !form) return

    try {
      setSaving(true)
      setError('')
      await rejectClientRequest(selectedRequest.id, form.motivoRechazo)
      setRejectConfirmOpen(false)
      setMessage(`Solicitud #${selectedRequest.id} rechazada.`)
      await loadRequests(true)
    } catch (rejectError) {
      setError(getErrorMessage(rejectError, 'No se pudo rechazar la solicitud.'))
    } finally {
      setSaving(false)
    }
  }

  const countBadge = requests.length > 99 ? '99+' : String(requests.length)

  return (
    <>
      <button
        type="button"
        className="client-request-fab"
        onClick={() => setOpen(true)}
        aria-label={`${requests.length} solicitudes de clientes pendientes`}
        title="Solicitudes del formulario de clientes"
        style={{
          right: isMobile ? 14 : 24,
          bottom: isMobile
            ? 'calc(92px + env(safe-area-inset-bottom, 0px))'
            : 104,
        }}
      >
        <AppIcon name="clientes" size={27} />
        {requests.length > 0 && <span>{countBadge}</span>}
      </button>

      {open && (
        <div className="client-request-overlay" role="dialog" aria-modal="true" aria-label="Solicitudes de clientes">
          <section className="client-request-modal">
            <header className="client-request-header">
              <div>
                <p>FORMULARIO CLIENTE</p>
                <h2>Solicitudes pendientes <span>{requests.length}</span></h2>
              </div>
              <button type="button" className="client-request-close" onClick={() => { setRejectConfirmOpen(false); setOpen(false) }} aria-label="Cerrar">×</button>
            </header>

            <div className="client-request-share">
              <div>
                <strong>Enlace para tus clientes</strong>
                <small>{formUrl}</small>
              </div>
              <div>
                <button type="button" onClick={() => window.open(formUrl, '_blank', 'noopener,noreferrer')}>Abrir</button>
                <button type="button" onClick={copyFormLink}>{linkCopied ? 'Copiado' : 'Copiar enlace'}</button>
              </div>
            </div>

            {message && <div className="client-request-message is-success">{message}</div>}
            {error && <div className="client-request-message is-error">{error}</div>}

            {loading ? (
              <div className="client-request-empty">Cargando solicitudes...</div>
            ) : requests.length === 0 ? (
              <div className="client-request-empty">
                <AppIcon name="shield" size={35} />
                <h3>No hay solicitudes pendientes</h3>
                <p>Cuando un cliente complete el formulario, aparecerá aquí y verás el número en la burbuja.</p>
              </div>
            ) : (
              <div className="client-request-content">
                <aside className="client-request-list">
                  {requests.map((request) => (
                    <button type="button" key={request.id} className={selectedId === request.id ? 'is-active' : ''} onClick={() => setSelectedId(request.id)}>
                      <span className="client-request-avatar">{request.nombre.slice(0, 1).toUpperCase()}</span>
                      <span>
                        <strong>{request.nombre}</strong>
                        <small>{formatCurrencyPen(request.monto)} · {formatDateDisplay(request.createdAt)}</small>
                      </span>
                    </button>
                  ))}
                </aside>

                {form && selectedRequest && (
                  <form className="client-request-review" onSubmit={(event) => { event.preventDefault(); void approve() }}>
                    <div className="client-request-review__title">
                      <div><span>Solicitud #{selectedRequest.id}</span><strong>Revisa y corrige antes de aprobar</strong></div>
                      <small>Recibida {formatDateDisplay(selectedRequest.createdAt)}</small>
                    </div>

                    <label className="is-wide"><span>Nombre completo</span><input value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></label>
                    <label><span>WhatsApp</span><input value={form.telefono} onChange={(event) => setForm({ ...form, telefono: event.target.value })} /></label>
                    <label><span>Monto (S/)</span><input type="number" min="0.01" step="0.01" value={form.monto} onChange={(event) => setForm({ ...form, monto: Number(event.target.value) })} /></label>
                    <label><span>Fecha de inicio</span><input type="date" value={form.fechaInicio} onChange={(event) => setForm({ ...form, fechaInicio: event.target.value })} /></label>
                    <label><span>Próxima fecha de pago</span><input type="date" min={form.fechaInicio || undefined} value={form.fechaCierre} onChange={(event) => setForm({ ...form, fechaCierre: event.target.value })} /></label>
                    <label><span>Estado de pago</span><select value={form.estadoVenta} onChange={(event) => setForm({ ...form, estadoVenta: event.target.value as 'PAGADO' | 'PENDIENTE' })}><option value="PENDIENTE">Pendiente</option><option value="PAGADO">Pagado</option></select></label>
                    <label className="is-wide">
                      <span>Correo de acceso</span>
                      <select
                        value={form.cuentaAccesoId ?? ''}
                        onChange={(event) => setForm({ ...form, cuentaAccesoId: Number(event.target.value) || null })}
                      >
                        <option value="">Selecciona un correo</option>
                        {accounts
                          .filter((account) => account.activa && ((account.free ?? 0) > 0 || account.id === form.cuentaAccesoId))
                          .map((account) => (
                            <option value={account.id} key={account.id}>{account.correo}</option>
                          ))}
                      </select>
                    </label>
                    <label>
                      <span>Cantidad de dispositivos</span>
                      <input type="number" min="1" value={form.cantidadDispositivos} onChange={(event) => setForm({ ...form, cantidadDispositivos: Number(event.target.value) })} />
                      {Number(form.cantidadDispositivos) > 1 && <small style={{ color: '#fbbf24' }}>Confirma con el cliente el costo de los dispositivos adicionales.</small>}
                    </label>
                    <label className="is-wide"><span>Dispositivos</span><input value={form.tipoDispositivo} onChange={(event) => setForm({ ...form, tipoDispositivo: event.target.value })} /></label>
                    <label className="is-wide"><span>Nombre del proyecto</span><input value={form.carpeta} onChange={(event) => setForm({ ...form, carpeta: event.target.value })} placeholder="Nombre para identificar sus chats" /></label>
                    <label className="is-wide"><span>Observación</span><textarea rows={3} value={form.observacion} onChange={(event) => setForm({ ...form, observacion: event.target.value })} /></label>
                    <label className="is-wide"><span>Motivo de rechazo (opcional)</span><input value={form.motivoRechazo} onChange={(event) => setForm({ ...form, motivoRechazo: event.target.value })} placeholder="Solo se guardará si rechazas" /></label>

                    <footer className="client-request-actions">
                      <button type="button" className="is-reject" onClick={() => setRejectConfirmOpen(true)} disabled={saving}>Rechazar</button>
                      <button type="submit" className="is-approve" disabled={saving}>{saving ? 'Guardando...' : 'Aprobar y crear venta'}</button>
                    </footer>
                  </form>
                )}
              </div>
            )}
          </section>

          {rejectConfirmOpen && selectedRequest && (
            <div
              className="client-request-confirm-overlay"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !saving) setRejectConfirmOpen(false)
              }}
            >
              <section className="client-request-confirm" role="alertdialog" aria-modal="true" aria-labelledby="reject-request-title" aria-describedby="reject-request-description">
                <div className="client-request-confirm__icon" aria-hidden="true">!</div>
                <p>CONFIRMAR RECHAZO</p>
                <h3 id="reject-request-title">¿Rechazar esta solicitud?</h3>
                <div id="reject-request-description">
                  La solicitud de <strong>{selectedRequest.nombre}</strong> quedará marcada como rechazada.
                  {form?.motivoRechazo?.trim() && <small>Motivo: {form.motivoRechazo.trim()}</small>}
                </div>
                <footer>
                  <button type="button" className="is-cancel" onClick={() => setRejectConfirmOpen(false)} disabled={saving} autoFocus>Cancelar</button>
                  <button type="button" className="is-confirm" onClick={() => void reject()} disabled={saving}>{saving ? 'Rechazando...' : 'Sí, rechazar'}</button>
                </footer>
              </section>
            </div>
          )}
        </div>
      )}
    </>
  )
}


