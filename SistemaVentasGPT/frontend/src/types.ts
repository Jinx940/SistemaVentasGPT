export type Cliente = {
  id: number
  nombre: string
  telefono: string
  monto: number | string
  carpeta: string
  observacion?: string | null
  ventasActivas?: number
  deudaPendiente?: number
  ultimoCierre?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type CuentaAcceso = {
  id: number
  correo: string
  capacidad: number
  activa: boolean
  observacion?: string | null
  used: number
  free?: number
  occupancyPercent?: number
  alertLevel?: 'NORMAL' | 'ALTA' | 'CRITICA'
  createdAt?: string | null
  updatedAt?: string | null
}

export type Venta = {
  id: number
  no?: number
  clienteId: number
  cuentaAccesoId?: number | null
  fechaInicio: string | null
  fechaCierre: string | null
  fechaPago?: string | null
  monto: number | string
  descuento: number | string
  montoPagado?: number | string | null
  estado: string
  tipoDispositivo: string
  cantidadDispositivos: number
  observacion?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  cliente: Cliente | null
  cuentaAcceso?: CuentaAcceso | null
}

export type HistorialBaja = {
  id: number
  ventaId?: number | null
  clienteId: number
  clienteNombre: string
  telefono?: string | null
  detalle?: string | null
  fechaBaja: string
}

export type WhatsAppLog = {
  id: number
  ventaId?: number | null
  clienteNombre?: string | null
  telefono?: string | null
  fechaObjetivo?: string | null
  estado?: string | null
  detalle?: string | null
  createdAt: string
}

export type WhatsAppConfig = {
  enabled: boolean
  graphVersion: string
  phoneNumberId: string
  webhookUrl: string
  webhookVerifyToken: string
  notifyPhone: string
  replyAlertTemplateName: string
  replyAlertLangCode: string
  templateName: string
  langCode: string
  dueTodayTemplateName: string
  dueTodayLangCode: string
  dueTomorrowTemplateName: string
  dueTomorrowLangCode: string
  overdueTemplateName: string
  overdueLangCode: string
  accessUpdateTemplateName: string
  accessUpdateLangCode: string
  serviceResumeDate: string
  paymentMethods: string
  paymentPhone: string
  paymentContactName: string
  hasToken: boolean
}

export type Pago = {
  id: number
  ventaId: number
  usuarioId?: number | null
  monto: number
  fechaPago: string
  mesesPagados: number
  observacion?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  venta?: Venta | null
  usuario?: UsuarioSistema | null
}

export type UsuarioSistema = {
  id: number
  nombre: string
  correo: string
  rol: 'ADMIN' | 'OPERADOR'
  activo: boolean
  createdAt?: string | null
  updatedAt?: string | null
}

export type ActividadSistema = {
  id: number
  usuarioId?: number | null
  accion: string
  entidad: string
  entidadId?: number | null
  descripcion?: string | null
  createdAt: string
  usuario?: UsuarioSistema | null
}

export type DashboardMetricas = {
  totalClientes: number
  totalVentas: number
  totalCuentas: number
  cuentasActivas: number
  pagadas: number
  pendientes: number
  mensajesEnviados: number
  bajas: number
  vencenHoy: number
  vencidos: number
  montoTotal: number
  descuentoTotal: number
  netoEstimado: number
}

export type DashboardRentabilidadPorCorreo = {
  correo: string
  activa: boolean
  clientes: number
  pagados: number
  pendientes: number
  mensajesEnviados: number
  ingresos: number
  costoChatGPT: number
  neto: number
}

export type DashboardRentabilidad = {
  totalIngresos: number
  costoChatGPT: number
  netoOperativo: number
  porCorreo: DashboardRentabilidadPorCorreo[]
}

export type DashboardScope = {
  month: number | null
  year: number | null
  isGlobal: boolean
  mode?: 'global' | 'month' | 'range'
  dateFrom?: string | null
  dateTo?: string | null
}

export type DashboardResumenResponse = {
  scope: DashboardScope
  metricas: DashboardMetricas
  rentabilidad: DashboardRentabilidad
  dueTodayRows: Venta[]
  overdueRows: Venta[]
}

export type VentasResponse = {
  items: Venta[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type VentasQuery = {
  search?: string
  correo?: string
  estado?: string
  mesCierre?: string
  fechaCierre?: string
  page?: number
  pageSize?: number
}

export type DashboardResumenQuery = {
  month?: number
  year?: number
  dateFrom?: string
  dateTo?: string
}

export type ClientePayload = {
  nombre: string
  telefono: string
  monto: number
  carpeta: string
  observacion: string
}

export type CuentaPayload = {
  correo: string
  password: string
  capacidad: string
  activa: string
  observacion: string
}

export type VentaPayload = {
  cliente: string
  telefono: string
  carpeta: string
  fechaInicio: string
  fechaCierre: string
  fechaPago: string
  monto: number
  descuento: number
  estado: string
  tipoDispositivo: string[]
  cantidadDispositivos: number
  observacion: string
  assignmentMode: string
  cuentaAccesoId: number | null
}

export type WhatsAppConfigPayload = {
  graphVersion: string
  phoneNumberId: string
  webhookUrl: string
  webhookVerifyToken: string
  notifyPhone: string
  replyAlertTemplateName: string
  replyAlertLangCode: string
  templateName: string
  langCode: string
  dueTodayTemplateName: string
  dueTodayLangCode: string
  dueTomorrowTemplateName: string
  dueTomorrowLangCode: string
  overdueTemplateName: string
  overdueLangCode: string
  accessUpdateTemplateName: string
  accessUpdateLangCode: string
  serviceResumeDate: string
  paymentMethods: string
  paymentPhone: string
  paymentContactName: string
  accessToken: string
}

export type WhatsAppReminderResponse = {
  ok: true
  sent: number
  dueTomorrowSent: number
  dueTodaySent: number
  overdueSent: number
  skipped: number
  errors: number
  message?: string
}

export type PagarVentaPayload = {
  montoPagado: number
  fechaPago: string
  mesesPagados: number
}

export type AuthStatusResponse = {
  setupRequired: boolean
}

export type HealthStatusResponse = {
  ok: boolean
  dbOk: boolean
  setupRequired: boolean | null
  serverTime: string
  error?: string
}

export type AuthSecurityResponse = {
  activeSessions: number
  currentSessionExpiresAt?: string | null
  sessionDurationDays: number
}

export type AuthPayload = {
  correo: string
  password: string
}

export type BootstrapPayload = {
  nombre: string
  correo: string
  password: string
}

export type AuthResponse = {
  token: string
  expiresAt: string
  user: UsuarioSistema
}

export type AuthMeResponse = {
  user: UsuarioSistema
}

export type UsuarioPayload = {
  nombre: string
  correo: string
  password: string
  rol: 'ADMIN' | 'OPERADOR'
  activo: boolean
}

export type ChangePasswordPayload = {
  currentPassword: string
  newPassword: string
  logoutOthers: boolean
}

export type PagoResumenDeudor = {
  clienteId: number
  clienteNombre: string
  telefono?: string | null
  deudaPendiente: number
  ventasPendientes: number
  ultimoCierre?: string | null
}

export type PagoResumenResponse = {
  totalPagos: number
  totalCobrado: number
  cobradoMesActual: number
  pagosHoy: number
  deudaPendienteTotal: number
  clientesConDeuda: number
  ticketPromedio: number
  topDeudores: PagoResumenDeudor[]
}

export type WhatsAppTestPayload = {
  to: string
  mode: 'due_today' | 'due_tomorrow' | 'overdue' | 'access_update' | 'hello_world'
  cliente?: string
  fechaCierre?: string
  monto?: string
  correoCuenta?: string
  passwordCuenta?: string
}

export type WhatsAppTestResponse = {
  ok: true
  mode: string
  to?: string
  templateName?: string
  langCode?: string
  phoneNumberId?: string
  messageId?: string | null
}

export type WhatsAppChatThread = {
  telefono: string
  clienteNombre: string
  lastMessage: string
  lastDirection: 'IN' | 'OUT'
  lastStatus: string
  lastAt?: string | null
  unreadCount: number
}

export type WhatsAppChatMessage = {
  id: number
  telefono: string
  clienteNombre: string
  text: string
  direction: 'IN' | 'OUT'
  status: string
  createdAt?: string | null
}

export type WhatsAppChatReplyPayload = {
  text: string
}

export type WhatsAppChatReplyResponse = {
  ok: true
  to: string
  messageId?: string | null
}
