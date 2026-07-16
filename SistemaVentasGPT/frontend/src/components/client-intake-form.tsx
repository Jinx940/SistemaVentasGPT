import { useState } from 'react'
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
const formSteps = [
  { number: 1, label: 'Contacto' },
  { number: 2, label: 'Servicio' },
  { number: 3, label: 'Dispositivos' },
] as const

type ClientFormStep = 1 | 2 | 3

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

export function ClientIntakeForm() {
  const [form, setForm] = useState<ClientFormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [requestId, setRequestId] = useState<number | null>(null)
  const [currentStep, setCurrentStep] = useState<ClientFormStep>(1)
  const selectedDevices = [
    ...form.dispositivos,
    form.otroDispositivo.trim(),
  ].filter(Boolean)
  const selectedDeviceCount = selectedDevices.length
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

  function getStepError(step: ClientFormStep) {
    if (step === 1) {
      if (!form.nombre.trim()) return 'Escribe tu nombre completo.'
      if (form.telefono.replace(/\D/g, '').length < 7) return 'Escribe un número de WhatsApp válido.'
    }

    if (step === 2) {
      if (Number(form.monto) <= 0) return 'Escribe el monto acordado.'
      if (!form.carpeta.trim()) return 'Escribe un nombre para identificar tu proyecto y tus chats.'
    }

    if (step === 3 && !selectedDevices.length) return 'Selecciona al menos un dispositivo.'
    return ''
  }

  function showStep(step: ClientFormStep) {
    setError('')
    setCurrentStep(step)
  }

  function advanceStep() {
    const stepError = getStepError(currentStep)
    if (stepError) {
      setError(stepError)
      return
    }

    setError('')
    if (currentStep < 3) setCurrentStep((currentStep + 1) as ClientFormStep)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()

    if (currentStep < 3) {
      advanceStep()
      return
    }

    setError('')

    const phoneDigits = form.telefono.replace(/\D/g, '')
    for (const step of [1, 2, 3] as const) {
      const stepError = getStepError(step)
      if (stepError) {
        setCurrentStep(step)
        setError(stepError)
        return
      }
    }
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
          <button type="button" onClick={() => { setForm(emptyForm); setCurrentStep(1); setRequestId(null) }}>
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
          </div>
        </header>

        <nav className="client-intake-steps" aria-label="Progreso del formulario">
          {formSteps.map((step) => {
            const isActive = currentStep === step.number
            const isComplete = currentStep > step.number
            return (
              <button
                type="button"
                key={step.number}
                className={`${isActive ? 'is-active' : ''} ${isComplete ? 'is-complete' : ''}`.trim()}
                aria-current={isActive ? 'step' : undefined}
                disabled={step.number > currentStep}
                onClick={() => showStep(step.number)}
              >
                <span>{isComplete ? '✓' : step.number}</span>
                <strong>{step.label}</strong>
              </button>
            )
          })}
        </nav>

        <form className="client-intake-form" onSubmit={submit}>
          {error && <div className="client-intake-error" role="alert">{error}</div>}

          {currentStep === 1 && <section className="client-intake-form-section">
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
          </section>}

          {currentStep === 2 && <section className="client-intake-form-section">
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
          </section>}

          {currentStep === 3 && <section className="client-intake-form-section">
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
          </section>}

          <label className="client-intake-honeypot" aria-hidden="true">
            Sitio web
            <input value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} tabIndex={-1} autoComplete="off" />
          </label>

          <div className="client-intake-actions">
            {currentStep > 1 && (
              <button className="client-intake-back" type="button" onClick={() => showStep((currentStep - 1) as ClientFormStep)}>
                Anterior
              </button>
            )}
            <button className="client-intake-submit" type="submit" disabled={submitting}>
              {currentStep < 3 ? 'Siguiente' : submitting ? 'Enviando solicitud...' : 'Enviar mi solicitud'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
