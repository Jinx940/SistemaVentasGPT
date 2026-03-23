import type { CSSProperties } from 'react'
import type { CuentaAcceso, Venta } from '../types'
import { formatDateDisplay } from '../utils/ui'

const sharedCardStyle: CSSProperties = {
  background: 'rgba(15, 23, 42, 0.88)',
  border: '1px solid rgba(148, 163, 184, 0.12)',
  borderRadius: '20px',
  boxShadow: '0 14px 40px rgba(0,0,0,0.26)',
  padding: '20px',
}

export function Alert({ type, text }: { type: 'error' | 'success'; text: string }) {
  const styles =
    type === 'error'
      ? { background: '#450a0a', color: '#fecaca', border: '1px solid #7f1d1d' }
      : { background: '#052e16', color: '#bbf7d0', border: '1px solid #166534' }

  return (
    <div
      style={{
        marginBottom: '16px',
        padding: '12px 14px',
        borderRadius: '12px',
        ...styles,
      }}
    >
      {text}
    </div>
  )
}

export function StatCard({
  title,
  value,
  accent,
}: {
  title: string
  value: string
  accent?: string
}) {
  return (
    <div style={sharedCardStyle}>
      <div style={{ color: '#94a3b8', marginBottom: '8px' }}>{title}</div>
      <div style={{ fontSize: '32px', fontWeight: 700, color: accent || '#f8fafc' }}>{value}</div>
    </div>
  )
}

export function DashboardMiniStat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: string
}) {
  return (
    <div
      style={{
        borderRadius: '16px',
        border: '1px solid rgba(148,163,184,0.18)',
        background: 'rgba(15,23,42,0.76)',
        padding: '14px 16px',
      }}
    >
      <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>{label}</div>
      <div style={{ color: accent, fontSize: '22px', fontWeight: 800 }}>{value}</div>
    </div>
  )
}

export function DashboardProgressRow({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) {
  const percentage = Math.round((value / Math.max(1, total)) * 100)

  return (
    <div
      style={{
        borderRadius: '16px',
        border: '1px solid rgba(148,163,184,0.12)',
        background: 'rgba(15,23,42,0.68)',
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
        <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{label}</div>
        <div style={{ color, fontWeight: 800 }}>{value}</div>
      </div>
      <div style={{ height: '10px', borderRadius: '999px', background: '#0f172a', overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.min(100, percentage)}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${color}, rgba(255,255,255,0.92))`,
          }}
        />
      </div>
      <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '12px' }}>{percentage}% del total</div>
    </div>
  )
}

export function DashboardDonutChart({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: Array<{ label: string; value: number; color: string }>
  centerValue: string
  centerLabel: string
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const size = 180
  const strokeWidth = 20
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const donutSegments = segments.reduce(
    (acc, segment) => {
      const ratio = total ? segment.value / total : 0
      const dash = circumference * ratio

      return {
        offset: acc.offset + dash,
        items: [
          ...acc.items,
          {
            ...segment,
            dashArray: `${dash} ${circumference - dash}`,
            dashOffset: -acc.offset,
          },
        ],
      }
    },
    {
      offset: 0,
      items: [] as Array<{ label: string; value: number; color: string; dashArray: string; dashOffset: number }>,
    }
  ).items

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px minmax(0, 1fr)',
        gap: '18px',
        alignItems: 'center',
      }}
    >
      <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#132033" strokeWidth={strokeWidth} />
          {donutSegments.map((segment) => (
            <circle
              key={segment.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={segment.dashArray}
              strokeDashoffset={segment.dashOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ))}
        </svg>

        <div
          style={{
            position: 'absolute',
            inset: '26px',
            borderRadius: '999px',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(2, 6, 23, 0.92)',
            border: '1px solid rgba(148,163,184,0.12)',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ color: '#f8fafc', fontSize: '28px', fontWeight: 800 }}>{centerValue}</div>
            <div style={{ color: '#94a3b8', fontSize: '12px' }}>{centerLabel}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '10px' }}>
        {segments.map((segment) => {
          const percentage = total ? Math.round((segment.value / total) * 100) : 0
          return (
            <div
              key={segment.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '14px',
                alignItems: 'center',
                borderRadius: '14px',
                padding: '10px 12px',
                background: 'rgba(15,23,42,0.7)',
                border: '1px solid rgba(148,163,184,0.12)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '999px',
                    background: segment.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{segment.label}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#f8fafc', fontWeight: 800 }}>{segment.value}</div>
                <div style={{ color: '#94a3b8', fontSize: '12px' }}>{percentage}%</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function DashboardBarChart({
  items,
  valueFormatter,
}: {
  items: Array<{ label: string; value: number; subtitle?: string; color: string }>
  valueFormatter: (value: number) => string
}) {
  const maxValue = Math.max(1, ...items.map((item) => item.value))

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      {items.map((item) => {
        const ratio = Math.max(6, Math.round((item.value / maxValue) * 100))

        return (
          <div key={item.label} style={{ display: 'grid', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#f8fafc', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </div>
                {item.subtitle && (
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>{item.subtitle}</div>
                )}
              </div>
              <div style={{ color: '#e2e8f0', fontWeight: 700, whiteSpace: 'nowrap' }}>
                {valueFormatter(item.value)}
              </div>
            </div>
            <div style={{ height: '12px', borderRadius: '999px', background: '#0f172a', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, ratio)}%`,
                  height: '100%',
                  borderRadius: '999px',
                  background: `linear-gradient(90deg, ${item.color}, rgba(255,255,255,0.88))`,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DashboardCapacityChart({ items }: { items: CuentaAcceso[] }) {
  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      {items.map((item) => {
        const total = Math.max(1, item.capacidad || 0)
        const used = Math.min(total, item.used || 0)
        const free = Math.max(0, total - used)
        const ratio = Math.round((used / total) * 100)

        return (
          <div key={item.id} style={{ display: 'grid', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#f8fafc', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.correo}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>
                  {item.activa ? 'Activa' : 'Inactiva'}
                </div>
              </div>
              <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{used}/{total}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `${used}fr ${Math.max(1, free)}fr`, height: '12px', borderRadius: '999px', overflow: 'hidden', background: '#0f172a' }}>
              <div style={{ background: ratio >= 80 ? '#f97316' : '#38bdf8' }} />
              <div style={{ background: '#1e293b' }} />
            </div>
            <div style={{ color: '#94a3b8', fontSize: '12px' }}>{ratio}% ocupado</div>
          </div>
        )
      })}
    </div>
  )
}

export function DashboardMetricLine({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 140px) minmax(0, 1fr)',
        gap: '12px',
        alignItems: 'start',
        padding: '10px 0',
        borderBottom: '1px solid rgba(148,163,184,0.12)',
      }}
    >
      <span style={{ color: '#94a3b8', lineHeight: 1.35 }}>{label}</span>
      <span
        style={{
          color: strong ? '#f8fafc' : '#e2e8f0',
          fontWeight: strong ? 800 : 700,
          textAlign: 'right',
          lineHeight: 1.35,
          minWidth: 0,
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </span>
    </div>
  )
}

export function DashboardSalesList({ items, emptyText }: { items: Venta[]; emptyText: string }) {
  if (!items.length) {
    return <p style={{ margin: 0, color: '#94a3b8' }}>{emptyText}</p>
  }

  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      {items.slice(0, 8).map((item) => (
        <div
          key={item.id}
          style={{
            borderRadius: '14px',
            padding: '12px 14px',
            background: 'rgba(15,23,42,0.72)',
            border: '1px solid rgba(148,163,184,0.12)',
          }}
        >
          <div style={{ color: '#f8fafc', fontWeight: 700 }}>{item.cliente?.nombre || 'Sin nombre'}</div>
          <div style={{ marginTop: '4px', color: '#94a3b8', fontSize: '12px' }}>
            {item.cuentaAcceso?.correo || 'Sin cuenta asignada'}
          </div>
          <div style={{ marginTop: '8px', color: '#cbd5e1', fontSize: '13px' }}>
            Cierre: <b>{formatDateDisplay(item.fechaCierre)}</b>
          </div>
        </div>
      ))}
    </div>
  )
}
