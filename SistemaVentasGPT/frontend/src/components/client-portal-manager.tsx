import { useCallback, useEffect, useState } from 'react'
import {
  getClientPortalAdmin,
  getErrorMessage,
  resetClientPortalCode,
  setClientPortalDeviceStatus,
  setClientPortalStatus,
} from '../api'
import type { Cliente, ClientPortalAdmin } from '../types'
import './client-portal-manager.css'

type Props = {
  cliente: Cliente
  onClose: () => void
  onUpdated: () => Promise<void> | void
}

function formatAccessDate(value: string | null) {
  if (!value) return 'Sin registro'
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function browserLabel(userAgent: string) {
  if (!userAgent) return 'Navegador no identificado'
  if (/Edg/i.test(userAgent)) return 'Microsoft Edge'
  if (/Chrome/i.test(userAgent)) return 'Google Chrome'
  if (/Firefox/i.test(userAgent)) return 'Mozilla Firefox'
  if (/Safari/i.test(userAgent)) return 'Safari'
  return 'Navegador web'
}

export function ClientPortalManager({ cliente, onClose, onUpdated }: Props) {
  const [data, setData] = useState<ClientPortalAdmin | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [newCode, setNewCode] = useState('')
  const [copied, setCopied] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await getClientPortalAdmin(cliente.id))
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'No se pudo cargar el portal.'))
    } finally {
      setLoading(false)
    }
  }, [cliente.id])

  useEffect(() => {
    void load()
  }, [load])

  const generateCode = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await resetClientPortalCode(cliente.id)
      setNewCode(result.codigo)
      await load()
      await onUpdated()
    } catch (actionError) {
      setError(getErrorMessage(actionError, 'No se pudo generar el código.'))
    } finally {
      setBusy(false)
    }
  }

  const togglePortal = async () => {
    if (!data) return
    setBusy(true)
    setError('')
    try {
      await setClientPortalStatus(cliente.id, !data.activo)
      await load()
      await onUpdated()
    } catch (actionError) {
      setError(getErrorMessage(actionError, 'No se pudo actualizar el portal.'))
    } finally {
      setBusy(false)
    }
  }

  const toggleDevice = async (deviceId: number, activo: boolean) => {
    setBusy(true)
    setError('')
    try {
      await setClientPortalDeviceStatus(cliente.id, deviceId, activo)
      await load()
      await onUpdated()
    } catch (actionError) {
      setError(getErrorMessage(actionError, 'No se pudo actualizar el dispositivo.'))
    } finally {
      setBusy(false)
    }
  }

  const copy = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(key)
    window.setTimeout(() => setCopied(''), 1800)
  }

  return (
    <div className="portal-manager-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="portal-manager"
        role="dialog"
        aria-modal="true"
        aria-label={`Portal de ${cliente.nombre}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="portal-manager__header">
          <div>
            <span className="portal-manager__eyebrow">CONTROL DE ACCESO</span>
            <h2>Portal de {cliente.nombre}</h2>
            <p>Administra el código, las IP y los dispositivos autorizados.</p>
          </div>
          <button className="portal-manager__close" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        </header>

        {error && <div className="portal-manager__error">{error}</div>}
        {loading ? (
          <div className="portal-manager__loading">Preparando accesos…</div>
        ) : data ? (
          <div className="portal-manager__body">
            <div className="portal-manager__overview">
              <div className="portal-manager__status-card">
                <span>Estado</span>
                <strong className={data.activo ? 'is-active' : ''}>{data.activo ? 'Activo' : 'Desactivado'}</strong>
                <small>{data.configurado ? 'Código configurado' : 'Falta generar el código'}</small>
              </div>
              <div className="portal-manager__status-card">
                <span>Dispositivos</span>
                <strong>{data.dispositivos.filter((item) => item.activo).length} / {data.limiteDispositivos}</strong>
                <small>Límite tomado de su venta</small>
              </div>
            </div>

            <div className="portal-manager__link-row">
              <div><span>Enlace del cliente</span><strong>{data.portalUrl}</strong></div>
              <button type="button" onClick={() => copy(data.portalUrl, 'url')}>{copied === 'url' ? 'Copiado' : 'Copiar'}</button>
            </div>

            {newCode && (
              <div className="portal-manager__code">
                <div><span>Código nuevo — compártelo una sola vez</span><strong>{newCode}</strong></div>
                <button type="button" onClick={() => copy(newCode, 'code')}>{copied === 'code' ? 'Copiado' : 'Copiar código'}</button>
              </div>
            )}

            <div className="portal-manager__actions">
              <button className="primary" type="button" disabled={busy} onClick={generateCode}>
                {data.configurado ? 'Cambiar código' : 'Activar y generar código'}
              </button>
              {data.configurado && (
                <button className="secondary" type="button" disabled={busy} onClick={togglePortal}>
                  {data.activo ? 'Desactivar portal' : 'Activar portal'}
                </button>
              )}
            </div>

            <div className="portal-manager__devices-head">
              <div><h3>Dispositivos registrados</h3><p>La IP se actualiza cada vez que el cliente usa el portal.</p></div>
            </div>

            <div className="portal-manager__devices">
              {data.dispositivos.length === 0 ? (
                <div className="portal-manager__empty">Aún no hay dispositivos. Aparecerán después del primer ingreso del cliente.</div>
              ) : data.dispositivos.map((device) => (
                <article className={`portal-device ${device.activo ? '' : 'is-blocked'}`} key={device.id}>
                  <div className="portal-device__icon">{device.activo ? '✓' : '×'}</div>
                  <div className="portal-device__main">
                    <div className="portal-device__title"><strong>{device.nombre}</strong><span>{device.activo ? 'Autorizado' : 'Bloqueado'}</span></div>
                    <div className="portal-device__meta"><span>IP <b>{device.ip}</b></span><span>{browserLabel(device.userAgent)}</span><span>Último acceso {formatAccessDate(device.lastSeenAt)}</span></div>
                  </div>
                  <button type="button" disabled={busy} onClick={() => toggleDevice(device.id, !device.activo)}>
                    {device.activo ? 'Bloquear' : 'Autorizar'}
                  </button>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
