import { AppIcon } from './icons'

type SidebarItem = {
  key: string
  label: string
  icon: Parameters<typeof AppIcon>[0]['name']
}

type SidebarNavProps = {
  activeKey: string
  items: SidebarItem[]
  onSelect: (key: string) => void
  title: string
  subtitle: string
  userName?: string
  userRole?: string
  onLogout: () => void
}

export function SidebarNav({
  activeKey,
  items,
  onSelect,
  title,
  subtitle,
  userName,
  userRole,
  onLogout,
}: SidebarNavProps) {
  return (
    <aside
      style={{
        background: 'linear-gradient(180deg, #081225 0%, #0b1730 100%)',
        borderTop: '1px solid #1e293b',
        borderRight: '1px solid #1e293b',
        borderBottom: '1px solid #1e293b',
        borderLeft: 'none',
        borderRadius: '0 24px 24px 0',
        minHeight: 'calc(100vh - 32px)',
        padding: '18px 0',
        position: 'sticky',
        top: '16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.30)',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '8px 20px 18px', borderBottom: '1px solid #1e293b' }}>
        <h1
          style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: 800,
            color: '#f8fafc',
            lineHeight: 1.15,
            letterSpacing: '0.3px',
          }}
        >
          {title}
        </h1>
        <p style={{ marginTop: '8px', fontSize: '13px', color: '#94a3b8', lineHeight: 1.4 }}>
          {subtitle}
        </p>
      </div>

      <div style={{ padding: '16px 18px 6px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '14px',
              background: 'rgba(59,130,246,0.18)',
              color: '#bfdbfe',
            }}
          >
            <AppIcon name={userRole === 'ADMIN' ? 'shield' : 'usuario'} size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: '#f8fafc',
                fontWeight: 700,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {userName || 'Usuario'}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase' }}>
              {userRole || 'Operador'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '10px', padding: '18px 14px', flex: 1 }}>
        {items.map((item) => {
          const active = activeKey === item.key

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '14px 16px',
                borderRadius: '16px',
                border: active ? '1px solid #3b82f6' : '1px solid transparent',
                background: active ? 'rgba(37, 99, 235, 0.18)' : 'transparent',
                color: active ? '#ffffff' : '#e2e8f0',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '15px',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <AppIcon name={item.icon} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>

      <div style={{ padding: '0 14px 10px' }}>
        <button
          type="button"
          onClick={onLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderRadius: '16px',
            border: '1px solid rgba(248,113,113,0.24)',
            background: 'rgba(127,29,29,0.18)',
            color: '#fecaca',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          <AppIcon name="logout" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
