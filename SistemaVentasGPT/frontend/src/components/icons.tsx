import type { CSSProperties } from 'react'

type IconName =
  | 'dashboard'
  | 'morosos'
  | 'registro'
  | 'ventas'
  | 'clientes'
  | 'cuentas'
  | 'historial'
  | 'configuracion'
  | 'logout'
  | 'usuario'
  | 'shield'
  | 'whatsapp'
  | 'pago'
  | 'login'

type AppIconProps = {
  name: IconName
  size?: number
  style?: CSSProperties
}

function baseProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
}

export function AppIcon({ name, size = 18, style }: AppIconProps) {
  const props = { ...baseProps(size), style }

  switch (name) {
    case 'dashboard':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="3" width="8" height="5" rx="2" />
          <rect x="13" y="10" width="8" height="11" rx="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" />
        </svg>
      )
    case 'morosos':
      return (
        <svg {...props}>
          <path d="M12 3 4 7v6c0 4.2 2.7 7.8 8 8 5.3-.2 8-3.8 8-8V7l-8-4Z" />
          <path d="M9.5 9.5h5" />
          <path d="M9.5 13.5h5" />
          <path d="M12 9.5v4" />
        </svg>
      )
    case 'registro':
      return (
        <svg {...props}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      )
    case 'ventas':
      return (
        <svg {...props}>
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h10" />
          <path d="M18 15v6" />
        </svg>
      )
    case 'clientes':
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <circle cx="9.5" cy="7" r="4" />
          <path d="M20 8v6" />
          <path d="M23 11h-6" />
        </svg>
      )
    case 'cuentas':
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="M3 10h18" />
          <path d="M7 15h4" />
        </svg>
      )
    case 'historial':
      return (
        <svg {...props}>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 3v5h5" />
          <path d="M12 7v6l4 2" />
        </svg>
      )
    case 'configuracion':
      return (
        <svg {...props}>
          <path d="M12 2v3" />
          <path d="m19.07 4.93-2.12 2.12" />
          <path d="M22 12h-3" />
          <path d="m19.07 19.07-2.12-2.12" />
          <path d="M12 22v-3" />
          <path d="m4.93 19.07 2.12-2.12" />
          <path d="M2 12h3" />
          <path d="m4.93 4.93 2.12 2.12" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      )
    case 'logout':
      return (
        <svg {...props}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="m16 17 5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      )
    case 'usuario':
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...props}>
          <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
          <path d="m9.5 12 1.8 1.8 3.7-3.8" />
        </svg>
      )
    case 'whatsapp':
      return (
        <svg {...props}>
          <path d="M20 11.5A8.5 8.5 0 0 1 7.7 19l-4.2 1 1.1-4A8.5 8.5 0 1 1 20 11.5Z" />
          <path d="M9 8.8c.2-.5.4-.5.7-.5h.6c.2 0 .4 0 .5.4.2.5.8 1.8.9 1.9.1.1.1.3 0 .4l-.4.5c-.1.1-.2.2-.1.4.3.6.8 1.1 1.4 1.5.8.5 1.4.7 1.6.8.2.1.3.1.4-.1l.5-.6c.1-.2.3-.2.5-.1.2.1 1.5.7 1.7.8.2.1.4.2.4.3 0 .1 0 .8-.2 1.1-.2.3-.9 1-1.3 1.1-.4.1-.8.2-2.6-.5-1.8-.8-3-2.7-3.1-2.8-.1-.1-1.3-1.7-1.3-3.2 0-1.5.8-2.2 1-2.5Z" />
        </svg>
      )
    case 'pago':
      return (
        <svg {...props}>
          <path d="M12 1v22" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      )
    case 'login':
      return (
        <svg {...props}>
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <path d="m10 17 5-5-5-5" />
          <path d="M15 12H3" />
        </svg>
      )
    default:
      return null
  }
}
