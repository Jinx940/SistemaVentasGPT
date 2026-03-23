import type { CSSProperties } from 'react'
import type { ActividadSistema, HistorialBaja, Pago, PagoResumenResponse, WhatsAppLog } from '../types'
import { formatCurrencyPen, formatDateDisplay, normalizeText } from '../utils/ui'
import { DashboardMiniStat } from './dashboard'
import { AppIcon } from './icons'

type HistorySectionProps = {
  isAdmin: boolean
  historialBajas: HistorialBaja[]
  loadingHistorial: boolean
  pagos: Pago[]
  loadingPagos: boolean
  pagosResumen: PagoResumenResponse
  loadingPagosResumen: boolean
  actividad: ActividadSistema[]
  loadingActividad: boolean
  whatsAppLogs: WhatsAppLog[]
  loadingWhatsAppLogs: boolean
  onClearHistory: () => void
}

function card(title: string, icon: Parameters<typeof AppIcon>[0]['name']) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
      <div
        style={{
          width: '38px',
          height: '38px',
          display: 'grid',
          placeItems: 'center',
          borderRadius: '12px',
          background: 'rgba(37,99,235,0.14)',
          color: '#bfdbfe',
        }}
      >
        <AppIcon name={icon} />
      </div>
      <h2 style={{ margin: 0, color: '#f8fafc' }}>{title}</h2>
    </div>
  )
}

function sectionCardStyle(): CSSProperties {
  return {
    background: 'rgba(15, 23, 42, 0.88)',
    border: '1px solid #1e293b',
    borderRadius: '18px',
    padding: '20px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
    backdropFilter: 'blur(6px)',
  }
}

const tableHeadStyle: CSSProperties = {
  textAlign: 'left',
  padding: '12px 10px',
  borderBottom: '1px solid #334155',
  color: '#cbd5e1',
  background: '#0f172a',
  fontSize: '13px',
  whiteSpace: 'nowrap',
}

const tableCellStyle: CSSProperties = {
  padding: '12px 10px',
  borderBottom: '1px solid #1e293b',
  verticalAlign: 'top',
  color: '#e5e7eb',
  fontSize: '13px',
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  lineHeight: 1.45,
}

function estadoBadge(estado: string): CSSProperties {
  const base: CSSProperties = {
    display: 'inline-block',
    padding: '6px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  }

  if (estado === 'PAGADO') return { ...base, background: '#052e16', color: '#86efac' }
  if (estado === 'PENDIENTE') return { ...base, background: '#78350f', color: '#fde68a' }
  if (estado === 'MENSAJE_ENVIADO') return { ...base, background: '#1e3a8a', color: '#bfdbfe' }
  if (estado === 'BAJA') return { ...base, background: '#7f1d1d', color: '#fecaca' }

  return { ...base, background: '#1e293b', color: '#cbd5e1' }
}

function EmptyText({ text }: { text: string }) {
  return <p style={{ margin: 0, color: '#94a3b8' }}>{text}</p>
}

export function HistorySection({
  isAdmin,
  historialBajas,
  loadingHistorial,
  pagos,
  loadingPagos,
  pagosResumen,
  loadingPagosResumen,
  actividad,
  loadingActividad,
  whatsAppLogs,
  loadingWhatsAppLogs,
  onClearHistory,
}: HistorySectionProps) {
  const historialBajasOrdenado = [...historialBajas].sort((a, b) => a.id - b.id)
  const pagosOrdenados = [...pagos].sort((a, b) => a.id - b.id)
  const actividadOrdenada = [...actividad].sort((a, b) => a.id - b.id)
  const whatsAppLogsOrdenados = [...whatsAppLogs].sort((a, b) => a.id - b.id)

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div style={sectionCardStyle()}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: '18px',
          }}
        >
          {card('Resumen de pagos', 'pago')}
          {isAdmin && (
            <button
              type="button"
              onClick={onClearHistory}
              style={{
                padding: '8px 12px',
                border: 'none',
                borderRadius: '8px',
                background: '#7f1d1d',
                color: '#fee2e2',
                cursor: 'pointer',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              Limpiar historial
            </button>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            marginBottom: '18px',
          }}
        >
          <DashboardMiniStat
            label="Cobrado acumulado"
            value={loadingPagosResumen ? '...' : formatCurrencyPen(pagosResumen.totalCobrado)}
            accent="#4ade80"
          />
          <DashboardMiniStat
            label="Cobrado este mes"
            value={loadingPagosResumen ? '...' : formatCurrencyPen(pagosResumen.cobradoMesActual)}
            accent="#60a5fa"
          />
          <DashboardMiniStat
            label="Pagos de hoy"
            value={loadingPagosResumen ? '...' : formatCurrencyPen(pagosResumen.pagosHoy)}
            accent="#fbbf24"
          />
          <DashboardMiniStat
            label="Deuda pendiente"
            value={loadingPagosResumen ? '...' : formatCurrencyPen(pagosResumen.deudaPendienteTotal)}
            accent="#f87171"
          />
        </div>

        {loadingPagosResumen ? (
          <EmptyText text="Cargando resumen de pagos..." />
        ) : pagosResumen.topDeudores.length === 0 ? (
          <EmptyText text="No hay deudores pendientes en este momento." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '920px' }}>
              <thead>
                <tr style={{ background: '#0f172a' }}>
                  <th style={tableHeadStyle}>Cliente</th>
                  <th style={tableHeadStyle}>Teléfono</th>
                  <th style={tableHeadStyle}>Deuda pendiente</th>
                  <th style={tableHeadStyle}>Ventas pendientes</th>
                  <th style={tableHeadStyle}>Último cierre</th>
                </tr>
              </thead>
              <tbody>
                {pagosResumen.topDeudores.map((row) => (
                  <tr key={row.clienteId}>
                    <td style={tableCellStyle}>{row.clienteNombre}</td>
                    <td style={tableCellStyle}>{row.telefono || '-'}</td>
                    <td style={tableCellStyle}>{formatCurrencyPen(row.deudaPendiente)}</td>
                    <td style={tableCellStyle}>{row.ventasPendientes}</td>
                    <td style={tableCellStyle}>{formatDateDisplay(row.ultimoCierre)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={sectionCardStyle()}>
        {card('Historial de bajas', 'historial')}
        {loadingHistorial ? (
          <EmptyText text="Cargando historial..." />
        ) : historialBajas.length === 0 ? (
          <EmptyText text="No hay historial de bajas." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
              <thead>
                <tr style={{ background: '#0f172a' }}>
                  <th style={tableHeadStyle}>N°</th>
                  <th style={tableHeadStyle}>Cliente</th>
                  <th style={tableHeadStyle}>Teléfono</th>
                  <th style={tableHeadStyle}>Detalle</th>
                  <th style={tableHeadStyle}>Fecha de baja</th>
                </tr>
              </thead>
              <tbody>
                {historialBajasOrdenado.map((row, index) => (
                  <tr key={row.id}>
                    <td style={tableCellStyle}>{index + 1}</td>
                    <td style={tableCellStyle}>{row.clienteNombre}</td>
                    <td style={tableCellStyle}>{row.telefono || '-'}</td>
                    <td style={tableCellStyle}>{row.detalle || '-'}</td>
                    <td style={tableCellStyle}>{formatDateDisplay(row.fechaBaja)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={sectionCardStyle()}>
        {card('Historial de pagos', 'pago')}
        {loadingPagos ? (
          <EmptyText text="Cargando pagos..." />
        ) : pagos.length === 0 ? (
          <EmptyText text="No hay pagos recientes." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1200px' }}>
              <thead>
                <tr style={{ background: '#0f172a' }}>
                  <th style={tableHeadStyle}>N°</th>
                  <th style={tableHeadStyle}>Cliente</th>
                  <th style={tableHeadStyle}>Teléfono</th>
                  <th style={tableHeadStyle}>Fecha de pago</th>
                  <th style={tableHeadStyle}>Monto pagado</th>
                  <th style={tableHeadStyle}>Meses</th>
                  <th style={tableHeadStyle}>Registrado por</th>
                  <th style={tableHeadStyle}>Cuenta</th>
                  <th style={tableHeadStyle}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {pagosOrdenados.map((row, index) => (
                  <tr key={row.id}>
                    <td style={tableCellStyle}>{index + 1}</td>
                    <td style={tableCellStyle}>{row.venta?.cliente?.nombre || '-'}</td>
                    <td style={tableCellStyle}>{row.venta?.cliente?.telefono || '-'}</td>
                    <td style={tableCellStyle}>{formatDateDisplay(row.fechaPago)}</td>
                    <td style={tableCellStyle}>{formatCurrencyPen(Number(row.monto || 0))}</td>
                    <td style={tableCellStyle}>{row.mesesPagados}</td>
                    <td style={tableCellStyle}>{row.usuario?.nombre || '-'}</td>
                    <td style={tableCellStyle}>{row.venta?.cuentaAcceso?.correo || '-'}</td>
                    <td style={tableCellStyle}>
                      <span style={estadoBadge(row.venta?.estado || '-')}>{row.venta?.estado || '-'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={sectionCardStyle()}>
        {card('Actividad reciente', 'dashboard')}
        {loadingActividad ? (
          <EmptyText text="Cargando actividad..." />
        ) : actividad.length === 0 ? (
          <EmptyText text="No hay actividad reciente." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
              <thead>
                <tr style={{ background: '#0f172a' }}>
                  <th style={tableHeadStyle}>N°</th>
                  <th style={tableHeadStyle}>Acción</th>
                  <th style={tableHeadStyle}>Entidad</th>
                  <th style={tableHeadStyle}>Usuario</th>
                  <th style={tableHeadStyle}>Detalle</th>
                  <th style={tableHeadStyle}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {actividadOrdenada.map((row, index) => (
                  <tr key={row.id}>
                    <td style={tableCellStyle}>{index + 1}</td>
                    <td style={tableCellStyle}>{normalizeText(row.accion)}</td>
                    <td style={tableCellStyle}>
                      {normalizeText(row.entidad)}
                      {row.entidadId ? ` #${row.entidadId}` : ''}
                    </td>
                    <td style={tableCellStyle}>{row.usuario?.nombre || '-'}</td>
                    <td style={tableCellStyle}>{row.descripcion || '-'}</td>
                    <td style={tableCellStyle}>{formatDateDisplay(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={sectionCardStyle()}>
        {card('Logs de WhatsApp', 'whatsapp')}
        {loadingWhatsAppLogs ? (
          <EmptyText text="Cargando logs..." />
        ) : whatsAppLogs.length === 0 ? (
          <EmptyText text="No hay logs de WhatsApp." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
              <thead>
                <tr style={{ background: '#0f172a' }}>
                  <th style={tableHeadStyle}>N°</th>
                  <th style={tableHeadStyle}>Cliente</th>
                  <th style={tableHeadStyle}>Teléfono</th>
                  <th style={tableHeadStyle}>Fecha objetivo</th>
                  <th style={tableHeadStyle}>Estado</th>
                  <th style={tableHeadStyle}>Detalle</th>
                  <th style={tableHeadStyle}>Creado</th>
                </tr>
              </thead>
              <tbody>
                {whatsAppLogsOrdenados.map((row, index) => (
                  <tr key={row.id}>
                    <td style={tableCellStyle}>{index + 1}</td>
                    <td style={tableCellStyle}>{row.clienteNombre || '-'}</td>
                    <td style={tableCellStyle}>{row.telefono || '-'}</td>
                    <td style={tableCellStyle}>{formatDateDisplay(row.fechaObjetivo)}</td>
                    <td style={tableCellStyle}>{row.estado || '-'}</td>
                    <td style={tableCellStyle}>{row.detalle || '-'}</td>
                    <td style={tableCellStyle}>{formatDateDisplay(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
