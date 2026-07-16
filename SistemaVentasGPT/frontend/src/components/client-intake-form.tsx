import { useMemo, useState } from 'react'
import { getErrorMessage, submitClientRequest } from '../api'
import { AppIcon } from './icons'
import './client-intake.css'

const phoneCountries = [
  { label: 'Perú', code: '51' },
  { label: 'México', code: '52' },
  { label: 'Colombia', code: '57' },
  { label: 'Chile', code: '56' },
  { label: 'Argentina', code: '54' },
  { label: 'Ecuador', code: '593' },
  { label: 'España', code: '34' },
  { label: 'EE. UU.', code: '1' },
]

const deviceOptions = ['Celular', 'Laptop', 'PC', 'Tablet']

type ClientFormState = {
  nombre: string
  countryCode: string
  telefono: string
  monto: string
  carpeta: string
  dispositivos: string[]
  otroDispositivo: string
  pagoRegistrado: 'SI' | 'NO'
  observacion: string
  website: string
}

const emptyForm: ClientFormState = {
  nombre: '',
  countryCode: '51',
  telefono: '',
  monto: '',
  carpeta: '',
  dispositivos: [],
  otroDispositivo: '',
  pagoRegistrado: 'NO',
  observacion: '',
  website: '',
}

function getTodayLabel() {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
}

export function ClientIntakeForm() {
  const [form, setForm] = useState<ClientFormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [requestId, setRequestId] = useState<number | null>(null)
  const todayLabel = useMemo(getTodayLabel, [])
  const selectedDeviceCount = form.dispositivos.length + (form.otroDispositivo.trim() ? 1 : 0)
  const additionalDeviceCount = Math.max(0, selectedDeviceCount - 1)

  function toggleDevice(device: string) {
    setForm((current) => {
      const dispositivos = current.dispositivos.includes(device)
        ? current.dispositivos.filter((item) => item !== device)
        : [...current.dispositivos, device]
      return {
        ...current,
        dispositivos,
      }
    })
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')

    const phoneDigits = form.telefono.replace(/\D/g, '')
    const selectedDevices = [
      ...form.dispositivos,
      form.otroDispositivo.trim(),
    ].filter(Boolean)

    if (!form.nombre.trim()) return setError('Escribe tu nombre completo.')
    if (phoneDigits.length < 7) return setError('Escribe un número de WhatsApp válido.')
    if (Number(form.monto) <= 0) return setError('Escribe el monto acordado.')
    if (!form.carpeta.trim()) return setError('Escribe un nombre para identificar tu proyecto y tus chats.')
    if (!selectedDevices.length) return setError('Selecciona al menos un dispositivo.')
    try {
      setSubmitting(true)
      const response = await submitClientRequest({
        nombre: form.nombre.trim(),
        telefono: `${form.countryCode}${phoneDigits}`,
        monto: Number(form.monto),
        carpeta: form.carpeta.trim(),
        observacion: form.observacion.trim(),
        tipoDispositivo: selectedDevices,
        cantidadDispositivos: selectedDevices.length,
        pagoRegistrado: form.pagoRegistrado === 'SI',
        website: form.website,
      })
      setRequestId(response.id)
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'No se pudo enviar la solicitud.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (requestId) {
    return (
      <main className="client-intake-page">
        <section className="client-intake-success" aria-live="polite">
          <div className="client-intake-success__icon"><AppIcon name="shield" size={34} /></div>
          <p className="client-intake-eyebrow">SOLICITUD RECIBIDA</p>
          <h1>¡Gracias! Tus datos ya fueron enviados.</h1>
          <p>
            Tu solicitud <strong>#{requestId}</strong> quedó pendiente de revisión. El administrador
            podrá aprobarla o contactarte si necesita confirmar algún dato.
          </p>
          <button type="button" onClick={() => { setForm(emptyForm); setRequestId(null) }}>
            Enviar otra solicitud
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="client-intake-page">
      <section className="client-intake-shell">
        <header className="client-intake-header">
          <div className="client-intake-brand"><AppIcon name="clientes" size={26} /></div>
          <div>
            <p className="client-intake-eyebrow">SISTEMA DE COBRO</p>
            <h1>Solicita tu servicio</h1>
            <p>Completa este formulario. Revisaremos tus datos antes de activar el servicio.</p>
          </div>
        </header>

        <div className="client-intake-date">
          <AppIcon name="historial" size={19} />
          <span>Tu fecha de inicio será <strong>{todayLabel}</strong>. La confirmaremos antes de aprobar tu solicitud.</span>
        </div>

        <form className="client-intake-form" onSubmit={submit}>
          {error && <div className="client-intake-error" role="alert">{error}</div>}

          <section className="client-intake-form-section">
            <div className="client-intake-section-title">
              <span>1</span>
              <div><strong>Datos de contacto</strong></div>
            </div>
            <div className="client-intake-section-grid">

          <label className="client-intake-field client-intake-field--wide">
            <span>Nombre completo *</span>
            <input value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} placeholder="Nombres y apellidos" autoComplete="name" />
          </label>

          <label className="client-intake-field">
            <span>País *</span>
            <select value={form.countryCode} onChange={(event) => setForm({ ...form, countryCode: event.target.value })}>
              {phoneCountries.map((country) => <option value={country.code} key={country.code}>{country.label} (+{country.code})</option>)}
            </select>
          </label>

          <label className="client-intake-field">
            <span>WhatsApp *</span>
            <input value={form.telefono} onChange={(event) => setForm({ ...form, telefono: event.target.value })} placeholder="999 999 999" inputMode="tel" autoComplete="tel" />
          </label>
            </div>
          </section>

          <section className="client-intake-form-section">
            <div className="client-intake-section-title">
              <span>2</span>
              <div><strong>Información del servicio</strong></div>
            </div>
            <div className="client-intake-section-grid">

          <label className="client-intake-field">
            <span>Pago mensual acordado *</span>
            <div className="client-intake-money-input">
              <strong>S/</strong>
              <input value={form.monto} onChange={(event) => setForm({ ...form, monto: event.target.value })} placeholder="0.00" inputMode="decimal" type="number" min="0.01" step="0.01" aria-label="Pago mensual acordado en soles" />
            </div>
          </label>

          <label className="client-intake-field">
            <span>Nombre del proyecto *</span>
            <input value={form.carpeta} onChange={(event) => setForm({ ...form, carpeta: event.target.value })} placeholder="Ejemplo: Ventas de mi negocio" />
          </label>
            </div>
          </section>

          <section className="client-intake-form-section">
            <div className="client-intake-section-title">
              <span>3</span>
              <div><strong>Dispositivos y pago</strong></div>
            </div>
            <div className="client-intake-section-grid">

          <fieldset className="client-intake-field client-intake-field--wide client-intake-devices">
            <legend>¿En qué dispositivo usarás el servicio? *</legend>
            <div className="client-intake-chip-list">
              {deviceOptions.map((device) => (
                <button type="button" key={device} aria-pressed={form.dispositivos.includes(device)} className={form.dispositivos.includes(device) ? 'is-selected' : ''} onClick={() => toggleDevice(device)}>
                  {device}
                </button>
              ))}
            </div>
            <input
              value={form.otroDispositivo}
              onChange={(event) => setForm({ ...form, otroDispositivo: event.target.value })}
              placeholder="Otro dispositivo (opcional)"
            />
          </fieldset>

          <label className="client-intake-field">
            <span>¿En cuántos dispositivos lo usarás? *</span>
            <input value={selectedDeviceCount} type="number" min="0" readOnly aria-readonly="true" />
          </label>

          <label className="client-intake-field">
            <span>¿Ya realizaste el pago mensual? *</span>
            <select value={form.pagoRegistrado} onChange={(event) => setForm({ ...form, pagoRegistrado: event.target.value as 'SI' | 'NO' })}>
              <option value="NO">Aún no he pagado</option>
              <option value="SI">Sí, ya realicé el pago</option>
            </select>
          </label>

          {additionalDeviceCount > 0 && (
            <div className="client-intake-device-cost" role="note">
              <span className="client-intake-currency-badge" aria-hidden="true">S/</span>
              <span>
                <strong>{additionalDeviceCount === 1 ? 'Has elegido 1 dispositivo adicional' : `Has elegido ${additionalDeviceCount} dispositivos adicionales`}</strong>
                El primer dispositivo está incluido. Los adicionales tienen un costo en soles. Te confirmaremos el importe exacto antes de activar el servicio.
              </span>
            </div>
          )}

          <label className="client-intake-field client-intake-field--wide">
            <span>Observación</span>
            <textarea value={form.observacion} onChange={(event) => setForm({ ...form, observacion: event.target.value })} rows={4} placeholder="Algún dato adicional que debamos saber" />
          </label>
            </div>
          </section>

          <label className="client-intake-honeypot" aria-hidden="true">
            Sitio web
            <input value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} tabIndex={-1} autoComplete="off" />
          </label>

          <button className="client-intake-submit" type="submit" disabled={submitting}>
            {submitting ? 'Enviando solicitud...' : 'Enviar mi solicitud'}
          </button>
          <p className="client-intake-privacy">Tus datos solo se usarán para registrar y administrar el servicio solicitado.</p>
        </form>
      </section>
    </main>
  )
}
