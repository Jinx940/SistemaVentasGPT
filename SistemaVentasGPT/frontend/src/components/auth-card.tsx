import type { ReactNode } from 'react'
import { AppIcon } from './icons'

type AuthCardProps = {
  title: string
  subtitle: string
  icon: Parameters<typeof AppIcon>[0]['name']
  children: ReactNode
}

export function AuthCard({ title, subtitle, icon, children }: AuthCardProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '32px 16px',
        background:
          'radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 28%), linear-gradient(135deg, #020617 0%, #0f172a 45%, #111827 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          borderRadius: '28px',
          border: '1px solid rgba(148,163,184,0.18)',
          background: 'rgba(15,23,42,0.92)',
          boxShadow: '0 24px 80px rgba(2,6,23,0.55)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '28px 28px 18px',
            borderBottom: '1px solid rgba(148,163,184,0.12)',
          }}
        >
          <div
            style={{
              width: '54px',
              height: '54px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '18px',
              background: 'rgba(37,99,235,0.18)',
              color: '#dbeafe',
              marginBottom: '18px',
            }}
          >
            <AppIcon name={icon} size={24} />
          </div>
          <h1 style={{ margin: 0, color: '#f8fafc', fontSize: '30px', lineHeight: 1.1 }}>{title}</h1>
          <p style={{ margin: '10px 0 0', color: '#94a3b8', lineHeight: 1.6 }}>{subtitle}</p>
        </div>

        <div style={{ padding: '24px 28px 28px' }}>{children}</div>
      </div>
    </div>
  )
}
