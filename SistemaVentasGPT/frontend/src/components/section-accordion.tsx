import type { CSSProperties, ReactNode } from 'react'
import { AppIcon } from './icons'

type SectionAccordionProps = {
  icon: Parameters<typeof AppIcon>[0]['name']
  title: string
  description?: string
  defaultOpen?: boolean
  iconBoxStyle?: CSSProperties
  summaryValue?: ReactNode
  summaryValueStyle?: CSSProperties
  contentStyle?: CSSProperties
  children: ReactNode
}

export function SectionAccordion({
  icon,
  title,
  description,
  defaultOpen = false,
  iconBoxStyle,
  summaryValue,
  summaryValueStyle,
  contentStyle,
  children,
}: SectionAccordionProps) {
  return (
    <details
      open={defaultOpen}
      style={{
        background: 'rgba(15, 23, 42, 0.88)',
        border: '1px solid #1e293b',
        borderRadius: '18px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
        backdropFilter: 'blur(6px)',
        padding: 0,
        overflow: 'hidden',
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          padding: '18px 20px',
          listStyle: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '14px',
              background: 'rgba(37,99,235,0.14)',
              color: '#bfdbfe',
              flexShrink: 0,
              ...iconBoxStyle,
            }}
          >
            <AppIcon name={icon} />
          </div>

          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '18px' }}>{title}</h2>
            {description ? (
              <p style={{ margin: '6px 0 0', color: '#94a3b8', lineHeight: 1.5 }}>{description}</p>
            ) : null}
          </div>
        </div>

        {summaryValue ? (
          <span
            style={
              summaryValueStyle || {
                display: 'inline-block',
                padding: '7px 12px',
                borderRadius: '10px',
                background: 'rgba(59,130,246,0.16)',
                color: '#bfdbfe',
                fontSize: '12px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }
            }
          >
            {summaryValue}
          </span>
        ) : null}
      </summary>

      <div
        style={{
          display: 'grid',
          gap: '18px',
          padding: '0 20px 20px',
          borderTop: '1px solid rgba(148,163,184,0.08)',
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </details>
  )
}
