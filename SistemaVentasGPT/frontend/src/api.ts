import type {
  ActividadSistema,
  AuthSecurityResponse,
  AuthMeResponse,
  AuthPayload,
  AuthResponse,
  AuthStatusResponse,
  BootstrapPayload,
  ChangePasswordPayload,
  Cliente,
  ClientePayload,
  CuentaAcceso,
  CuentaPayload,
  DashboardResumenQuery,
  DashboardResumenResponse,
  HealthStatusResponse,
  HistorialBaja,
  PagarVentaPayload,
  Pago,
  PagoResumenResponse,
  UsuarioPayload,
  UsuarioSistema,
  Venta,
  VentaPayload,
  VentasQuery,
  VentasResponse,
  WhatsAppConfig,
  WhatsAppConfigPayload,
  WhatsAppChatMessage,
  WhatsAppChatReplyPayload,
  WhatsAppChatReplyResponse,
  WhatsAppChatThread,
  WhatsAppLog,
  WhatsAppReminderResponse,
  WhatsAppTestPayload,
  WhatsAppTestResponse,
} from './types'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const AUTH_TOKEN_KEY = 'sistema-cobro-auth-token'

type QueryValue = string | number | boolean | null | undefined

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function buildQueryString(params: Record<string, QueryValue>) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return
    searchParams.set(key, String(value))
  })

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

export function isUnauthorizedError(error: unknown) {
  return error instanceof ApiError && error.status === 401
}

export function getStoredAuthToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY) || ''
}

export function setStoredAuthToken(token: string) {
  if (!token) {
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
    return
  }

  window.localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearStoredAuthToken() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY)
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers || {})
  const token = getStoredAuthToken()

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message =
      typeof data?.error === 'string'
        ? data.error
        : typeof data?.message === 'string'
          ? data.message
          : 'Ocurrió un error.'

    throw new ApiError(message, res.status)
  }

  return data as T
}

export function getAuthStatus() {
  return apiFetch<AuthStatusResponse>('/auth/status')
}

export function getHealthStatus() {
  return apiFetch<HealthStatusResponse>('/health')
}

export function bootstrapAuth(payload: BootstrapPayload) {
  return apiFetch<AuthResponse>('/auth/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function login(payload: AuthPayload) {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function logout() {
  return apiFetch<{ ok: true }>('/auth/logout', { method: 'POST' })
}

export function getMe() {
  return apiFetch<AuthMeResponse>('/auth/me')
}

export function getAuthSecurity() {
  return apiFetch<AuthSecurityResponse>('/auth/security')
}

export function changePassword(payload: ChangePasswordPayload) {
  return apiFetch<{ ok: true; closedSessions: number }>('/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function logoutAll() {
  return apiFetch<{ ok: true; closedSessions: number }>('/auth/logout-all', {
    method: 'POST',
  })
}

export function getUsers() {
  return apiFetch<UsuarioSistema[]>('/usuarios')
}

export function saveUser(payload: UsuarioPayload, id?: number | null) {
  return apiFetch<UsuarioSistema>(id ? `/usuarios/${id}` : '/usuarios', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function getClientes() {
  return apiFetch<Cliente[]>('/clientes')
}

export function saveCliente(payload: ClientePayload, id?: number | null) {
  return apiFetch<Cliente>(id ? `/clientes/${id}` : '/clientes', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deleteCliente(id: number) {
  return apiFetch<{ ok: true }>(`/clientes/${id}`, { method: 'DELETE' })
}

export function getCuentas() {
  return apiFetch<CuentaAcceso[]>('/cuentas')
}

export function saveCuenta(payload: CuentaPayload, id?: number | null) {
  return apiFetch<{ ok: true }>(id ? `/cuentas/${id}` : '/cuentas', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deleteCuenta(id: number) {
  return apiFetch<{ ok: true }>(`/cuentas/${id}`, { method: 'DELETE' })
}

export function getVentas(params: VentasQuery) {
  return apiFetch<VentasResponse>(`/ventas${buildQueryString(params)}`)
}

export function saveVenta(payload: VentaPayload, id?: number | null) {
  return apiFetch<Venta>(id ? `/ventas/${id}` : '/ventas', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function pagarVenta(id: number, payload: PagarVentaPayload) {
  return apiFetch<Venta>(`/ventas/${id}/pagar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deleteVenta(id: number) {
  return apiFetch<{ ok: true }>(`/ventas/${id}`, { method: 'DELETE' })
}

export function getPagos(limit = 50) {
  return apiFetch<Pago[]>(`/pagos${buildQueryString({ limit })}`)
}

export function getPagosResumen(limit = 5) {
  return apiFetch<PagoResumenResponse>(`/pagos/resumen${buildQueryString({ limit })}`)
}

export function getActividad(limit = 50) {
  return apiFetch<ActividadSistema[]>(`/actividad${buildQueryString({ limit })}`)
}

export function getDashboardResumen(params: DashboardResumenQuery = {}) {
  return apiFetch<DashboardResumenResponse>(`/dashboard/resumen${buildQueryString(params)}`)
}

export function getHistorialBajas() {
  return apiFetch<HistorialBaja[]>('/historial-bajas')
}

export function getWhatsAppLogs() {
  return apiFetch<WhatsAppLog[]>('/whatsapp/logs')
}

export function getWhatsAppConfig() {
  return apiFetch<WhatsAppConfig>('/config/whatsapp')
}

export function saveWhatsAppConfig(payload: WhatsAppConfigPayload) {
  return apiFetch<{ ok: true }>('/config/whatsapp', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function setWhatsAppEnabled(enabled: boolean) {
  return apiFetch<{ ok: true }>('/config/whatsapp/enabled', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
}

export function sendWhatsAppDueToday() {
  return apiFetch<WhatsAppReminderResponse>(
    '/whatsapp/send-due-today',
    { method: 'POST' }
  )
}

export function sendWhatsAppTest(payload: WhatsAppTestPayload) {
  return apiFetch<WhatsAppTestResponse>('/whatsapp/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function getWhatsAppChats() {
  return apiFetch<WhatsAppChatThread[]>('/whatsapp/chats')
}

export function getWhatsAppChatMessages(telefono: string) {
  return apiFetch<WhatsAppChatMessage[]>(`/whatsapp/chats/${encodeURIComponent(telefono)}/messages`)
}

export function sendWhatsAppChatReply(telefono: string, payload: WhatsAppChatReplyPayload) {
  return apiFetch<WhatsAppChatReplyResponse>(`/whatsapp/chats/${encodeURIComponent(telefono)}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function clearMaintenanceHistory() {
  return apiFetch<{ ok: true }>('/maintenance/clear-history', { method: 'DELETE' })
}
