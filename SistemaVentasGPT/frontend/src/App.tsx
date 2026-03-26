import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  bootstrapAuth,
  changePassword,
  clearStoredAuthToken,
  clearMaintenanceHistory,
  deleteCliente,
  deleteCuenta,
  deleteVenta,
  getAuthSecurity,
  getAuthStatus,
  getActividad,
  getClientes,
  getCuentas,
  getDashboardResumen,
  getErrorMessage,
  getHealthStatus,
  getStoredAuthToken,
  getHistorialBajas,
  getMe,
  getPagos,
  getPagosResumen,
  getUsers,
  getVentas,
  getWhatsAppConfig,
  getWhatsAppChatMessages,
  getWhatsAppChats,
  getWhatsAppLogs,
  isUnauthorizedError,
  login,
  logout,
  logoutAll,
  pagarVenta,
  saveCliente,
  saveCuenta,
  saveUser,
  saveVenta,
  saveWhatsAppConfig,
  sendWhatsAppDueToday,
  sendWhatsAppChatReply,
  sendWhatsAppTest,
  setStoredAuthToken,
  setWhatsAppEnabled,
} from './api'
import type {
  ActividadSistema,
  AuthSecurityResponse,
  AuthResponse,
  Cliente,
  ClientePayload,
  CuentaAcceso,
  DashboardResumenQuery,
  DashboardResumenResponse,
  HealthStatusResponse,
  HistorialBaja,
  Pago,
  PagoResumenResponse,
  UsuarioSistema,
  Venta,
  VentaPayload,
  VentasResponse,
  WhatsAppChatMessage,
  WhatsAppChatThread,
  WhatsAppConfig,
  WhatsAppLog,
  WhatsAppTestResponse,
} from './types'
import {
  Alert,
  DashboardBarChart,
  DashboardCapacityChart,
  DashboardDonutChart,
  DashboardMetricLine,
  DashboardMiniStat,
  DashboardProgressRow,
  DashboardSalesList,
  StatCard,
} from './components/dashboard'
import { HistorySection } from './components/history-section'
import { SidebarNav } from './components/sidebar'
import { AuthCard } from './components/auth-card'
import { AppIcon } from './components/icons'
import {
  addMonthsToInputDate,
  formatCurrencyPen,
  formatDateDisplay,
  formatMonthYearLabel,
  getDaysOverdue,
  normalizePhoneForLookup,
  normalizeText,
  toInputDate,
} from './utils/ui'

type TabKey =
  | 'dashboard'
  | 'morosos'
  | 'registro'
  | 'ventas'
  | 'clientes'
  | 'cuentas'
  | 'chats'
  | 'historial'
  | 'configuracion'

type PhoneCountry = {
  label: string
  dialCode: string
}

type ModalType = 'info' | 'success' | 'warning' | 'danger'

type ConfirmModalState = {
  open: boolean
  title: string
  message: string
  type: ModalType
  confirmText: string
  onConfirm: null | (() => Promise<void> | void)
}

type ClienteFormState = {
  nombre: string
  telefono: string
  monto: string
  carpeta: string
  observacion: string
}

type CuentaFormState = {
  correo: string
  password: string
  capacidad: string
  activa: string
  observacion: string
}

type VentaFormState = {
  cliente: string
  telefono: string
  carpeta: string
  fechaInicio: string
  fechaCierre: string
  fechaPago: string
  pagoRegistrado: 'SI' | 'NO'
  monto: string
  descuento: string
  estado: string
  tipoDispositivo: string
  otroTipoDispositivo: string
  cantidadDispositivos: string
  observacion: string
  assignmentMode: 'auto' | 'manual'
  cuentaAccesoId: string
}

type VentasMetaState = Omit<VentasResponse, 'items'>

type AuthFormState = {
  nombre: string
  correo: string
  password: string
}

type PasswordFormState = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
  logoutOthers: boolean
}

type UserFormState = {
  nombre: string
  correo: string
  password: string
  rol: 'ADMIN' | 'OPERADOR'
  activo: boolean
}

type WhatsAppTestFormState = {
  to: string
  mode: 'due_today' | 'due_tomorrow' | 'overdue' | 'access_update' | 'hello_world'
  cliente: string
  fechaCierre: string
  monto: string
  correoCuenta: string
  passwordCuenta: string
}

const ESTADOS = ['PENDIENTE', 'PAGADO', 'MENSAJE_ENVIADO', 'BAJA']
const DISPOSITIVOS = ['PC', 'Laptop', 'Celular', 'Tablet', 'Otro']
const DISPOSITIVO_OTRO = 'Otro'
const PRESET_DEVICE_OPTIONS = DISPOSITIVOS.filter((item) => item !== DISPOSITIVO_OTRO)
const PRESET_DEVICE_SET = new Set(PRESET_DEVICE_OPTIONS)

const PHONE_COUNTRIES: PhoneCountry[] = [
  { label: '+51 (PE)', dialCode: '51' },
  { label: '+1 (US)', dialCode: '1' },
  { label: '+34 (ES)', dialCode: '34' },
  { label: '+52 (MX)', dialCode: '52' },
  { label: '+54 (AR)', dialCode: '54' },
  { label: '+57 (CO)', dialCode: '57' },
]

const emptyClienteForm: ClienteFormState = {
  nombre: '',
  telefono: '',
  monto: '',
  carpeta: '',
  observacion: '',
}

const emptyCuentaForm: CuentaFormState = {
  correo: '',
  password: '',
  capacidad: '20',
  activa: 'true',
  observacion: '',
}

const emptyVentaForm: VentaFormState = {
  cliente: '',
  telefono: '',
  carpeta: '',
  fechaInicio: '',
  fechaCierre: '',
  fechaPago: '',
  pagoRegistrado: 'SI',
  monto: '',
  descuento: '',
  estado: 'PAGADO',
  tipoDispositivo: '',
  otroTipoDispositivo: '',
  cantidadDispositivos: '',
  observacion: '',
  assignmentMode: 'auto',
  cuentaAccesoId: '',
}

const emptyVentasMeta: VentasMetaState = {
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 1,
}

const emptyDashboard: DashboardResumenResponse = {
  scope: {
    month: null,
    year: null,
    isGlobal: true,
  },
  metricas: {
    totalClientes: 0,
    totalVentas: 0,
    totalCuentas: 0,
    cuentasActivas: 0,
    pagadas: 0,
    pendientes: 0,
    mensajesEnviados: 0,
    bajas: 0,
    vencenHoy: 0,
    vencidos: 0,
    montoTotal: 0,
    descuentoTotal: 0,
    netoEstimado: 0,
  },
  rentabilidad: {
    totalIngresos: 0,
    costoChatGPT: 0,
    netoOperativo: 0,
    porCorreo: [],
  },
  dueTodayRows: [],
  overdueRows: [],
}

function normalizeWebhookUrl(value: string) {
  return String(value || '').trim()
}

function isPlaceholderWebhookUrl(value: string) {
  const normalized = normalizeWebhookUrl(value).toLowerCase()
  return (
    normalized.includes('tu-backend.onrender.com') ||
    normalized.includes('example.com') ||
    normalized.includes('mi-backend')
  )
}

function isValidPublicWebhookUrl(value: string) {
  const normalized = normalizeWebhookUrl(value)
  if (!normalized) return false

  try {
    const parsed = new URL(normalized)
    const host = parsed.hostname.toLowerCase()

    return (
      parsed.protocol === 'https:' &&
      !host.includes('localhost') &&
      host !== '127.0.0.1' &&
      host !== '0.0.0.0' &&
      parsed.pathname.endsWith('/webhooks/whatsapp')
    )
  } catch {
    return false
  }
}

const emptyAuthForm: AuthFormState = {
  nombre: '',
  correo: '',
  password: '',
}

const emptyPasswordForm: PasswordFormState = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  logoutOthers: true,
}

const emptyUserForm: UserFormState = {
  nombre: '',
  correo: '',
  password: '',
  rol: 'OPERADOR',
  activo: true,
}

const emptyWhatsAppTestForm: WhatsAppTestFormState = {
  to: '+51 ',
  mode: 'due_today',
  cliente: 'Cliente de prueba',
  fechaCierre: getTodayIso(),
  monto: '35.00',
  correoCuenta: '',
  passwordCuenta: '',
}

const emptyPagoResumen: PagoResumenResponse = {
  totalPagos: 0,
  totalCobrado: 0,
  cobradoMesActual: 0,
  pagosHoy: 0,
  deudaPendienteTotal: 0,
  clientesConDeuda: 0,
  ticketPromedio: 0,
  topDeudores: [],
}

const defaultPhoneCountry = PHONE_COUNTRIES[0]

function splitTelefonoFormValue(value?: string | null) {
  const raw = String(value || '').trim()
  const digits = raw.replace(/\D/g, '')

  const ordered = [...PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length)
  for (const country of ordered) {
    if (digits.startsWith(country.dialCode) && digits.length > country.dialCode.length) {
      return {
        dialCode: country.dialCode,
        local: digits.slice(country.dialCode.length),
      }
    }
  }

  if (digits.length === 9) {
    return {
      dialCode: defaultPhoneCountry.dialCode,
      local: digits,
    }
  }

  return {
    dialCode: defaultPhoneCountry.dialCode,
    local: digits,
  }
}

function buildTelefonoValue(dialCode: string, local: string) {
  const cleanedLocal = String(local || '').replace(/\D/g, '')
  if (!cleanedLocal) return ''
  return `+${dialCode} ${cleanedLocal}`
}

function getTodayIso() {
  return new Date().toISOString().slice(0, 10)
}

function getWhatsAppModeLabel(mode: WhatsAppTestFormState['mode']) {
  if (mode === 'due_tomorrow') return 'Vence manana'
  if (mode === 'due_today') return 'Vence hoy'
  if (mode === 'overdue') return 'Vencido'
  if (mode === 'access_update') return 'Cambio de acceso'
  return 'hello_world'
}

function getWhatsAppTestSuccessMessage(mode: WhatsAppTestFormState['mode']) {
  if (mode === 'due_tomorrow') return 'Prueba del mensaje de vence manana enviada correctamente.'
  if (mode === 'due_today') return 'Prueba del mensaje de vence hoy enviada correctamente.'
  if (mode === 'overdue') return 'Prueba del mensaje de vencido enviada correctamente.'
  if (mode === 'access_update') return 'Prueba del mensaje de cambio de acceso enviada correctamente.'
  return 'Prueba hello_world enviada correctamente.'
}

function formatChatTimestamp(value?: string | null) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getVentaMontoMensual(venta?: Venta | null) {
  if (!venta) return 0
  const montoCliente = Number(venta.cliente?.monto || 0)
  if (montoCliente > 0) return montoCliente
  return Number(venta.monto || 0)
}

function getVentaStatusSummary(form: VentaFormState) {
  if (form.estado === 'BAJA') {
    return {
      label: 'BAJA',
      description: 'Esta venta está marcada como baja.',
    }
  }

  if (form.pagoRegistrado === 'NO') {
    return {
      label: 'PENDIENTE hasta registrar pago',
      description: 'Se guardará pendiente desde ahora y podrás marcarla como pagada después.',
    }
  }

  const today = getTodayIso()
  if (form.fechaCierre && today && form.fechaCierre < today) {
    return {
      label: 'PENDIENTE por vencimiento',
      description: 'Este período ya venció. Aunque tuvo pago registrado, hoy ya aparece como pendiente.',
    }
  }

  return {
    label: 'PAGADO hasta la fecha de cierre',
    description: 'Cuando pase la fecha de cierre, el sistema la mostrará como pendiente de forma automática.',
  }
}

function getSelectedTipos(value: string) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function getCustomDeviceEntries(value: string) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildVentaDeviceList(form: VentaFormState) {
  const selected = getSelectedTipos(form.tipoDispositivo)
  const preset = selected.filter((item) => PRESET_DEVICE_SET.has(item))
  const custom = selected.includes(DISPOSITIVO_OTRO) ? getCustomDeviceEntries(form.otroTipoDispositivo) : []
  return [...preset, ...custom]
}

function countVentaDevices(form: VentaFormState) {
  return buildVentaDeviceList(form).length
}

function buildDashboardParams(dateFrom: string, dateTo: string): DashboardResumenQuery {
  return {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard')
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  )
  const [authReady, setAuthReady] = useState(false)
  const [setupRequired, setSetupRequired] = useState(false)
  const [authCheckNonce, setAuthCheckNonce] = useState(0)
  const [healthStatus, setHealthStatus] = useState<HealthStatusResponse | null>(null)
  const [securityInfo, setSecurityInfo] = useState<AuthSecurityResponse | null>(null)
  const [currentUser, setCurrentUser] = useState<UsuarioSistema | null>(null)
  const [authForm, setAuthForm] = useState<AuthFormState>(emptyAuthForm)
  const [setupForm, setSetupForm] = useState<AuthFormState>(emptyAuthForm)
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(emptyPasswordForm)
  const [users, setUsers] = useState<UsuarioSistema[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm)
  const [editingUserId, setEditingUserId] = useState<number | null>(null)

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [cuentas, setCuentas] = useState<CuentaAcceso[]>([])
  const [ventas, setVentas] = useState<Venta[]>([])
  const [ventasMeta, setVentasMeta] = useState<VentasMetaState>(emptyVentasMeta)
  const [dashboardResumen, setDashboardResumen] = useState<DashboardResumenResponse | null>(null)
  const [historialBajas, setHistorialBajas] = useState<HistorialBaja[]>([])
  const [whatsAppLogs, setWhatsAppLogs] = useState<WhatsAppLog[]>([])
  const [whatsAppChats, setWhatsAppChats] = useState<WhatsAppChatThread[]>([])
  const [whatsAppChatMessages, setWhatsAppChatMessages] = useState<WhatsAppChatMessage[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [pagosResumen, setPagosResumen] = useState<PagoResumenResponse>(emptyPagoResumen)
  const [actividad, setActividad] = useState<ActividadSistema[]>([])

  const [loadingDashboard, setLoadingDashboard] = useState(true)
  const [loadingClientes, setLoadingClientes] = useState(true)
  const [loadingCuentas, setLoadingCuentas] = useState(true)
  const [loadingVentas, setLoadingVentas] = useState(true)
  const [loadingHistorial, setLoadingHistorial] = useState(true)
  const [loadingWhatsAppLogs, setLoadingWhatsAppLogs] = useState(true)
  const [loadingWhatsAppChats, setLoadingWhatsAppChats] = useState(true)
  const [loadingWhatsAppChatMessages, setLoadingWhatsAppChatMessages] = useState(false)
  const [loadingPagos, setLoadingPagos] = useState(true)
  const [loadingPagosResumen, setLoadingPagosResumen] = useState(true)
  const [loadingActividad, setLoadingActividad] = useState(true)
  const [loadingSecurity, setLoadingSecurity] = useState(true)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [clienteForm, setClienteForm] = useState(emptyClienteForm)
  const [cuentaForm, setCuentaForm] = useState(emptyCuentaForm)
  const [ventaForm, setVentaForm] = useState(emptyVentaForm)
  const [telefonoPais, setTelefonoPais] = useState(defaultPhoneCountry.dialCode)
  const [ventaFechaCierreAuto, setVentaFechaCierreAuto] = useState(true)

  const [whatsAppConfig, setWhatsAppConfig] = useState<WhatsAppConfig>({
    enabled: false,
    graphVersion: 'v23.0',
    phoneNumberId: '',
    webhookUrl: '',
    webhookVerifyToken: 'sistema-cobro-whatsapp',
    notifyPhone: '',
    replyAlertTemplateName: '',
    replyAlertLangCode: 'es_PE',
    templateName: 'gpt_vence_hoy',
    langCode: 'es_PE',
    dueTodayTemplateName: 'gpt_vence_hoy',
    dueTodayLangCode: 'es_PE',
    dueTomorrowTemplateName: '',
    dueTomorrowLangCode: 'es_PE',
    overdueTemplateName: '',
    overdueLangCode: 'es_PE',
    accessUpdateTemplateName: '',
    accessUpdateLangCode: 'es_PE',
    serviceResumeDate: '01/03',
    paymentMethods: 'Yape / Plin',
    paymentPhone: '950275766',
    paymentContactName: 'Jesus Dominguez',
    hasToken: false,
  })

  const [whatsAppTokenInput, setWhatsAppTokenInput] = useState('')
  const [whatsAppTestForm, setWhatsAppTestForm] = useState<WhatsAppTestFormState>(emptyWhatsAppTestForm)
  const [selectedWhatsAppChatPhone, setSelectedWhatsAppChatPhone] = useState('')
  const [whatsAppReplyText, setWhatsAppReplyText] = useState('')
  const [sendingWhatsAppReply, setSendingWhatsAppReply] = useState(false)
  const [editingClienteId, setEditingClienteId] = useState<number | null>(null)
  const [editingCuentaId, setEditingCuentaId] = useState<number | null>(null)
  const [editingVentaId, setEditingVentaId] = useState<number | null>(null)

  const [searchCliente, setSearchCliente] = useState('')
  const [searchCuenta, setSearchCuenta] = useState('')
  const [searchVenta, setSearchVenta] = useState('')
  const [filterCorreoVenta, setFilterCorreoVenta] = useState('')
  const [filterEstadoVenta, setFilterEstadoVenta] = useState('')
  const [filterMesVenta, setFilterMesVenta] = useState('')
  const [filterFechaCierreVenta, setFilterFechaCierreVenta] = useState('')
  const [dashboardDateFrom, setDashboardDateFrom] = useState('')
  const [dashboardDateTo, setDashboardDateTo] = useState('')
  const [searchMoroso, setSearchMoroso] = useState('')
  const [ventasPage, setVentasPage] = useState(1)
  const [ventasPageSize, setVentasPageSize] = useState(20)
  const [lastWhatsAppTest, setLastWhatsAppTest] = useState<WhatsAppTestResponse | null>(null)
  const dashboardRangeRef = React.useRef<DashboardResumenQuery>({})

  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    open: false,
    title: '',
    message: '',
    type: 'info',
    confirmText: 'OK',
    onConfirm: null,
  })

  const [paymentModalVenta, setPaymentModalVenta] = useState<Venta | null>(null)
  const [paymentMonto, setPaymentMonto] = useState('')
  const [paymentMeses, setPaymentMeses] = useState<'1' | '2'>('1')
  const [paymentFecha, setPaymentFecha] = useState(getTodayIso())
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const isMobile = viewportWidth < 960
  const isPhone = viewportWidth < 640

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth)

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!isMobile) {
      setMobileNavOpen(false)
    }
  }, [isMobile])

  useEffect(() => {
    dashboardRangeRef.current = buildDashboardParams(dashboardDateFrom, dashboardDateTo)
  }, [dashboardDateFrom, dashboardDateTo])

  const matchedClienteByPhone = useMemo(() => {
    const fullPhone = buildTelefonoValue(telefonoPais, ventaForm.telefono)
    const normalizedPhone =
      normalizePhoneForLookup(fullPhone) || normalizePhoneForLookup(ventaForm.telefono)

    if (!normalizedPhone) return null

    return (
      clientes.find((cliente) => normalizePhoneForLookup(cliente.telefono) === normalizedPhone) || null
    )
  }, [clientes, telefonoPais, ventaForm.telefono])

  async function cargarClientes() {
    try {
      setLoadingClientes(true)
      const data = await getClientes()
      setClientes(data)
    } catch (error) {
      setError(getErrorMessage(error, 'Error cargando clientes.'))
    } finally {
      setLoadingClientes(false)
    }
  }

  async function cargarCuentas() {
    try {
      setLoadingCuentas(true)
      const data = await getCuentas()
      setCuentas(data)
    } catch (error) {
      setError(getErrorMessage(error, 'Error cargando cuentas.'))
    } finally {
      setLoadingCuentas(false)
    }
  }

  async function cargarVentas() {
    try {
      setLoadingVentas(true)
      const data = await getVentas({
        search: searchVenta || undefined,
        correo: filterCorreoVenta || undefined,
        estado: filterEstadoVenta || undefined,
        mesCierre: filterMesVenta || undefined,
        fechaCierre: filterFechaCierreVenta || undefined,
        page: ventasPage,
        pageSize: ventasPageSize,
      })
      setVentas(data.items)
      setVentasMeta({
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: data.totalPages,
      })
    } catch (error) {
      setError(getErrorMessage(error, 'Error cargando ventas.'))
    } finally {
      setLoadingVentas(false)
    }
  }

  async function cargarDashboard() {
    try {
      setLoadingDashboard(true)
      const data = await getDashboardResumen(buildDashboardParams(dashboardDateFrom, dashboardDateTo))
      setDashboardResumen(data)
    } catch (error) {
      setError(getErrorMessage(error, 'Error cargando dashboard.'))
    } finally {
      setLoadingDashboard(false)
    }
  }

  async function actualizarVistaVentas() {
    limpiarMensajes()

    try {
      setLoadingVentas(true)
      setLoadingCuentas(true)
      setLoadingClientes(true)

      setLoadingDashboard(true)

      const [ventasData, cuentasData, clientesData, dashboardData] = await Promise.all([
        getVentas({
          search: searchVenta || undefined,
          correo: filterCorreoVenta || undefined,
          estado: filterEstadoVenta || undefined,
          mesCierre: filterMesVenta || undefined,
          fechaCierre: filterFechaCierreVenta || undefined,
          page: ventasPage,
          pageSize: ventasPageSize,
        }),
        getCuentas(),
        getClientes(),
        getDashboardResumen(buildDashboardParams(dashboardDateFrom, dashboardDateTo)),
      ])

      setVentas(ventasData.items)
      setVentasMeta({
        total: ventasData.total,
        page: ventasData.page,
        pageSize: ventasData.pageSize,
        totalPages: ventasData.totalPages,
      })
      setCuentas(cuentasData)
      setClientes(clientesData)
      setDashboardResumen(dashboardData)
      setSuccess('Listado de ventas actualizado.')
    } catch (error) {
      setError(getErrorMessage(error, 'Error actualizando ventas.'))
    } finally {
      setLoadingVentas(false)
      setLoadingCuentas(false)
      setLoadingClientes(false)
      setLoadingDashboard(false)
    }
  }

  async function cargarHistorialBajas() {
    try {
      setLoadingHistorial(true)
      const data = await getHistorialBajas()
      setHistorialBajas(data)
    } catch (error) {
      setError(getErrorMessage(error, 'Error cargando historial de bajas.'))
    } finally {
      setLoadingHistorial(false)
    }
  }

  async function cargarWhatsAppLogs() {
    try {
      setLoadingWhatsAppLogs(true)
      const data = await getWhatsAppLogs()
      setWhatsAppLogs(data)
    } catch (error) {
      setError(getErrorMessage(error, 'Error cargando logs de WhatsApp.'))
    } finally {
      setLoadingWhatsAppLogs(false)
    }
  }

  const cargarWhatsAppChats = useCallback(async (preferredPhone = '') => {
    try {
      setLoadingWhatsAppChats(true)
      const data = await getWhatsAppChats()
      setWhatsAppChats(data)

      const normalizedPreferred = String(preferredPhone || selectedWhatsAppChatPhone)
      const hasPreferred = normalizedPreferred && data.some((item) => item.telefono === normalizedPreferred)

      if (hasPreferred) {
        setSelectedWhatsAppChatPhone(normalizedPreferred)
      } else if (!selectedWhatsAppChatPhone && data[0]?.telefono) {
        setSelectedWhatsAppChatPhone(data[0].telefono)
      } else if (selectedWhatsAppChatPhone && !data.some((item) => item.telefono === selectedWhatsAppChatPhone)) {
        setSelectedWhatsAppChatPhone(data[0]?.telefono || '')
      }
    } catch (error) {
      setError(getErrorMessage(error, 'Error cargando conversaciones de WhatsApp.'))
    } finally {
      setLoadingWhatsAppChats(false)
    }
  }, [selectedWhatsAppChatPhone])

  const cargarWhatsAppChatMessages = useCallback(async (telefono: string) => {
    if (!telefono) {
      setWhatsAppChatMessages([])
      return
    }

    try {
      setLoadingWhatsAppChatMessages(true)
      const data = await getWhatsAppChatMessages(telefono)
      setWhatsAppChatMessages(data)
    } catch (error) {
      setError(getErrorMessage(error, 'Error cargando mensajes del chat.'))
    } finally {
      setLoadingWhatsAppChatMessages(false)
    }
  }, [])

  async function cargarPagos() {
    try {
      setLoadingPagos(true)
      const data = await getPagos(20)
      setPagos(data)
    } catch (error) {
      setError(getErrorMessage(error, 'Error cargando historial de pagos.'))
    } finally {
      setLoadingPagos(false)
    }
  }

  async function cargarPagosResumen() {
    try {
      setLoadingPagosResumen(true)
      const data = await getPagosResumen(6)
      setPagosResumen(data)
    } catch (error) {
      setError(getErrorMessage(error, 'Error cargando resumen de pagos.'))
    } finally {
      setLoadingPagosResumen(false)
    }
  }

  async function cargarActividad() {
    try {
      setLoadingActividad(true)
      const data = await getActividad(30)
      setActividad(data)
    } catch (error) {
      setError(getErrorMessage(error, 'Error cargando actividad reciente.'))
    } finally {
      setLoadingActividad(false)
    }
  }

  async function cargarSecurityInfo() {
    try {
      setLoadingSecurity(true)
      const data = await getAuthSecurity()
      setSecurityInfo(data)
    } catch (error) {
      if (!isUnauthorizedError(error)) {
        setError(getErrorMessage(error, 'Error cargando la seguridad de la cuenta.'))
      }
    } finally {
      setLoadingSecurity(false)
    }
  }

  async function cargarWhatsAppConfig() {
    try {
      const data = await getWhatsAppConfig()
      setWhatsAppConfig(data)
    } catch (error) {
      setError(getErrorMessage(error, 'Error cargando configuración de WhatsApp.'))
    }
  }

  async function cargarUsuarios() {
    try {
      setLoadingUsers(true)
      const data = await getUsers()
      setUsers(data)
    } catch (error) {
      setError(getErrorMessage(error, 'Error cargando usuarios.'))
    } finally {
      setLoadingUsers(false)
    }
  }

  function applyAuthPayload(payload: AuthResponse) {
    setStoredAuthToken(payload.token)
    setCurrentUser(payload.user)
    setSetupRequired(false)
    setAuthForm(emptyAuthForm)
    setSetupForm(emptyAuthForm)
  }

  const performLogout = useCallback(async (showMessage = true) => {
    try {
      if (currentUser) {
        await logout()
      }
    } catch {
      // noop
    } finally {
      clearStoredAuthToken()
      setCurrentUser(null)
      setUsers([])
      setSetupRequired(false)
      setAuthReady(true)
      setVentas([])
      setClientes([])
      setCuentas([])
      setPagos([])
      setPagosResumen(emptyPagoResumen)
      setActividad([])
      setSecurityInfo(null)
      setHistorialBajas([])
      setWhatsAppLogs([])
      setWhatsAppChats([])
      setWhatsAppChatMessages([])
      setSelectedWhatsAppChatPhone('')
      setWhatsAppReplyText('')
      setDashboardResumen(null)
      setLastWhatsAppTest(null)
      setPasswordForm(emptyPasswordForm)
      if (showMessage) {
        setSuccess('Sesión cerrada correctamente.')
      }
    }
  }, [currentUser])

  function retryAuthCheck() {
    setError('')
    setSuccess('')
    setAuthReady(false)
    setAuthCheckNonce((prev) => prev + 1)
  }

  async function applyDashboardRange() {
    limpiarMensajes()
    if (dashboardDateFrom && dashboardDateTo && dashboardDateFrom > dashboardDateTo) {
      setError('La fecha inicial del dashboard no puede ser mayor que la final.')
      return
    }

    await cargarDashboard()
    setSuccess('Dashboard actualizado con el rango seleccionado.')
  }

  async function resetDashboardRange() {
    limpiarMensajes()
    setDashboardDateFrom('')
    setDashboardDateTo('')
    try {
      setLoadingDashboard(true)
      const data = await getDashboardResumen()
      setDashboardResumen(data)
      setSuccess('Dashboard restablecido a la vista global.')
    } catch (error) {
      setError(getErrorMessage(error, 'No se pudo restablecer el dashboard.'))
    } finally {
      setLoadingDashboard(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadHealthStatus() {
      try {
        const health = await getHealthStatus()

        if (cancelled) return

        setHealthStatus(health)
        if (typeof health.setupRequired === 'boolean') {
          setSetupRequired(health.setupRequired)
        }
      } catch {
        if (!cancelled) {
          setHealthStatus(null)
        }
      }
    }

    void loadHealthStatus()

    return () => {
      cancelled = true
    }
  }, [authCheckNonce])

  useEffect(() => {
    let cancelled = false

    async function checkAuth() {
      try {
        const status = await getAuthStatus()

        if (cancelled) return

        setSetupRequired(status.setupRequired)

        if (status.setupRequired) {
          setCurrentUser(null)
          return
        }

        const storedToken = getStoredAuthToken()
        if (!storedToken) {
          setCurrentUser(null)
          return
        }

        try {
          const me = await getMe()

          if (cancelled) return

          setCurrentUser(me.user)
        } catch (error) {
          if (cancelled) return

          clearStoredAuthToken()
          setCurrentUser(null)

          if (!isUnauthorizedError(error)) {
            setError(getErrorMessage(error, 'Error verificando tu sesión.'))
          }
        }
      } catch (error) {
        if (!cancelled) {
          setCurrentUser(null)
          setError(getErrorMessage(error, 'Error inicializando la autenticación.'))
        }
      } finally {
        if (!cancelled) {
          setAuthReady(true)
        }
      }
    }

    void checkAuth()

    return () => {
      cancelled = true
    }
  }, [authCheckNonce])

  useEffect(() => {
    if (!matchedClienteByPhone) return

    setVentaForm((prev) => {
      const next = {
        ...prev,
        cliente: matchedClienteByPhone.nombre || '',
        monto: String(matchedClienteByPhone.monto ?? ''),
        carpeta: matchedClienteByPhone.carpeta || '',
        observacion: matchedClienteByPhone.observacion || '',
      }

      if (
        next.cliente === prev.cliente &&
        next.monto === prev.monto &&
        next.carpeta === prev.carpeta &&
        next.observacion === prev.observacion
      ) {
        return prev
      }

      return next
    })
  }, [matchedClienteByPhone])

  useEffect(() => {
    if (!currentUser || activeTab !== 'chats') return
    void cargarWhatsAppChats()
  }, [activeTab, cargarWhatsAppChats, currentUser])

  useEffect(() => {
    if (!currentUser || activeTab !== 'chats' || !selectedWhatsAppChatPhone) return
    void cargarWhatsAppChatMessages(selectedWhatsAppChatPhone)
  }, [activeTab, cargarWhatsAppChatMessages, currentUser, selectedWhatsAppChatPhone])

  useEffect(() => {
    if (!currentUser || activeTab !== 'chats') return

    const intervalId = window.setInterval(() => {
      void cargarWhatsAppChats()
      if (selectedWhatsAppChatPhone) {
        void cargarWhatsAppChatMessages(selectedWhatsAppChatPhone)
      }
    }, 15000)

    return () => window.clearInterval(intervalId)
  }, [activeTab, cargarWhatsAppChatMessages, cargarWhatsAppChats, currentUser, selectedWhatsAppChatPhone])

  useEffect(() => {
    if (!currentUser) {
      setLoadingClientes(false)
      setLoadingCuentas(false)
      setLoadingHistorial(false)
      setLoadingWhatsAppLogs(false)
      setLoadingWhatsAppChats(false)
      setLoadingWhatsAppChatMessages(false)
      setLoadingPagos(false)
      setLoadingPagosResumen(false)
      setLoadingActividad(false)
      setLoadingDashboard(false)
      setLoadingSecurity(false)
      setLoadingUsers(false)
      return
    }

    let cancelled = false
    const authUser = currentUser

    async function bootstrapProtectedData() {
      try {
        setLoadingClientes(true)
        setLoadingCuentas(true)
        setLoadingHistorial(true)
        setLoadingWhatsAppLogs(true)
        setLoadingPagos(true)
        setLoadingPagosResumen(true)
        setLoadingActividad(true)
        setLoadingDashboard(true)
        setLoadingSecurity(true)
        setLoadingUsers(authUser.rol === 'ADMIN')

        const tasks = [
          getClientes(),
          getCuentas(),
          getHistorialBajas(),
          getWhatsAppLogs(),
          getPagos(20),
          getPagosResumen(6),
          getActividad(30),
          getDashboardResumen(dashboardRangeRef.current),
          getAuthSecurity(),
        ] as const

        const adminTasks = authUser.rol === 'ADMIN'
          ? [getWhatsAppConfig(), getUsers()] as const
          : [] as const

        const protectedData = await Promise.all([...tasks, ...adminTasks])

        if (cancelled) return

        const [clientesData, cuentasData, historialData, logsData, pagosData, pagosResumenData, actividadData, dashboardData, securityData] = protectedData

        setClientes(clientesData)
        setCuentas(cuentasData)
        setHistorialBajas(historialData)
        setWhatsAppLogs(logsData)
        setPagos(pagosData)
        setPagosResumen(pagosResumenData)
        setActividad(actividadData)
        setDashboardResumen(dashboardData)
        setSecurityInfo(securityData)

        if (authUser.rol === 'ADMIN') {
          const configData = protectedData[9] as WhatsAppConfig
          const usersData = protectedData[10] as UsuarioSistema[]
          setWhatsAppConfig(configData)
          setUsers(usersData)
        } else {
          setUsers([])
        }
      } catch (error) {
        if (!cancelled) {
          if (isUnauthorizedError(error)) {
            void performLogout(false)
          } else {
            setError(getErrorMessage(error, 'Error cargando datos iniciales.'))
          }
        }
      } finally {
        if (!cancelled) {
          setLoadingClientes(false)
          setLoadingCuentas(false)
      setLoadingHistorial(false)
      setLoadingWhatsAppLogs(false)
      setLoadingWhatsAppChats(false)
      setLoadingWhatsAppChatMessages(false)
      setLoadingPagos(false)
          setLoadingPagosResumen(false)
          setLoadingActividad(false)
          setLoadingDashboard(false)
          setLoadingSecurity(false)
          setLoadingUsers(false)
        }
      }
    }

    void bootstrapProtectedData()

    return () => {
      cancelled = true
    }
  }, [currentUser, performLogout])

  useEffect(() => {
    if (!currentUser) return
    let cancelled = false

    async function loadVentas() {
      try {
        setLoadingVentas(true)
        const data = await getVentas({
          search: searchVenta || undefined,
          correo: filterCorreoVenta || undefined,
          estado: filterEstadoVenta || undefined,
          mesCierre: filterMesVenta || undefined,
          fechaCierre: filterFechaCierreVenta || undefined,
          page: ventasPage,
          pageSize: ventasPageSize,
        })

        if (cancelled) return

        setVentas(data.items)
        setVentasMeta({
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
          totalPages: data.totalPages,
        })
      } catch (error) {
        if (!cancelled) {
          if (isUnauthorizedError(error)) {
            void performLogout(false)
          } else {
            setError(getErrorMessage(error, 'Error cargando ventas.'))
          }
        }
      } finally {
        if (!cancelled) {
          setLoadingVentas(false)
        }
      }
    }

    void loadVentas()

    return () => {
      cancelled = true
    }
  }, [currentUser, searchVenta, filterCorreoVenta, filterEstadoVenta, filterMesVenta, filterFechaCierreVenta, ventasPage, ventasPageSize, performLogout])

  useEffect(() => {
    if (!paymentModalVenta) return
    const montoMensual = getVentaMontoMensual(paymentModalVenta)
    setPaymentMonto((montoMensual * Number(paymentMeses)).toFixed(2))
  }, [paymentMeses, paymentModalVenta])

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault()
    limpiarMensajes()

    try {
      const payload = await login({
        correo: authForm.correo,
        password: authForm.password,
      })
      applyAuthPayload(payload)
      setSuccess(`Bienvenido, ${payload.user.nombre}.`)
    } catch (error) {
      setError(getErrorMessage(error, 'No se pudo iniciar sesión.'))
    }
  }

  async function submitBootstrap(e: React.FormEvent) {
    e.preventDefault()
    limpiarMensajes()

    try {
      const payload = await bootstrapAuth({
        nombre: setupForm.nombre,
        correo: setupForm.correo,
        password: setupForm.password,
      })
      applyAuthPayload(payload)
      setSuccess('Administrador inicial creado correctamente.')
    } catch (error) {
      setError(getErrorMessage(error, 'No se pudo crear el administrador inicial.'))
    }
  }

  async function submitChangePassword(e: React.FormEvent) {
    e.preventDefault()
    limpiarMensajes()

    if (!passwordForm.currentPassword.trim() || !passwordForm.newPassword.trim()) {
      setError('Ingresa tu contraseña actual y la nueva contraseña.')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('La confirmación de la nueva contraseña no coincide.')
      return
    }

    try {
      const result = await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        logoutOthers: passwordForm.logoutOthers,
      })

      setPasswordForm(emptyPasswordForm)
      setSuccess(
        result.closedSessions > 0
          ? `Contraseña actualizada. Se cerraron ${result.closedSessions} sesión(es) adicional(es).`
          : 'Contraseña actualizada correctamente.'
      )
      await cargarSecurityInfo()
      await cargarActividad()
    } catch (error) {
      setError(getErrorMessage(error, 'No se pudo actualizar la contraseña.'))
    }
  }

  async function cerrarOtrasSesiones() {
    limpiarMensajes()

    try {
      const result = await logoutAll()
      setSuccess(
        result.closedSessions > 0
          ? `Se cerraron ${result.closedSessions} sesión(es) adicional(es).`
          : 'No había otras sesiones activas.'
      )
      await cargarSecurityInfo()
      await cargarActividad()
    } catch (error) {
      setError(getErrorMessage(error, 'No se pudieron cerrar las demás sesiones.'))
    }
  }

  function resetUserForm() {
    setUserForm(emptyUserForm)
    setEditingUserId(null)
  }

  async function submitGuardarUsuario(e: React.FormEvent) {
    e.preventDefault()
    limpiarMensajes()

    if (!userForm.nombre.trim() || !userForm.correo.trim()) {
      setError('Nombre y correo son obligatorios.')
      return
    }

    if (!editingUserId && !userForm.password.trim()) {
      setError('La contraseña es obligatoria para crear un usuario.')
      return
    }

    try {
      await saveUser(
        {
          ...userForm,
          password: userForm.password,
        },
        editingUserId
      )
      setSuccess(editingUserId ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.')
      resetUserForm()
      await cargarUsuarios()
      await cargarActividad()
    } catch (error) {
      setError(getErrorMessage(error, 'Error guardando usuario.'))
    }
  }

  function limpiarMensajes() {
    setError('')
    setSuccess('')
  }

  function openConfirmModal({
    title,
    message,
    type = 'info',
    confirmText = 'OK',
    onConfirm,
  }: {
    title: string
    message: string
    type?: ModalType
    confirmText?: string
    onConfirm: () => Promise<void> | void
  }) {
    setConfirmModal({
      open: true,
      title,
      message,
      type,
      confirmText,
      onConfirm,
    })
  }

  function closeConfirmModal() {
    setConfirmModal({
      open: false,
      title: '',
      message: '',
      type: 'info',
      confirmText: 'OK',
      onConfirm: null,
    })
  }

  async function handleConfirmModalOk() {
    const action = confirmModal.onConfirm
    closeConfirmModal()
    if (action) {
      await action()
    }
  }

  function openPaymentModal(venta: Venta) {
    const montoMensual = getVentaMontoMensual(venta)
    setPaymentModalVenta(venta)
    setPaymentMeses('1')
    setPaymentMonto(montoMensual.toFixed(2))
    setPaymentFecha(getTodayIso())
  }

  function closePaymentModal() {
    setPaymentModalVenta(null)
    setPaymentMonto('')
    setPaymentMeses('1')
    setPaymentFecha(getTodayIso())
  }

  async function submitPaymentModal() {
    limpiarMensajes()

    if (!paymentModalVenta) return

    const monto = Number(paymentMonto)
    const mesesPagados = Number(paymentMeses)

    if (!monto || monto <= 0) {
      setError('La cantidad pagada calculada no es válida.')
      return
    }

    if (![1, 2].includes(mesesPagados)) {
      setError('Selecciona si cancelarás 1 o 2 meses.')
      return
    }

    if (!paymentFecha) {
      setError('Selecciona la fecha de pago.')
      return
    }

    try {
      await pagarVenta(paymentModalVenta.id, {
        montoPagado: monto,
        fechaPago: paymentFecha,
        mesesPagados,
      })

      setSuccess(
        `Pago registrado correctamente para ${paymentModalVenta.cliente?.nombre || 'el cliente'}.`
      )

      closePaymentModal()
      await cargarVentas()
      if (currentUser?.rol === 'ADMIN') {
        await cargarCuentas()
      }
      await cargarClientes()
      await cargarDashboard()
      await cargarPagos()
      await cargarPagosResumen()
      await cargarActividad()
    } catch (error) {
      setError(getErrorMessage(error, 'Error al registrar pago.'))
    }
  }

  function handleClienteChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setClienteForm((prev) => ({ ...prev, [name]: value }))
  }

  function handleCuentaChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target
    setCuentaForm((prev) => ({ ...prev, [name]: value }))
  }

  function handleVentaChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target

    if (name === 'otroTipoDispositivo') {
      setVentaForm((prev) => {
        const actuales = getSelectedTipos(prev.tipoDispositivo)
        const siguientes = actuales.includes(DISPOSITIVO_OTRO)
          ? actuales
          : [...actuales, DISPOSITIVO_OTRO]

        const nextForm = {
          ...prev,
          tipoDispositivo: siguientes.join(', '),
          otroTipoDispositivo: value,
        }

        return {
          ...nextForm,
          cantidadDispositivos: countVentaDevices(nextForm) ? String(countVentaDevices(nextForm)) : '',
        }
      })
      return
    }

    if (name === 'telefono') {
      setVentaForm((prev) => ({ ...prev, telefono: value.replace(/\D/g, '') }))
      return
    }

    if (name === 'fechaInicio') {
      setVentaForm((prev) => {
        const shouldSyncFechaPago =
          prev.pagoRegistrado === 'SI' && (!prev.fechaPago || prev.fechaPago === prev.fechaInicio)

        return {
          ...prev,
          fechaInicio: value,
          fechaCierre:
            ventaFechaCierreAuto || !prev.fechaCierre
              ? addMonthsToInputDate(value, 1)
              : prev.fechaCierre,
          fechaPago: shouldSyncFechaPago ? value : prev.fechaPago,
        }
      })
      return
    }

    if (name === 'fechaCierre') {
      setVentaFechaCierreAuto(false)
      setVentaForm((prev) => ({ ...prev, fechaCierre: value }))
      return
    }

    if (name === 'pagoRegistrado') {
      setVentaForm((prev) => ({
        ...prev,
        pagoRegistrado: value === 'NO' ? 'NO' : 'SI',
        fechaPago: value === 'NO' ? '' : prev.fechaPago || prev.fechaInicio,
      }))
      return
    }

    setVentaForm((prev) => ({ ...prev, [name]: value }))
  }

  function resetClienteForm() {
    setClienteForm(emptyClienteForm)
    setEditingClienteId(null)
  }

  function resetCuentaForm() {
    setCuentaForm(emptyCuentaForm)
    setEditingCuentaId(null)
  }

  function resetVentaForm() {
    setVentaForm(emptyVentaForm)
    setEditingVentaId(null)
    setTelefonoPais(defaultPhoneCountry.dialCode)
    setVentaFechaCierreAuto(true)
  }

  async function submitGuardarCliente() {
    const payload: ClientePayload = {
      ...clienteForm,
      monto: Number(clienteForm.monto),
    }

    if (editingClienteId) {
      await saveCliente(payload, editingClienteId)
      setSuccess('Cliente actualizado correctamente.')
    } else {
      await saveCliente(payload)
      setSuccess('Cliente guardado correctamente.')
    }

    resetClienteForm()
    await cargarClientes()
    await cargarVentas()
    if (currentUser?.rol === 'ADMIN') {
      await cargarCuentas()
    }
    await cargarDashboard()
    await cargarPagosResumen()
    await cargarActividad()
  }

  async function guardarCliente(e: React.FormEvent) {
    e.preventDefault()
    limpiarMensajes()

    if (
      !clienteForm.nombre.trim() ||
      !clienteForm.telefono.trim() ||
      !clienteForm.monto ||
      Number(clienteForm.monto) <= 0 ||
      !clienteForm.carpeta.trim()
    ) {
      setError('Nombre, teléfono, monto y carpeta son obligatorios.')
      return
    }

    openConfirmModal({
      title: editingClienteId ? 'Actualizar cliente' : 'Guardar cliente',
      message: editingClienteId
        ? `Se actualizará el cliente "${clienteForm.nombre}".`
        : `Se guardará el cliente "${clienteForm.nombre}".`,
      type: 'success',
      confirmText: editingClienteId ? 'Actualizar' : 'Guardar',
      onConfirm: async () => {
        try {
          await submitGuardarCliente()
        } catch (error) {
          setError(getErrorMessage(error, 'Error al guardar cliente.'))
        }
      },
    })
  }

  async function submitGuardarCuenta() {
    if (editingCuentaId) {
      await saveCuenta(cuentaForm, editingCuentaId)
      setSuccess('Cuenta actualizada correctamente.')
    } else {
      await saveCuenta(cuentaForm)
      setSuccess('Cuenta guardada correctamente.')
    }

    resetCuentaForm()
    if (currentUser?.rol === 'ADMIN') {
      await cargarCuentas()
    }
    await cargarVentas()
    await cargarDashboard()
    await cargarPagosResumen()
    await cargarActividad()
  }

  async function guardarCuenta(e: React.FormEvent) {
    e.preventDefault()
    limpiarMensajes()

    if (!cuentaForm.correo.trim()) {
      setError('El correo es obligatorio.')
      return
    }

    if (!editingCuentaId && !cuentaForm.password.trim()) {
      setError('La contraseña es obligatoria.')
      return
    }

    openConfirmModal({
      title: editingCuentaId ? 'Actualizar cuenta' : 'Guardar cuenta',
      message: editingCuentaId
        ? `Se actualizará la cuenta "${cuentaForm.correo}".`
        : `Se guardará la cuenta "${cuentaForm.correo}".`,
      type: 'success',
      confirmText: editingCuentaId ? 'Actualizar' : 'Guardar',
      onConfirm: async () => {
        try {
          await submitGuardarCuenta()
        } catch (error) {
          setError(getErrorMessage(error, 'Error al guardar cuenta.'))
        }
      },
    })
  }

  async function submitGuardarVenta() {
    const selectedManualAccount = manualAccounts.find(
      (cuenta) => String(cuenta.id ?? '') === String(ventaForm.cuentaAccesoId)
    )
    const selectedDeviceKeys = getSelectedTipos(ventaForm.tipoDispositivo)
    const selectedDevices = buildVentaDeviceList(ventaForm)

    if (ventaForm.assignmentMode === 'manual') {
      if (!ventaForm.cuentaAccesoId) {
        throw new Error('Selecciona una cuenta manual.')
      }

      if (!selectedManualAccount?.id) {
        throw new Error('Ese correo manual no está creado en Cuentas. Regístralo primero en la pestaña Cuentas.')
      }
    }

    const telefonoCompleto = buildTelefonoValue(telefonoPais, ventaForm.telefono)
    if (!telefonoCompleto) {
      throw new Error('Ingresa un teléfono válido.')
    }

    if (selectedDeviceKeys.includes(DISPOSITIVO_OTRO) && !getCustomDeviceEntries(ventaForm.otroTipoDispositivo).length) {
      throw new Error('Ingresa el dispositivo cuando selecciones Otro.')
    }

    if (!selectedDevices.length) {
      throw new Error('Selecciona al menos un dispositivo.')
    }

    const payload: VentaPayload = {
      ...ventaForm,
      telefono: telefonoCompleto,
      fechaPago:
        ventaForm.pagoRegistrado === 'SI' ? ventaForm.fechaPago || ventaForm.fechaInicio : '',
      monto: Number(ventaForm.monto),
      descuento: Number(ventaForm.descuento || 0),
      estado:
        ventaForm.estado === 'BAJA'
          ? 'BAJA'
          : ventaForm.pagoRegistrado === 'SI'
            ? 'PAGADO'
            : 'PENDIENTE',
      tipoDispositivo: selectedDevices,
      cantidadDispositivos: selectedDevices.length,
      cuentaAccesoId:
        ventaForm.assignmentMode === 'manual'
          ? Number(selectedManualAccount!.id)
          : null,
    }

    if (editingVentaId) {
      await saveVenta(payload, editingVentaId)
      setSuccess('Venta actualizada correctamente.')
    } else {
      await saveVenta(payload)
      setSuccess('Venta guardada correctamente.')
    }

    resetVentaForm()
    await cargarVentas()
    if (currentUser?.rol === 'ADMIN') {
      await cargarCuentas()
    }
    await cargarClientes()
    await cargarDashboard()
    await cargarPagos()
    await cargarPagosResumen()
    await cargarActividad()
  }

  async function guardarVenta(e: React.FormEvent) {
    e.preventDefault()
    limpiarMensajes()

    const selectedDevices = buildVentaDeviceList(ventaForm)

    if (
      !ventaForm.cliente.trim() ||
      !ventaForm.telefono.trim() ||
      !ventaForm.fechaInicio ||
      !ventaForm.fechaCierre ||
      !ventaForm.monto ||
      !selectedDevices.length
    ) {
      setError('Completa los campos obligatorios de la venta.')
      return
    }

    openConfirmModal({
      title: editingVentaId ? 'Actualizar venta' : 'Guardar venta',
      message: editingVentaId
        ? `Se actualizará la venta del cliente "${ventaForm.cliente}".`
        : `Se guardará una nueva venta para "${ventaForm.cliente}".`,
      type: 'success',
      confirmText: editingVentaId ? 'Actualizar' : 'Guardar',
      onConfirm: async () => {
        try {
          await submitGuardarVenta()
        } catch (error) {
          setError(getErrorMessage(error, 'Error al guardar venta.'))
        }
      },
    })
  }

  function editarCliente(cliente: Cliente) {
    limpiarMensajes()
    setEditingClienteId(cliente.id)
    setClienteForm({
      nombre: cliente.nombre || '',
      telefono: cliente.telefono || '',
      monto: String(cliente.monto ?? ''),
      carpeta: cliente.carpeta || '',
      observacion: cliente.observacion || '',
    })
    setActiveTab('clientes')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function editarCuenta(cuenta: CuentaAcceso) {
    limpiarMensajes()
    setEditingCuentaId(cuenta.id)
    setCuentaForm({
      correo: cuenta.correo || '',
      password: '',
      capacidad: String(cuenta.capacidad || 20),
      activa: cuenta.activa ? 'true' : 'false',
      observacion: cuenta.observacion || '',
    })
    setActiveTab('cuentas')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function editarVenta(venta: Venta) {
    limpiarMensajes()
    const phone = splitTelefonoFormValue(venta.cliente?.telefono || '')
    const deviceValues = getSelectedTipos(venta.tipoDispositivo || '')
    const presetDevices = deviceValues.filter((item) => PRESET_DEVICE_SET.has(item))
    const customDevices = deviceValues.filter((item) => !PRESET_DEVICE_SET.has(item))
    setTelefonoPais(phone.dialCode)

    setEditingVentaId(venta.id)
    const fechaInicio = toInputDate(venta.fechaInicio)
    const fechaCierre = toInputDate(venta.fechaCierre)
    setVentaForm({
      cliente: venta.cliente?.nombre || '',
      telefono: phone.local || '',
      carpeta: venta.cliente?.carpeta || '',
      fechaInicio,
      fechaCierre,
      fechaPago: toInputDate(venta.fechaPago),
      pagoRegistrado: venta.fechaPago ? 'SI' : 'NO',
      monto: String(venta.monto ?? ''),
      descuento: String(venta.descuento ?? 0),
      estado: venta.estado || 'PENDIENTE',
      tipoDispositivo: [...presetDevices, ...(customDevices.length ? [DISPOSITIVO_OTRO] : [])].join(', '),
      otroTipoDispositivo: customDevices.join(', '),
      cantidadDispositivos: String(deviceValues.length || venta.cantidadDispositivos || ''),
      observacion: String(venta.observacion ?? ''),
      assignmentMode: venta.cuentaAccesoId ? 'manual' : 'auto',
      cuentaAccesoId: venta.cuentaAccesoId ? String(venta.cuentaAccesoId) : '',
    })
    setVentaFechaCierreAuto(!!fechaInicio && !!fechaCierre && addMonthsToInputDate(fechaInicio, 1) === fechaCierre)
    setActiveTab('registro')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function eliminarCliente(id: number, nombre: string) {
    limpiarMensajes()

    openConfirmModal({
      title: 'Eliminar cliente',
      message: `Se eliminará el cliente "${nombre}" y sus ventas.`,
      type: 'danger',
      confirmText: 'Eliminar',
      onConfirm: async () => {
        try {
          await deleteCliente(id)
          setSuccess('Cliente eliminado correctamente.')
          if (editingClienteId === id) resetClienteForm()
          await cargarClientes()
          await cargarVentas()
          if (currentUser?.rol === 'ADMIN') {
            await cargarCuentas()
          }
          await cargarDashboard()
          await cargarPagos()
          await cargarPagosResumen()
          await cargarActividad()
        } catch (error) {
          setError(getErrorMessage(error, 'Error al eliminar cliente.'))
        }
      },
    })
  }

  function eliminarCuenta(id: number, correo: string) {
    limpiarMensajes()

    openConfirmModal({
      title: 'Eliminar cuenta',
      message: `Se eliminará la cuenta "${correo}".`,
      type: 'danger',
      confirmText: 'Eliminar',
      onConfirm: async () => {
        try {
          await deleteCuenta(id)
          setSuccess('Cuenta eliminada correctamente.')
          if (editingCuentaId === id) resetCuentaForm()
          if (currentUser?.rol === 'ADMIN') {
            await cargarCuentas()
          }
          await cargarVentas()
          await cargarDashboard()
          await cargarActividad()
        } catch (error) {
          setError(getErrorMessage(error, 'Error al eliminar cuenta.'))
        }
      },
    })
  }

  function eliminarVenta(id: number) {
    limpiarMensajes()

    openConfirmModal({
      title: 'Eliminar venta',
      message: 'Se eliminará la venta seleccionada.',
      type: 'danger',
      confirmText: 'Eliminar',
      onConfirm: async () => {
        try {
          await deleteVenta(id)
          setSuccess('Venta eliminada correctamente.')
          if (editingVentaId === id) resetVentaForm()
          await cargarVentas()
          if (currentUser?.rol === 'ADMIN') {
            await cargarCuentas()
          }
          await cargarDashboard()
          await cargarPagos()
          await cargarPagosResumen()
          await cargarActividad()
        } catch (error) {
          setError(getErrorMessage(error, 'Error al eliminar venta.'))
        }
      },
    })
  }

  function registrarPagoVenta(venta: Venta) {
    limpiarMensajes()

    openConfirmModal({
      title: 'Registrar pago',
      message: `Se abrirá el registro de pago para "${venta.cliente?.nombre || ''}".`,
      type: 'success',
      confirmText: 'Continuar',
      onConfirm: () => {
        openPaymentModal(venta)
      },
    })
  }

  function abrirWhatsAppMoroso(venta: Venta) {
    const telefono = String(venta.cliente?.telefono || '').replace(/\D/g, '')

    if (!telefono) {
      setError('Ese cliente no tiene un teléfono válido para abrir WhatsApp.')
      return
    }

    const diasAtraso = getDaysOverdue(venta.fechaCierre)
    const nombre = venta.cliente?.nombre || 'cliente'
    const montoNeto = formatCurrencyPen(Number(venta.monto || 0) - Number(venta.descuento || 0))
    const cierre = formatDateDisplay(venta.fechaCierre)
    const mensaje = [
      `Hola ${nombre}, te escribimos por tu servicio pendiente.`,
      `Tienes ${diasAtraso} día(s) de atraso.`,
      `Monto pendiente estimado: ${montoNeto}.`,
      `Fecha de cierre: ${cierre}.`,
      'Avísanos para registrar tu pago o ayudarte con la renovación.',
    ].join(' ')

    window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener,noreferrer')
  }

  async function guardarWhatsAppConfig(e: React.FormEvent) {
    e.preventDefault()
    limpiarMensajes()

    const normalizedWebhookUrl = normalizeWebhookUrl(whatsAppConfig.webhookUrl)
    if (normalizedWebhookUrl) {
      if (isPlaceholderWebhookUrl(normalizedWebhookUrl)) {
        setError('Reemplaza la URL de ejemplo del webhook por tu dominio real de Render.')
        return
      }

      if (!isValidPublicWebhookUrl(normalizedWebhookUrl)) {
        setError(
          'La URL del webhook debe ser publica, usar https y terminar en /webhooks/whatsapp.'
        )
        return
      }
    }

    openConfirmModal({
      title: 'Guardar configuración',
      message: 'Se actualizará la configuración de WhatsApp.',
      type: 'success',
      confirmText: 'Guardar',
      onConfirm: async () => {
        try {
          await saveWhatsAppConfig({
            graphVersion: whatsAppConfig.graphVersion,
            phoneNumberId: whatsAppConfig.phoneNumberId,
            webhookUrl: normalizedWebhookUrl,
            webhookVerifyToken: whatsAppConfig.webhookVerifyToken,
            notifyPhone: whatsAppConfig.notifyPhone,
            replyAlertTemplateName: whatsAppConfig.replyAlertTemplateName,
            replyAlertLangCode: whatsAppConfig.replyAlertLangCode,
            templateName: whatsAppConfig.dueTodayTemplateName,
            langCode: whatsAppConfig.dueTodayLangCode,
            dueTodayTemplateName: whatsAppConfig.dueTodayTemplateName,
            dueTodayLangCode: whatsAppConfig.dueTodayLangCode,
            dueTomorrowTemplateName: whatsAppConfig.dueTomorrowTemplateName,
            dueTomorrowLangCode: whatsAppConfig.dueTomorrowLangCode,
            overdueTemplateName: whatsAppConfig.overdueTemplateName,
            overdueLangCode: whatsAppConfig.overdueLangCode,
            accessUpdateTemplateName: whatsAppConfig.accessUpdateTemplateName,
            accessUpdateLangCode: whatsAppConfig.accessUpdateLangCode,
            serviceResumeDate: whatsAppConfig.serviceResumeDate,
            paymentMethods: whatsAppConfig.paymentMethods,
            paymentPhone: whatsAppConfig.paymentPhone,
            paymentContactName: whatsAppConfig.paymentContactName,
            accessToken: whatsAppTokenInput,
          })

          setSuccess('Configuración de WhatsApp guardada correctamente.')
          setWhatsAppTokenInput('')
          await cargarWhatsAppConfig()
          await cargarActividad()
        } catch (error) {
          setError(getErrorMessage(error, 'Error guardando configuración de WhatsApp.'))
        }
      },
    })
  }

  function toggleWhatsAppEnabled(enabled: boolean) {
    limpiarMensajes()

    openConfirmModal({
      title: enabled ? 'Activar WhatsApp' : 'Desactivar WhatsApp',
      message: enabled
        ? 'Se activará el envío automático por WhatsApp.'
        : 'Se desactivará el envío automático por WhatsApp.',
      type: enabled ? 'success' : 'warning',
      confirmText: enabled ? 'Activar' : 'Desactivar',
      onConfirm: async () => {
        try {
          await setWhatsAppEnabled(enabled)

          setWhatsAppConfig((prev) => ({ ...prev, enabled }))
          setSuccess(enabled ? 'WhatsApp activado.' : 'WhatsApp desactivado.')
          await cargarActividad()
        } catch (error) {
          setError(getErrorMessage(error, 'Error cambiando estado de WhatsApp.'))
        }
      },
    })
  }

  function runWhatsAppDueTodayNow() {
    limpiarMensajes()

    openConfirmModal({
      title: 'Enviar recordatorios',
      message: 'Se ejecutará el envío manual de los mensajes que vencen mañana, hoy y vencidos.',
      type: 'info',
      confirmText: 'Ejecutar',
      onConfirm: async () => {
        try {
          const result = await sendWhatsAppDueToday()

          setSuccess(
            `Proceso ejecutado. Manana: ${result.dueTomorrowSent || 0}, hoy: ${result.dueTodaySent || 0}, vencidos: ${result.overdueSent || 0}, omitidos: ${result.skipped || 0}, errores: ${result.errors || 0}.${result.message ? ` ${result.message}.` : ''}`
          )

          await cargarVentas()
          await cargarWhatsAppLogs()
          await cargarDashboard()
          await cargarActividad()
        } catch (error) {
          setError(getErrorMessage(error, 'Error ejecutando envío de WhatsApp.'))
        }
      },
    })
  }

  async function runWhatsAppTest() {
    limpiarMensajes()

    try {
      const result = await sendWhatsAppTest({
        to: whatsAppTestForm.to,
        mode: whatsAppTestForm.mode,
        cliente: whatsAppTestForm.cliente,
        fechaCierre: whatsAppTestForm.fechaCierre,
        monto: whatsAppTestForm.monto,
        correoCuenta: whatsAppTestForm.correoCuenta,
        passwordCuenta: whatsAppTestForm.passwordCuenta,
      })

      setLastWhatsAppTest(result)

      setSuccess(getWhatsAppTestSuccessMessage(whatsAppTestForm.mode))
      await cargarWhatsAppLogs()
      await cargarActividad()
    } catch (error) {
      setError(getErrorMessage(error, 'Error enviando la prueba de WhatsApp.'))
    }
  }

  async function responderWhatsAppChat() {
    limpiarMensajes()

    if (!selectedWhatsAppChatPhone) {
      setError('Selecciona una conversación para responder.')
      return
    }

    if (!whatsAppReplyText.trim()) {
      setError('Escribe un mensaje antes de responder.')
      return
    }

    try {
      setSendingWhatsAppReply(true)
      await sendWhatsAppChatReply(selectedWhatsAppChatPhone, {
        text: whatsAppReplyText,
      })

      setSuccess(`Respuesta enviada correctamente a ${selectedWhatsAppChatPhone}.`)
      setWhatsAppReplyText('')
      await Promise.all([
        cargarWhatsAppChats(selectedWhatsAppChatPhone),
        cargarWhatsAppChatMessages(selectedWhatsAppChatPhone),
        cargarWhatsAppLogs(),
        cargarActividad(),
      ])
    } catch (error) {
      setError(getErrorMessage(error, 'Error respondiendo el chat de WhatsApp.'))
    } finally {
      setSendingWhatsAppReply(false)
    }
  }

  function clearHistory() {
    limpiarMensajes()

    openConfirmModal({
      title: 'Limpiar historial',
      message: 'Se limpiará el historial de bajas y los logs de WhatsApp.',
      type: 'danger',
      confirmText: 'Limpiar',
      onConfirm: async () => {
        try {
          await clearMaintenanceHistory()
          setSuccess('Historial limpiado correctamente.')
          await cargarHistorialBajas()
          await cargarWhatsAppLogs()
          await cargarActividad()
        } catch (error) {
          setError(getErrorMessage(error, 'Error limpiando historial.'))
        }
      },
    })
  }

  function editarUsuario(usuario: UsuarioSistema) {
    limpiarMensajes()
    setEditingUserId(usuario.id)
    setUserForm({
      nombre: usuario.nombre,
      correo: usuario.correo,
      password: '',
      rol: usuario.rol,
      activo: usuario.activo,
    })
    setActiveTab('configuracion')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resumen = dashboardResumen?.metricas ?? emptyDashboard.metricas
  const rentabilidad = dashboardResumen?.rentabilidad ?? emptyDashboard.rentabilidad

  const manualAccounts = useMemo(() => {
    const selectedId = Number(ventaForm.cuentaAccesoId || 0)

    return [...cuentas]
      .filter((cuenta) => cuenta.activa || cuenta.id === selectedId)
      .sort((a, b) => a.correo.localeCompare(b.correo))
  }, [cuentas, ventaForm.cuentaAccesoId])

  const bestAutoAccount = useMemo<CuentaAcceso | null>(() => {
    const disponibles = [...cuentas]
      .filter((cuenta) => cuenta.activa)
      .filter((cuenta) => Number(cuenta.used || 0) < Number(cuenta.capacidad || 0))
      .sort((a, b) => {
        if ((a.used || 0) !== (b.used || 0)) return (a.used || 0) - (b.used || 0)
        return a.correo.localeCompare(b.correo)
      })

    return disponibles[0] || null
  }, [cuentas])

  const selectedCuentaPreview = useMemo<CuentaAcceso | null>(() => {
    if (ventaForm.assignmentMode === 'manual') {
      return (
        manualAccounts.find(
          (cuenta) => String(cuenta.id) === String(ventaForm.cuentaAccesoId)
        ) || null
      )
    }

    return bestAutoAccount || null
  }, [manualAccounts, ventaForm.cuentaAccesoId, ventaForm.assignmentMode, bestAutoAccount])

  const correosDisponibles = useMemo(() => {
    const values = new Set<string>()

    cuentas.forEach((cuenta) => {
      if (cuenta.correo) values.add(cuenta.correo)
    })

    ventas.forEach((venta) => {
      const correo = venta.cuentaAcceso?.correo
      if (correo) values.add(correo)
    })

    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [cuentas, ventas])

  function handleTipoDispositivoSelect(tipo: string) {
    setVentaForm((prev) => {
      const actuales = getSelectedTipos(prev.tipoDispositivo)
      const siguientes = actuales.includes(tipo)
        ? actuales.filter((t) => t !== tipo)
        : [...actuales, tipo]

      return {
        ...prev,
        tipoDispositivo: siguientes.join(', '),
        otroTipoDispositivo:
          tipo === DISPOSITIVO_OTRO && !siguientes.includes(DISPOSITIVO_OTRO)
            ? ''
            : prev.otroTipoDispositivo,
        cantidadDispositivos: (() => {
          const nextForm = {
            ...prev,
            tipoDispositivo: siguientes.join(', '),
            otroTipoDispositivo:
              tipo === DISPOSITIVO_OTRO && !siguientes.includes(DISPOSITIVO_OTRO)
                ? ''
                : prev.otroTipoDispositivo,
          }
          const total = countVentaDevices(nextForm)
          return total ? String(total) : ''
        })(),
      }
    })
  }

  const dueTodayRows = useMemo(() => dashboardResumen?.dueTodayRows ?? [], [dashboardResumen])
  const overdueRows = useMemo(() => dashboardResumen?.overdueRows ?? [], [dashboardResumen])

  const estadoChartData = useMemo(
    () => [
      { label: 'Pagadas', value: resumen.pagadas, color: '#22c55e' },
      { label: 'Pendientes', value: resumen.pendientes, color: '#f59e0b' },
      { label: 'Mensaje enviado', value: resumen.mensajesEnviados, color: '#38bdf8' },
      { label: 'Bajas', value: resumen.bajas, color: '#f87171' },
    ],
    [resumen]
  )

  const topRentabilidad = useMemo(() => {
    return [...rentabilidad.porCorreo]
      .filter((item) => item.ingresos > 0 || item.clientes > 0)
      .sort((a, b) => b.ingresos - a.ingresos)
      .slice(0, 6)
  }, [rentabilidad])

  const capacidadChartData = useMemo(() => {
    return [...cuentas]
      .filter((cuenta) => cuenta.capacidad > 0)
      .sort((a, b) => {
        const ratioA = (a.used || 0) / Math.max(1, a.capacidad || 0)
        const ratioB = (b.used || 0) / Math.max(1, b.capacidad || 0)
        return ratioB - ratioA
      })
      .slice(0, 6)
  }, [cuentas])

  const cobranzaPorcentaje = useMemo(() => {
    const total = resumen.pagadas + resumen.pendientes + resumen.mensajesEnviados
    if (!total) return 0
    return Math.round((resumen.pagadas / total) * 100)
  }, [resumen])

  const dashboardScopeText = useMemo(() => {
    const scope = dashboardResumen?.scope
    if (!scope) return 'Vista global'
    if (scope.mode === 'range') {
      return `Rango ${formatDateDisplay(scope.dateFrom)} al ${formatDateDisplay(scope.dateTo)}`
    }
    if (scope.isGlobal) return 'Vista global'
    if (scope.month && scope.year) {
      return `Mes ${String(scope.month).padStart(2, '0')}/${scope.year}`
    }
    return 'Vista global'
  }, [dashboardResumen])

  const cuentasEnAlerta = useMemo(
    () => cuentas.filter((cuenta) => cuenta.alertLevel && cuenta.alertLevel !== 'NORMAL'),
    [cuentas]
  )

  const capacidadLibreTotal = useMemo(
    () => cuentas.reduce((sum, cuenta) => sum + Number(cuenta.free ?? Math.max(0, (cuenta.capacidad || 0) - (cuenta.used || 0))), 0),
    [cuentas]
  )

  const clientesConDeudaCount = useMemo(
    () => clientes.filter((cliente) => Number(cliente.deudaPendiente || 0) > 0).length,
    [clientes]
  )

  const deudaClientesTotal = useMemo(
    () => clientes.reduce((sum, cliente) => sum + Number(cliente.deudaPendiente || 0), 0),
    [clientes]
  )

  const usuariosActivosCount = useMemo(
    () => users.filter((usuario) => usuario.activo).length,
    [users]
  )

  const usuariosAdminCount = useMemo(
    () => users.filter((usuario) => usuario.rol === 'ADMIN').length,
    [users]
  )

  const usuariosOperadorCount = useMemo(
    () => users.filter((usuario) => usuario.rol === 'OPERADOR').length,
    [users]
  )

  const morososFiltrados = useMemo(() => {
    const query = normalizeText(searchMoroso)

    return [...overdueRows]
      .filter((venta) => {
        if (!query) return true

        const blob = normalizeText(
          `${venta.cliente?.nombre || ''} ${venta.cliente?.telefono || ''} ${venta.cuentaAcceso?.correo || ''} ${venta.tipoDispositivo || ''} ${venta.observacion || ''}`
        )

        return blob.includes(query)
      })
      .sort((a, b) => {
        const diasB = getDaysOverdue(b.fechaCierre)
        const diasA = getDaysOverdue(a.fechaCierre)
        if (diasB !== diasA) return diasB - diasA
        return String(a.cliente?.nombre || '').localeCompare(String(b.cliente?.nombre || ''))
      })
  }, [overdueRows, searchMoroso])

  const morososMontoTotal = useMemo(() => {
    return morososFiltrados.reduce((sum, venta) => {
      const monto = Number(venta.monto || 0)
      const descuento = Number(venta.descuento || 0)
      return sum + Math.max(0, monto - descuento)
    }, 0)
  }, [morososFiltrados])

  const morososMayorAtraso = useMemo(() => {
    return morososFiltrados.reduce((max, venta) => Math.max(max, getDaysOverdue(venta.fechaCierre)), 0)
  }, [morososFiltrados])

  const morososMensajesEnviados = useMemo(() => {
    return morososFiltrados.filter((venta) => venta.estado === 'MENSAJE_ENVIADO').length
  }, [morososFiltrados])

  const clientesFiltrados = useMemo(() => {
    const q = normalizeText(searchCliente)
    return clientes
      .filter((c) => {
        if (!q) return true
        const blob = normalizeText(
          `${c.nombre} ${c.telefono} ${c.monto} ${c.carpeta} ${c.observacion || ''}`
        )
        return blob.includes(q)
      })
      .sort((a, b) => a.id - b.id)
  }, [clientes, searchCliente])

  const cuentasFiltradas = useMemo(() => {
    const q = normalizeText(searchCuenta)
    return cuentas
      .filter((c) => {
        if (!q) return true
        const blob = normalizeText(`${c.correo} ${c.observacion || ''}`)
        return blob.includes(q)
      })
      .sort((a, b) => a.id - b.id)
  }, [cuentas, searchCuenta])

  const usuariosOrdenados = useMemo(() => [...users].sort((a, b) => a.id - b.id), [users])

  const ventasFiltradas = ventas

  const cantidadTiposSeleccionados = countVentaDevices(ventaForm)
  const ventaStatusSummary = getVentaStatusSummary(ventaForm)
  const isAdmin = currentUser?.rol === 'ADMIN'
  const selectedWhatsAppChat = useMemo(
    () => whatsAppChats.find((chat) => chat.telefono === selectedWhatsAppChatPhone) || null,
    [whatsAppChats, selectedWhatsAppChatPhone]
  )
  const defaultWhatsAppWebhookUrl = `${(import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '')}/webhooks/whatsapp`
  const whatsAppWebhookUrl =
    normalizeWebhookUrl(whatsAppConfig.webhookUrl) || defaultWhatsAppWebhookUrl
  const visibleNavItems = useMemo(
    () =>
      [
        { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { key: 'morosos', label: 'Morosos', icon: 'morosos' },
        { key: 'registro', label: 'Registrar / Editar', icon: 'registro' },
        { key: 'ventas', label: 'Ventas', icon: 'ventas' },
        { key: 'clientes', label: 'Clientes', icon: 'clientes' },
        ...(isAdmin ? [{ key: 'cuentas', label: 'Cuentas', icon: 'cuentas' }] : []),
        { key: 'chats', label: 'Chats', icon: 'whatsapp' },
        { key: 'historial', label: 'Historial', icon: 'historial' },
        { key: 'configuracion', label: 'Configuración', icon: 'configuracion' },
      ] as Array<{ key: TabKey; label: string; icon: Parameters<typeof AppIcon>[0]['name'] }>,
    [isAdmin]
  )
  const activeNavItem = useMemo(
    () => visibleNavItems.find((item) => item.key === activeTab) ?? visibleNavItems[0],
    [activeTab, visibleNavItems]
  )

  function handleTabSelect(key: TabKey) {
    setActiveTab(key)
    if (isMobile) {
      setMobileNavOpen(false)
    }
  }

  if (!authReady) {
    return (
      <AuthCard
        title="Cargando sesión"
        subtitle="Estoy verificando el estado del sistema y tu autenticación."
        icon="shield"
      >
        <p style={{ margin: 0, color: '#cbd5e1' }}>Un momento...</p>
      </AuthCard>
    )
  }

  if (!currentUser) {
    if (setupRequired) {
      return (
        <AuthCard
          title="Crear administrador"
          subtitle="Esta es la primera vez que se inicia el sistema. Crea la cuenta administradora inicial."
          icon="shield"
        >
          <form onSubmit={submitBootstrap} style={{ display: 'grid', gap: '14px' }}>
            {error && <Alert type="error" text={error} />}
            {success && <Alert type="success" text={success} />}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                border: `1px solid ${healthStatus?.dbOk ? 'rgba(34,197,94,0.4)' : 'rgba(248,113,113,0.35)'}`,
                background: healthStatus?.dbOk ? 'rgba(20,83,45,0.28)' : 'rgba(69,10,10,0.22)',
                color: healthStatus?.dbOk ? '#bbf7d0' : '#fecaca',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                {healthStatus?.dbOk ? 'Backend conectado' : 'Backend con problemas'}
              </div>
              <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
                {healthStatus?.dbOk
                  ? 'La base de datos está accesible y ya puedes crear el administrador inicial.'
                  : healthStatus?.error || 'No se pudo verificar correctamente el estado del backend.'}
              </div>
            </div>
            <input
              value={setupForm.nombre}
              onChange={(e) => setSetupForm((prev) => ({ ...prev, nombre: e.target.value }))}
              placeholder="Nombre"
              style={inputStyle}
            />
            <input
              value={setupForm.correo}
              onChange={(e) => setSetupForm((prev) => ({ ...prev, correo: e.target.value }))}
              placeholder="Correo"
              style={inputStyle}
            />
            <input
              type="password"
              value={setupForm.password}
              onChange={(e) => setSetupForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Contraseña"
              style={inputStyle}
            />
            <button type="submit" style={buttonPrimary}>
              Crear administrador
            </button>
            <button type="button" onClick={retryAuthCheck} style={buttonSecondary}>
              Reintentar conexión
            </button>
          </form>
        </AuthCard>
      )
    }

    return (
      <AuthCard
        title="Ingresar al sistema"
        subtitle="Accede con tu usuario para administrar ventas, pagos y cobranza."
        icon="login"
        >
          <form onSubmit={submitLogin} style={{ display: 'grid', gap: '14px' }}>
            {error && <Alert type="error" text={error} />}
            {success && <Alert type="success" text={success} />}
            {healthStatus && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: `1px solid ${healthStatus.dbOk ? 'rgba(34,197,94,0.4)' : 'rgba(248,113,113,0.35)'}`,
                  background: healthStatus.dbOk ? 'rgba(20,83,45,0.28)' : 'rgba(69,10,10,0.22)',
                  color: healthStatus.dbOk ? '#bbf7d0' : '#fecaca',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                  {healthStatus.dbOk ? 'Backend conectado' : 'Backend con problemas'}
                </div>
                <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
                  {healthStatus.dbOk
                    ? 'Puedes ingresar con tu correo y contraseña.'
                    : healthStatus.error || 'No se pudo verificar correctamente el estado del backend.'}
                </div>
              </div>
            )}
            <input
              value={authForm.correo}
              onChange={(e) => setAuthForm((prev) => ({ ...prev, correo: e.target.value }))}
            placeholder="Correo"
            style={inputStyle}
          />
          <input
            type="password"
            value={authForm.password}
            onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
            placeholder="Contraseña"
            style={inputStyle}
          />
            <button type="submit" style={buttonPrimary}>
              Iniciar sesión
            </button>
            <button type="button" onClick={retryAuthCheck} style={buttonSecondary}>
              Reintentar conexión
            </button>
          </form>
        </AuthCard>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        overflowX: 'hidden',
        background: 'linear-gradient(135deg, #020617 0%, #0f172a 45%, #111827 100%)',
        padding: isMobile ? '12px' : '16px 20px 16px 0',
        fontFamily: 'Arial, sans-serif',
        color: '#e5e7eb',
      }}
    >
      <div style={{ width: '100%', maxWidth: 'none', margin: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '260px minmax(0, 1fr)',
            gap: isMobile ? '14px' : '20px',
            alignItems: 'start',
          }}
        >
          {!isMobile && (
            <SidebarNav
              activeKey={activeTab}
              items={visibleNavItems}
              onSelect={(key) => handleTabSelect(key as TabKey)}
              title="SISTEMA DE COBRO"
              subtitle="Gestión de clientes, pagos y cobranza"
              userName={currentUser.nombre}
              userRole={currentUser.rol}
              isMobile={false}
              onLogout={() => void performLogout()}
            />
          )}

          <main style={{ minWidth: 0, width: '100%', paddingLeft: isMobile ? 0 : '6px' }}>
            {isMobile && (
              <div style={{ marginBottom: '14px' }}>
                <div
                  style={{
                    ...cardStyle,
                    padding: '14px 16px',
                    display: 'grid',
                    gap: '12px',
                    background:
                      'radial-gradient(circle at top left, rgba(59,130,246,0.16), transparent 40%), linear-gradient(135deg, rgba(15,23,42,0.98), rgba(12,18,34,0.96))',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          color: '#60a5fa',
                          fontSize: '11px',
                          fontWeight: 800,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          marginBottom: '4px',
                        }}
                      >
                        Sistema de Cobro
                      </div>
                      <div
                        style={{
                          color: '#f8fafc',
                          fontSize: '20px',
                          fontWeight: 800,
                          lineHeight: 1.15,
                        }}
                      >
                        {activeNavItem?.label || 'Dashboard'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMobileNavOpen((prev) => !prev)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '11px 14px',
                        borderRadius: '14px',
                        border: '1px solid rgba(96,165,250,0.35)',
                        background: mobileNavOpen ? 'rgba(37,99,235,0.22)' : 'rgba(15,23,42,0.9)',
                        color: '#f8fafc',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <AppIcon name="menu" />
                      {mobileNavOpen ? 'Ocultar menú' : 'Abrir menú'}
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ color: '#cbd5e1', fontSize: '14px' }}>
                      {currentUser.nombre} · {currentUser.rol}
                    </div>
                    <button
                      type="button"
                      onClick={() => void performLogout()}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '9px 12px',
                        borderRadius: '12px',
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
                </div>

                {mobileNavOpen && (
                  <div style={{ marginTop: '12px' }}>
                    <SidebarNav
                      activeKey={activeTab}
                      items={visibleNavItems}
                      onSelect={(key) => handleTabSelect(key as TabKey)}
                      title="Menú"
                      subtitle="Toca una sección y el menú se ocultará automáticamente."
                      userName={currentUser.nombre}
                      userRole={currentUser.rol}
                      isMobile
                      onLogout={() => void performLogout()}
                    />
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              {error && <Alert type="error" text={error} />}
              {success && <Alert type="success" text={success} />}
            </div>

            {activeTab === 'dashboard' && (
              <>
                {loadingDashboard && (
                  <div style={{ ...cardStyle, marginBottom: '16px' }}>
                    <p style={{ margin: 0 }}>Cargando dashboard...</p>
                  </div>
                )}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.4fr) minmax(320px, 0.9fr)',
                    gap: '18px',
                    marginBottom: '24px',
                    alignItems: 'stretch',
                  }}
                >
                  <div
                    style={{
                      ...cardStyle,
                      background:
                        'radial-gradient(circle at top left, rgba(59,130,246,0.22), transparent 38%), linear-gradient(135deg, rgba(15,23,42,0.98), rgba(12,18,34,0.96))',
                      border: '1px solid rgba(96,165,250,0.25)',
                    }}
                  >
                    <div style={{ color: '#60a5fa', fontSize: '12px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                      Dashboard comercial
                    </div>
                    <h2 style={{ margin: '10px 0 8px', color: '#f8fafc', fontSize: '30px' }}>
                      Pulso operativo y cobranza en tiempo real
                    </h2>
                    <p style={{ margin: 0, color: '#cbd5e1', maxWidth: '720px', lineHeight: 1.7 }}>
                      {cobranzaPorcentaje}% de las ventas activas ya están pagadas. Hoy tienes{' '}
                      <b style={{ color: '#f8fafc' }}>{resumen.vencenHoy}</b> vencimientos y{' '}
                      <b style={{ color: '#f8fafc' }}>{resumen.vencidos}</b> clientes atrasados.
                    </p>
                    <div
                      style={{
                        marginTop: '18px',
                        display: 'grid',
                        gap: '12px',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        alignItems: 'end',
                      }}
                    >
                      <div>
                        <div style={formLabelStyle}>Desde</div>
                        <input
                          type="date"
                          value={dashboardDateFrom}
                          onChange={(e) => setDashboardDateFrom(e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <div style={formLabelStyle}>Hasta</div>
                        <input
                          type="date"
                          value={dashboardDateTo}
                          onChange={(e) => setDashboardDateTo(e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                      <button type="button" onClick={() => void applyDashboardRange()} style={buttonPrimary}>
                        Aplicar rango
                      </button>
                      <button type="button" onClick={() => void resetDashboardRange()} style={buttonSecondary}>
                        Vista global
                      </button>
                    </div>
                    <div
                      style={{
                        marginTop: '12px',
                        display: 'flex',
                        gap: '10px',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                      }}
                    >
                      <span style={badgeActive}>{dashboardScopeText}</span>
                      {healthStatus && (
                        <span style={healthStatus.dbOk ? badgeActive : badgeInactive}>
                          {healthStatus.dbOk ? 'Backend operativo' : 'Backend degradado'}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: '20px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: '12px',
                      }}
                    >
                      <DashboardMiniStat
                        label="Ingresos cobrados"
                        value={formatCurrencyPen(rentabilidad.totalIngresos)}
                        accent="#4ade80"
                      />
                      <DashboardMiniStat
                        label="Neto operativo"
                        value={formatCurrencyPen(rentabilidad.netoOperativo)}
                        accent={rentabilidad.netoOperativo >= 0 ? '#38bdf8' : '#f87171'}
                      />
                      <DashboardMiniStat
                        label="Cobranza"
                        value={`${cobranzaPorcentaje}%`}
                        accent="#fbbf24"
                      />
                    </div>
                  </div>

                  <div style={{ ...cardStyle, display: 'grid', gap: '14px' }}>
                    <DashboardProgressRow
                      label="Pendientes"
                      value={resumen.pendientes}
                      total={Math.max(1, resumen.totalVentas)}
                      color="#f59e0b"
                    />
                    <DashboardProgressRow
                      label="Pagadas"
                      value={resumen.pagadas}
                      total={Math.max(1, resumen.totalVentas)}
                      color="#22c55e"
                    />
                    <DashboardProgressRow
                      label="Mensaje enviado"
                      value={resumen.mensajesEnviados}
                      total={Math.max(1, resumen.totalVentas)}
                      color="#38bdf8"
                    />
                    <DashboardProgressRow
                      label="Bajas"
                      value={resumen.bajas}
                      total={Math.max(1, resumen.totalVentas)}
                      color="#f87171"
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '18px',
                    marginBottom: '24px',
                    alignItems: 'stretch',
                  }}
                >
                  <StatCard title="Total clientes" value={String(resumen.totalClientes)} />
                  <StatCard title="Total ventas" value={String(resumen.totalVentas)} />
                  <StatCard title="Cuentas activas" value={String(resumen.cuentasActivas)} accent="#60a5fa" />
                  <StatCard title="Pagadas" value={String(resumen.pagadas)} accent="#4ade80" />
                  <StatCard title="Pendientes" value={String(resumen.pendientes)} accent="#fbbf24" />
                  <StatCard title="Bajas" value={String(resumen.bajas)} accent="#f87171" />
                  <StatCard title="Vencen hoy" value={String(resumen.vencenHoy)} accent="#fb923c" />
                  <StatCard title="Vencidos" value={String(resumen.vencidos)} accent="#ef4444" />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isPhone ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: '16px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={cardStyle}>
                    <h3 style={{ marginTop: 0, marginBottom: '18px', color: '#f8fafc' }}>Estado de cartera</h3>
                    <DashboardDonutChart
                      segments={estadoChartData}
                      centerValue={String(resumen.totalVentas)}
                      centerLabel="ventas"
                    />
                  </div>

                  <div style={cardStyle}>
                    <h3 style={{ marginTop: 0, marginBottom: '18px', color: '#f8fafc' }}>Ingresos por cuenta</h3>
                    {topRentabilidad.length === 0 ? (
                      <p style={{ margin: 0, color: '#94a3b8' }}>Aún no hay ingresos cobrados para graficar.</p>
                    ) : (
                      <DashboardBarChart
                        items={topRentabilidad.map((item) => ({
                          label: item.correo,
                          value: item.ingresos,
                          subtitle: `${item.clientes} clientes • neto ${formatCurrencyPen(item.neto)}`,
                          color: item.neto >= 0 ? '#38bdf8' : '#f87171',
                        }))}
                        valueFormatter={(value) => formatCurrencyPen(value)}
                      />
                    )}
                  </div>

                  <div style={cardStyle}>
                    <h3 style={{ marginTop: 0, marginBottom: '18px', color: '#f8fafc' }}>Uso de capacidad</h3>
                    {capacidadChartData.length === 0 ? (
                      <p style={{ margin: 0, color: '#94a3b8' }}>No hay cuentas registradas.</p>
                    ) : (
                      <DashboardCapacityChart items={capacidadChartData} />
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isPhone ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '16px',
                  }}
                >
                  <div style={cardStyle}>
                    <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Resumen económico</h3>
                    <DashboardMetricLine label="Monto total" value={formatCurrencyPen(resumen.montoTotal)} />
                    <DashboardMetricLine label="Descuento total" value={formatCurrencyPen(resumen.descuentoTotal)} />
                    <DashboardMetricLine label="Neto estimado" value={formatCurrencyPen(resumen.netoEstimado)} strong />
                  </div>

                  <div style={cardStyle}>
                    <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Rentabilidad</h3>
                    <DashboardMetricLine label="Ingresos cobrados" value={formatCurrencyPen(rentabilidad.totalIngresos)} />
                    <DashboardMetricLine label="Costo ChatGPT" value={formatCurrencyPen(rentabilidad.costoChatGPT)} />
                    <DashboardMetricLine label="Neto operativo" value={formatCurrencyPen(rentabilidad.netoOperativo)} strong />
                  </div>

                  <div style={cardStyle}>
                    <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Vencen hoy</h3>
                    <DashboardSalesList items={dueTodayRows} emptyText="No hay clientes que venzan hoy." />
                  </div>

                  <div style={cardStyle}>
                    <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Vencidos</h3>
                    <DashboardSalesList items={overdueRows} emptyText="No hay clientes vencidos." />
                  </div>

                  <div style={cardStyle}>
                    <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Asignación</h3>
                    <DashboardMetricLine label="Total cuentas" value={String(resumen.totalCuentas)} />
                    <DashboardMetricLine label="Cuentas activas" value={String(resumen.cuentasActivas)} />
                    <DashboardMetricLine
                      label="Mejor cuenta automática"
                      value={
                        bestAutoAccount
                          ? `${bestAutoAccount.correo} (${bestAutoAccount.used}/${bestAutoAccount.capacidad})`
                          : 'Sin disponible'
                      }
                      strong
                    />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'morosos' && (
              <div style={{ display: 'grid', gap: '20px' }}>
                <div
                  style={{
                    ...cardStyle,
                    background:
                      'radial-gradient(circle at top left, rgba(248,113,113,0.2), transparent 34%), linear-gradient(135deg, rgba(15,23,42,0.98), rgba(24,24,27,0.98))',
                    border: '1px solid rgba(248,113,113,0.18)',
                  }}
                >
                  <div style={{ color: '#fca5a5', fontSize: '12px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    Seguimiento de cobranza
                  </div>
                  <h2 style={{ margin: '10px 0 8px', color: '#f8fafc', fontSize: '30px' }}>Centro de morosos</h2>
                  <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.7 }}>
                    Aquí tienes los clientes vencidos para actuar rápido: cobrar, editar la venta o abrir WhatsApp
                    desde la misma vista.
                  </p>

                  <div
                    style={{
                      marginTop: '20px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '12px',
                    }}
                  >
                    <DashboardMiniStat label="Morosos" value={String(morososFiltrados.length)} accent="#f87171" />
                    <DashboardMiniStat
                      label="Monto comprometido"
                      value={formatCurrencyPen(morososMontoTotal)}
                      accent="#fbbf24"
                    />
                    <DashboardMiniStat
                      label="Mayor atraso"
                      value={`${morososMayorAtraso} días`}
                      accent="#fb7185"
                    />
                    <DashboardMiniStat
                      label="Mensajes enviados"
                      value={String(morososMensajesEnviados)}
                      accent="#38bdf8"
                    />
                  </div>
                </div>

                <div style={cardStyle}>
                  <div style={headerRowStyle}>
                    <h2 style={{ margin: 0, color: '#f8fafc' }}>Listado de morosos</h2>
                    <input
                      value={searchMoroso}
                      onChange={(e) => setSearchMoroso(e.target.value)}
                      placeholder="Buscar por cliente, teléfono, correo o dispositivo"
                      style={{ ...inputStyle, maxWidth: '420px' }}
                    />
                  </div>

                  {morososFiltrados.length === 0 ? (
                    <p style={{ margin: 0, color: '#94a3b8' }}>No hay clientes morosos con los filtros actuales.</p>
                  ) : (
                    <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', paddingBottom: '6px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1450px', tableLayout: 'auto' }}>
                        <thead>
                          <tr style={{ background: '#0f172a' }}>
                            <th style={thStyle}>Cliente</th>
                            <th style={thStyle}>Teléfono</th>
                            <th style={thStyle}>Cuenta</th>
                            <th style={thStyle}>Cierre</th>
                            <th style={thStyle}>Mes pendiente</th>
                            <th style={thStyle}>Días de atraso</th>
                            <th style={thStyle}>Monto neto</th>
                            <th style={thStyle}>Estado</th>
                            <th style={thStyle}>Dispositivo</th>
                            <th style={thStyle}>Observación</th>
                            <th style={{ ...thStyle, width: '280px', whiteSpace: 'nowrap' }}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {morososFiltrados.map((venta) => (
                            <tr key={venta.id}>
                              <td style={tdStyle}>{venta.cliente?.nombre || '-'}</td>
                              <td style={tdStyle}>{venta.cliente?.telefono || '-'}</td>
                              <td style={tdStyle}>{venta.cuentaAcceso?.correo || '-'}</td>
                              <td style={tdStyle}>{formatDateDisplay(venta.fechaCierre)}</td>
                              <td style={tdStyle}>{formatMonthYearLabel(venta.fechaCierre)}</td>
                              <td style={tdStyle}>{getDaysOverdue(venta.fechaCierre)} días</td>
                              <td style={tdStyle}>{formatCurrencyPen(Number(venta.monto || 0) - Number(venta.descuento || 0))}</td>
                              <td style={tdStyle}>
                                <span style={estadoBadge(venta.estado)}>{venta.estado}</span>
                              </td>
                              <td style={tdStyle}>{venta.tipoDispositivo || '-'}</td>
                              <td style={tdStyle}>{venta.observacion || '-'}</td>
                              <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                <div style={actionsStyle}>
                                  <button
                                    type="button"
                                    onClick={() => registrarPagoVenta(venta)}
                                    style={buttonSuccess}
                                  >
                                    Registrar pago
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => abrirWhatsAppMoroso(venta)}
                                    style={buttonInfo}
                                  >
                                    WhatsApp
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => editarVenta(venta)}
                                    style={buttonSecondary}
                                  >
                                    Editar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(activeTab === 'registro' || activeTab === 'ventas') && (
              <>
                {activeTab === 'registro' && (
                  <div style={{ display: 'grid', gap: '20px' }}>
                    <div style={{ ...cardStyle, width: '100%', minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ marginBottom: '14px' }}>
                        <h2 style={{ marginTop: 0, color: '#f8fafc' }}>Registrar / Editar venta</h2>
                        <p style={{ marginTop: '6px', color: '#94a3b8', fontSize: '14px' }}>
                          Registra el mes activo del cliente y elige si el pago ya fue recibido o si debe quedar pendiente.
                        </p>
                      </div>

                      <div
                        style={{
                          border: '1px solid #1e293b',
                          borderRadius: '16px',
                          overflow: 'hidden',
                          background: 'rgba(2, 6, 23, 0.35)',
                        }}
                      >
                        <div
                          style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid #1e293b',
                            textAlign: 'center',
                            color: '#e2e8f0',
                            fontWeight: 700,
                          }}
                        >
                          Formulario
                        </div>

                        <form onSubmit={guardarVenta} style={{ padding: '16px' }}>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(280px, 1fr))',
                              columnGap: '18px',
                              rowGap: '18px',
                              alignItems: 'start',
                            }}
                          >
                            <div>
                              <label style={formLabelStyle}>Cliente *</label>
                              <input
                                name="cliente"
                                placeholder="Nombre del cliente"
                                value={ventaForm.cliente || ''}
                                onChange={handleVentaChange}
                                style={inputStyle}
                              />
                            </div>

                            <div>
                              <label style={formLabelStyle}>Teléfono *</label>
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: isPhone ? 'minmax(0, 1fr)' : '150px minmax(0, 1fr)',
                                  gap: '12px',
                                }}
                              >
                                <select
                                  value={telefonoPais}
                                  onChange={(e) => setTelefonoPais(e.target.value)}
                                  style={inputStyle}
                                >
                                  {PHONE_COUNTRIES.map((country) => (
                                    <option key={country.dialCode} value={country.dialCode}>
                                      {country.label}
                                    </option>
                                  ))}
                                </select>

                                 <input
                                   name="telefono"
                                   placeholder="Ej: 950000000"
                                   value={ventaForm.telefono}
                                   onChange={handleVentaChange}
                                   style={inputStyle}
                                 />
                               </div>
                               {matchedClienteByPhone && (
                                 <div style={{ marginTop: '8px', color: '#86efac', fontSize: '12px' }}>
                                   Cliente encontrado: se cargaron automáticamente nombre, monto, carpeta y observación de{' '}
                                   <b>{matchedClienteByPhone.nombre}</b>.
                                 </div>
                               )}
                             </div>

                            <div>
                              <label style={formLabelStyle}>Fecha de inicio *</label>
                               <input
                                 type="date"
                                 name="fechaInicio"
                                 value={ventaForm.fechaInicio}
                                 onChange={handleVentaChange}
                                 style={inputStyle}
                               />
                               <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '12px' }}>
                                 Al elegir la fecha de inicio, el sistema propone automáticamente 1 mes para la fecha de cierre.
                               </div>
                             </div>

                            <div>
                              <label style={formLabelStyle}>Fecha de cierre *</label>
                               <input
                                 type="date"
                                 name="fechaCierre"
                                 value={ventaForm.fechaCierre}
                                 onChange={handleVentaChange}
                                 style={inputStyle}
                               />
                               {ventaForm.fechaCierre && (
                                 <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '12px' }}>
                                   Mes de referencia: <b style={{ color: '#f8fafc' }}>{formatMonthYearLabel(ventaForm.fechaCierre)}</b>
                                 </div>
                               )}
                             </div>

                            <div>
                              <label style={formLabelStyle}>Monto (S/.) *</label>
                              <input
                                type="number"
                                name="monto"
                                placeholder="Monto"
                                value={ventaForm.monto}
                                onChange={handleVentaChange}
                                style={inputStyle}
                              />
                            </div>

                            <div>
                              <label style={formLabelStyle}>Descuento (S/.)</label>
                              <input
                                type="number"
                                name="descuento"
                                placeholder="Descuento"
                                value={ventaForm.descuento}
                                onChange={handleVentaChange}
                                style={inputStyle}
                              />
                            </div>

                            <div>
                              <label style={formLabelStyle}>Pago recibido</label>
                              <select
                                name="pagoRegistrado"
                                value={ventaForm.pagoRegistrado}
                                onChange={handleVentaChange}
                                disabled={ventaForm.estado === 'BAJA'}
                                style={{
                                  ...inputStyle,
                                  opacity: ventaForm.estado === 'BAJA' ? 0.6 : 1,
                                  cursor: ventaForm.estado === 'BAJA' ? 'not-allowed' : 'pointer',
                                }}
                              >
                                <option value="SI">Si</option>
                                <option value="NO">No</option>
                              </select>
                              <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '12px' }}>
                                Si eliges No, la venta se guardará pendiente hasta registrar el pago.
                              </div>
                            </div>

                            <div>
                              <label style={formLabelStyle}>Fecha de pago</label>
                              <input
                                type="date"
                                name="fechaPago"
                                value={ventaForm.fechaPago}
                                onChange={handleVentaChange}
                                disabled={ventaForm.pagoRegistrado === 'NO' || ventaForm.estado === 'BAJA'}
                                style={{
                                  ...inputStyle,
                                  opacity: ventaForm.pagoRegistrado === 'NO' || ventaForm.estado === 'BAJA' ? 0.6 : 1,
                                  cursor:
                                    ventaForm.pagoRegistrado === 'NO' || ventaForm.estado === 'BAJA'
                                      ? 'not-allowed'
                                      : 'text',
                                }}
                              />
                              <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '12px' }}>
                                {ventaForm.pagoRegistrado === 'NO'
                                  ? 'Se dejará vacía porque la venta quedará pendiente.'
                                  : 'Si la dejas igual, se usará la misma fecha de inicio como pago del mes actual.'}
                              </div>
                            </div>

                            <div>
                              <label style={formLabelStyle}>Estado automático</label>
                              <div
                                style={{
                                  ...inputStyle,
                                  background: '#0b1730',
                                  display: 'flex',
                                  alignItems: 'center',
                                  minHeight: '48px',
                                }}
                              >
                                {ventaStatusSummary.label}
                              </div>
                              <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '12px', lineHeight: 1.55 }}>
                                {ventaStatusSummary.description}
                              </div>
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={formLabelStyle}>Tipo de dispositivo</label>
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: isPhone ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
                                  gap: '10px',
                                }}
                              >
                                {DISPOSITIVOS.map((item) => {
                                  const active = getSelectedTipos(ventaForm.tipoDispositivo).includes(item)
                                  return (
                                    <button
                                      key={item}
                                      type="button"
                                      onClick={() => handleTipoDispositivoSelect(item)}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        width: '100%',
                                        padding: '14px 16px',
                                        borderRadius: '12px',
                                        border: active ? '1px solid #60a5fa' : '1px solid #334155',
                                        background: active ? '#13233f' : '#0b1730',
                                        color: '#f8fafc',
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                      }}
                                    >
                                      <span>{item}</span>
                                      <span
                                        style={{
                                          width: '15px',
                                          height: '15px',
                                          borderRadius: '3px',
                                          border: '1px solid #cbd5e1',
                                          background: active ? '#f8fafc' : 'transparent',
                                          display: 'inline-block',
                                        }}
                                      />
                                    </button>
                                  )
                                })}
                              </div>
                              {getSelectedTipos(ventaForm.tipoDispositivo).includes(DISPOSITIVO_OTRO) && (
                                <div style={{ marginTop: '12px' }}>
                                  <label style={formLabelStyle}>Especifica el dispositivo de "Otro"</label>
                                  <input
                                    name="otroTipoDispositivo"
                                    placeholder="Ej: Smart TV, iPad Mini, consola, etc."
                                    value={ventaForm.otroTipoDispositivo}
                                    onChange={handleVentaChange}
                                    style={inputStyle}
                                  />
                                  <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '12px' }}>
                                    Si necesitas más de uno, sepáralos por coma.
                                  </div>
                                </div>
                              )}
                              <div style={{ marginTop: '10px', color: '#94a3b8', fontSize: '12px' }}>
                                Selección final: {buildVentaDeviceList(ventaForm).join(', ') || 'Sin dispositivos seleccionados'}
                              </div>
                            </div>

                            <div>
                              <label style={formLabelStyle}>Cantidad de dispositivos *</label>
                              <input
                                type="number"
                                name="cantidadDispositivos"
                                placeholder="Cantidad de dispositivos"
                                value={cantidadTiposSeleccionados ? String(cantidadTiposSeleccionados) : ''}
                                readOnly
                                style={{
                                  ...inputStyle,
                                  background: '#0b1730',
                                  cursor: 'not-allowed',
                                }}
                              />
                            </div>

                            <div>
                              <label style={formLabelStyle}>Carpeta</label>
                              <input
                                name="carpeta"
                                placeholder="Carpeta"
                                value={ventaForm.carpeta || ''}
                                onChange={handleVentaChange}
                                style={inputStyle}
                              />
                            </div>

                            <div>
                              <label style={formLabelStyle}>Modo de asignación</label>
                              <select
                                name="assignmentMode"
                                value={ventaForm.assignmentMode}
                                onChange={handleVentaChange}
                                style={inputStyle}
                              >
                                <option value="auto">Automático</option>
                                <option value="manual">Manual</option>
                              </select>
                            </div>

                            <div>
                              {ventaForm.assignmentMode === 'manual' && (
                                <>
                                  <label style={formLabelStyle}>Cuenta manual</label>
                                  <select
                                    name="cuentaAccesoId"
                                    value={ventaForm.cuentaAccesoId}
                                    onChange={handleVentaChange}
                                    style={inputStyle}
                                  >
                                    <option value="">Selecciona una cuenta</option>
                                    {manualAccounts.map((cuenta) => (
                                      <option
                                        key={cuenta.id}
                                        value={cuenta.id}
                                      >
                                        {`${cuenta.correo} (${cuenta.used}/${cuenta.capacidad} clientes)`}
                                      </option>
                                    ))}
                                  </select>
                                  <div style={{ marginTop: '6px', color: '#94a3b8', fontSize: '12px' }}>
                                    {selectedCuentaPreview
                                      ? `Clientes registrados: ${selectedCuentaPreview.used}/${selectedCuentaPreview.capacidad}`
                                      : 'Selecciona una cuenta activa disponible.'}
                                  </div>
                                </>
                              )}
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                              <div
                                style={{
                                  border: '1px solid #334155',
                                  borderRadius: '14px',
                                  padding: '14px',
                                  background: '#0b1730',
                                }}
                              >
                                <div
                                  style={{
                                    textAlign: 'center',
                                    color: '#f8fafc',
                                    fontWeight: 700,
                                    marginBottom: '10px',
                                  }}
                                >
                                  Cuenta asignada
                                </div>

                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))',
                                    gap: '12px',
                                  }}
                                >
                                  <div>
                                    <label style={formLabelStyle}>Correo</label>
                                    <input
                                      value={selectedCuentaPreview?.correo || ''}
                                      readOnly
                                      style={{ ...inputStyle, color: '#e5e7eb' }}
                                    />
                                    <div style={{ marginTop: '6px', color: '#94a3b8', fontSize: '12px' }}>
                                      {ventaForm.assignmentMode === 'auto'
                                        ? 'Mostrando la mejor cuenta activa disponible en este momento.'
                                        : selectedCuentaPreview
                                          ? `Clientes registrados con este correo: ${selectedCuentaPreview.used}/${selectedCuentaPreview.capacidad}.`
                                          : 'Selecciona una cuenta activa disponible.'}
                                    </div>
                                  </div>

                                  <div>
                                    <label style={formLabelStyle}>Capacidad</label>
                                    <input
                                      value={
                                        selectedCuentaPreview
                                          ? `${selectedCuentaPreview.used}/${selectedCuentaPreview.capacidad}`
                                          : ''
                                      }
                                      readOnly
                                      style={{ ...inputStyle, color: '#e5e7eb' }}
                                    />
                                  </div>

                                  <div>
                                    <label style={formLabelStyle}>Estado</label>
                                    <input
                                      value={selectedCuentaPreview ? (selectedCuentaPreview.activa ? 'ACTIVA' : 'INACTIVA') : ''}
                                      readOnly
                                      style={{ ...inputStyle, color: '#e5e7eb' }}
                                    />
                                  </div>
                                </div>

                                <div style={{ marginTop: '10px', color: '#94a3b8', fontSize: '12px' }}>
                                  {ventaForm.assignmentMode === 'auto'
                                    ? 'Mostrando la mejor cuenta activa disponible en este momento.'
                                    : 'La cuenta manual usa solo registros reales de la pestana Cuentas.'}
                                </div>
                              </div>
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={formLabelStyle}>Observación</label>
                              <textarea
                                name="observacion"
                                value={ventaForm.observacion}
                                onChange={handleVentaChange}
                                style={{ ...inputStyle, minHeight: '110px', resize: 'vertical' }}
                              />
                            </div>
                          </div>

                          <div style={{ marginTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button type="submit" style={buttonPrimary}>
                              {editingVentaId ? 'Actualizar' : 'Guardar'}
                            </button>

                            <button type="button" onClick={resetVentaForm} style={buttonSecondary}>
                              Limpiar
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'ventas' && (
                  <div style={{ ...cardStyle, width: '100%', minWidth: 0, overflow: 'hidden' }}>
                    <div
                      style={{
                        display: 'grid',
                        gap: '14px',
                        marginBottom: '16px',
                      }}
                    >
                      <h2 style={{ margin: 0, color: '#f8fafc' }}>Listado de ventas</h2>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                          gap: '10px',
                          alignItems: 'center',
                        }}
                      >
                        <input
                          placeholder="Buscar cliente..."
                          value={searchVenta}
                          onChange={(e) => {
                            setVentasPage(1)
                            setSearchVenta(e.target.value)
                          }}
                          style={inputStyle}
                        />

                        <select
                          value={filterCorreoVenta}
                          onChange={(e) => {
                            setVentasPage(1)
                            setFilterCorreoVenta(e.target.value)
                          }}
                          style={inputStyle}
                        >
                          <option value="">Todos los correos</option>
                          {correosDisponibles.map((correo) => (
                            <option key={correo} value={correo}>
                              {correo}
                            </option>
                          ))}
                        </select>

                        <select
                          value={filterEstadoVenta}
                          onChange={(e) => {
                            setVentasPage(1)
                            setFilterEstadoVenta(e.target.value)
                          }}
                          style={inputStyle}
                        >
                          <option value="">Todos los estados</option>
                          {ESTADOS.map((estado) => (
                            <option key={estado} value={estado}>
                              {estado}
                            </option>
                          ))}
                        </select>

                        <input
                          type="month"
                          value={filterMesVenta}
                          onChange={(e) => {
                            setVentasPage(1)
                            setFilterMesVenta(e.target.value)
                          }}
                          style={inputStyle}
                        />

                        <input
                          type="date"
                          value={filterFechaCierreVenta}
                          onChange={(e) => {
                            setVentasPage(1)
                            setFilterFechaCierreVenta(e.target.value)
                          }}
                          style={inputStyle}
                        />

                        <button
                          type="button"
                          onClick={actualizarVistaVentas}
                          style={{ ...buttonInfo, justifySelf: 'start', whiteSpace: 'nowrap' }}
                        >
                          Actualizar
                        </button>
                      </div>
                    </div>

                    {loadingVentas ? (
                      <p>Cargando ventas...</p>
                    ) : ventasFiltradas.length === 0 ? (
                      <p>No hay ventas registradas.</p>
                    ) : (
                      <>
                      <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', paddingBottom: '6px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1700px', tableLayout: 'auto' }}>
                          <thead>
                            <tr style={{ background: '#0f172a' }}>
                            <th style={thStyle}>N°</th>
                              <th style={thStyle}>Cliente</th>
                              <th style={thStyle}>Teléfono</th>
                              <th style={thStyle}>Inicio</th>
                              <th style={thStyle}>Cierre</th>
                              <th style={thStyle}>Mes ref.</th>
                              <th style={thStyle}>Monto</th>
                              <th style={thStyle}>Descuento</th>
                              <th style={thStyle}>Pago</th>
                              <th style={thStyle}>Estado</th>
                              <th style={thStyle}>Dispositivo</th>
                              <th style={thStyle}>Cant.</th>
                              <th style={thStyle}>Carpeta</th>
                              <th style={thStyle}>Observación</th>
                              <th style={thStyle}>Cuenta</th>
                              <th style={{ ...thStyle, width: '240px', whiteSpace: 'nowrap' }}>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ventasFiltradas.map((venta) => (
                              <tr key={venta.id}>
                                <td style={tdStyle}>{venta.no ?? venta.id}</td>
                                <td style={tdStyle}>{venta.cliente?.nombre || '-'}</td>
                                <td style={tdStyle}>{venta.cliente?.telefono || '-'}</td>
                                <td style={tdStyle}>{formatDateDisplay(venta.fechaInicio)}</td>
                                <td style={tdStyle}>{formatDateDisplay(venta.fechaCierre)}</td>
                                <td style={tdStyle}>{formatMonthYearLabel(venta.fechaCierre)}</td>
                                <td style={tdStyle}>S/. {Number(venta.monto).toFixed(2)}</td>
                                <td style={tdStyle}>S/. {Number(venta.descuento).toFixed(2)}</td>
                                <td style={tdStyle}>{formatDateDisplay(venta.fechaPago)}</td>
                                <td style={tdStyle}>
                                  <span style={estadoBadge(venta.estado)}>{venta.estado}</span>
                                </td>
                                <td style={tdStyle}>{venta.tipoDispositivo || '-'}</td>
                                <td style={tdStyle}>{venta.cantidadDispositivos}</td>
                                <td style={tdStyle}>{venta.cliente?.carpeta || '-'}</td>
                                <td style={tdStyle}>{venta.observacion || '-'}</td>
                                <td style={tdStyle}>{venta.cuentaAcceso?.correo || '-'}</td>
                                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                  <div style={actionsStyle}>
                                    {(venta.estado === 'PENDIENTE' || venta.estado === 'MENSAJE_ENVIADO') && (
                                      <button
                                        type="button"
                                        onClick={() => registrarPagoVenta(venta)}
                                        style={buttonSuccess}
                                      >
                                        Registrar pago
                                      </button>
                                    )}
                                    <button type="button" onClick={() => editarVenta(venta)} style={buttonInfo}>
                                      Editar
                                    </button>
                                    <button type="button" onClick={() => eliminarVenta(venta.id)} style={buttonDanger}>
                                      Eliminar
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div
                        style={{
                          marginTop: '16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '12px',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ color: '#94a3b8', fontSize: '13px' }}>
                          Mostrando {ventasFiltradas.length} de {ventasMeta.total} ventas
                        </div>

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <select
                            value={ventasPageSize}
                            onChange={(e) => {
                              setVentasPage(1)
                              setVentasPageSize(Number(e.target.value))
                            }}
                            style={{ ...inputStyle, width: '120px', padding: '10px 12px' }}
                          >
                            {[10, 20, 50, 100].map((size) => (
                              <option key={size} value={size}>
                                {size} por pagina
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => setVentasPage((prev) => Math.max(1, prev - 1))}
                            disabled={ventasMeta.page <= 1}
                            style={{
                              ...buttonSecondary,
                              opacity: ventasMeta.page <= 1 ? 0.45 : 1,
                              cursor: ventasMeta.page <= 1 ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Anterior
                          </button>

                          <div style={{ color: '#e5e7eb', minWidth: '120px', textAlign: 'center' }}>
                            Pagina {ventasMeta.page} de {ventasMeta.totalPages}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setVentasPage((prev) => Math.min(ventasMeta.totalPages, prev + 1))
                            }
                            disabled={ventasMeta.page >= ventasMeta.totalPages}
                            style={{
                              ...buttonSecondary,
                              opacity: ventasMeta.page >= ventasMeta.totalPages ? 0.45 : 1,
                              cursor: ventasMeta.page >= ventasMeta.totalPages ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {activeTab === 'clientes' && (
              <div style={{ display: 'grid', gap: '20px' }}>
                <div style={cardStyle}>
                  <h2 style={{ marginTop: 0, color: '#f8fafc' }}>
                    {editingClienteId ? 'Editar cliente' : 'Registrar cliente'}
                  </h2>

                  <form onSubmit={guardarCliente}>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      <input
                        name="nombre"
                        placeholder="Nombre"
                        value={clienteForm.nombre}
                        onChange={handleClienteChange}
                        style={inputStyle}
                      />
                      <input
                        name="telefono"
                        placeholder="Teléfono"
                        value={clienteForm.telefono}
                        onChange={handleClienteChange}
                        style={inputStyle}
                      />
                      <input
                        name="monto"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Monto fijo del cliente"
                        value={clienteForm.monto}
                        onChange={handleClienteChange}
                        style={inputStyle}
                      />
                      <input
                        name="carpeta"
                        placeholder="Carpeta"
                        value={clienteForm.carpeta}
                        onChange={handleClienteChange}
                        style={inputStyle}
                      />
                      <textarea
                        name="observacion"
                        placeholder="Observación"
                        value={clienteForm.observacion}
                        onChange={handleClienteChange}
                        style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
                      />

                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button type="submit" style={buttonPrimary}>
                          {editingClienteId ? 'Actualizar cliente' : 'Guardar cliente'}
                        </button>
                        {editingClienteId && (
                          <button type="button" onClick={resetClienteForm} style={buttonSecondary}>
                            Cancelar edición
                          </button>
                        )}
                      </div>
                    </div>
                  </form>
                </div>

                <div style={cardStyle}>
                  <div style={headerRowStyle}>
                    <h2 style={{ margin: 0, color: '#f8fafc' }}>Listado de clientes</h2>
                    <input
                      placeholder="Buscar cliente..."
                      value={searchCliente}
                      onChange={(e) => setSearchCliente(e.target.value)}
                      style={{ ...inputStyle, maxWidth: '320px' }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '12px',
                      marginBottom: '18px',
                    }}
                  >
                    <DashboardMiniStat label="Clientes registrados" value={String(clientes.length)} accent="#60a5fa" />
                    <DashboardMiniStat label="Con deuda" value={String(clientesConDeudaCount)} accent="#f87171" />
                    <DashboardMiniStat label="Deuda acumulada" value={formatCurrencyPen(deudaClientesTotal)} accent="#fbbf24" />
                    <DashboardMiniStat
                      label="Ticket base promedio"
                      value={clientes.length ? formatCurrencyPen(clientes.reduce((sum, cliente) => sum + Number(cliente.monto || 0), 0) / clientes.length) : formatCurrencyPen(0)}
                      accent="#4ade80"
                    />
                  </div>

                  {loadingClientes ? (
                    <p>Cargando clientes...</p>
                  ) : clientesFiltrados.length === 0 ? (
                    <p>No hay clientes registrados.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1180px' }}>
                        <thead>
                          <tr style={{ background: '#0f172a' }}>
                            <th style={thStyle}>N°</th>
                            <th style={thStyle}>Nombre</th>
                            <th style={thStyle}>Teléfono</th>
                            <th style={thStyle}>Monto</th>
                            <th style={thStyle}>Ventas activas</th>
                            <th style={thStyle}>Deuda pendiente</th>
                            <th style={thStyle}>Último cierre</th>
                            <th style={thStyle}>Carpeta</th>
                            <th style={thStyle}>Observación</th>
                            <th style={thStyle}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientesFiltrados.map((cliente, index) => (
                            <tr key={cliente.id}>
                              <td style={tdStyle}>{index + 1}</td>
                              <td style={tdStyle}>{cliente.nombre}</td>
                              <td style={tdStyle}>{cliente.telefono}</td>
                              <td style={tdStyle}>S/. {Number(cliente.monto || 0).toFixed(2)}</td>
                              <td style={tdStyle}>{cliente.ventasActivas || 0}</td>
                              <td style={tdStyle}>{formatCurrencyPen(Number(cliente.deudaPendiente || 0))}</td>
                              <td style={tdStyle}>{formatDateDisplay(cliente.ultimoCierre)}</td>
                              <td style={tdStyle}>{cliente.carpeta}</td>
                              <td style={tdStyle}>{cliente.observacion || '-'}</td>
                              <td style={tdStyle}>
                                <div style={actionsStyle}>
                                  <button type="button" onClick={() => editarCliente(cliente)} style={buttonInfo}>
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => eliminarCliente(cliente.id, cliente.nombre)}
                                    style={buttonDanger}
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'cuentas' && (
              <div style={{ display: 'grid', gap: '20px' }}>
                <div style={cardStyle}>
                  <h2 style={{ marginTop: 0, color: '#f8fafc' }}>
                    {editingCuentaId ? 'Editar cuenta' : 'Registrar cuenta'}
                  </h2>

                  <form onSubmit={guardarCuenta}>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      <input
                        name="correo"
                        placeholder="Correo"
                        value={cuentaForm.correo}
                        onChange={handleCuentaChange}
                        style={inputStyle}
                      />
                      <input
                        name="password"
                        type="text"
                        placeholder={editingCuentaId ? 'Nueva contraseña (opcional)' : 'Contraseña'}
                        value={cuentaForm.password}
                        onChange={handleCuentaChange}
                        style={inputStyle}
                      />
                      <input
                        name="capacidad"
                        type="number"
                        placeholder="Capacidad"
                        value={cuentaForm.capacidad}
                        onChange={handleCuentaChange}
                        style={inputStyle}
                      />
                      <select
                        name="activa"
                        value={cuentaForm.activa}
                        onChange={handleCuentaChange}
                        style={inputStyle}
                      >
                        <option value="true">Activa</option>
                        <option value="false">Inactiva</option>
                      </select>
                      <textarea
                        name="observacion"
                        placeholder="Observación"
                        value={cuentaForm.observacion}
                        onChange={handleCuentaChange}
                        style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
                      />

                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button type="submit" style={buttonPrimary}>
                          {editingCuentaId ? 'Actualizar cuenta' : 'Guardar cuenta'}
                        </button>
                        {editingCuentaId && (
                          <button type="button" onClick={resetCuentaForm} style={buttonSecondary}>
                            Cancelar edición
                          </button>
                        )}
                      </div>
                    </div>
                  </form>
                </div>

                <div style={cardStyle}>
                  <div style={headerRowStyle}>
                    <h2 style={{ margin: 0, color: '#f8fafc' }}>Listado de cuentas</h2>
                    <input
                      placeholder="Buscar cuenta..."
                      value={searchCuenta}
                      onChange={(e) => setSearchCuenta(e.target.value)}
                      style={{ ...inputStyle, maxWidth: '320px' }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '12px',
                      marginBottom: '18px',
                    }}
                  >
                    <DashboardMiniStat label="Cuentas activas" value={String(cuentas.filter((cuenta) => cuenta.activa).length)} accent="#60a5fa" />
                    <DashboardMiniStat label="Capacidad libre" value={String(capacidadLibreTotal)} accent="#4ade80" />
                    <DashboardMiniStat label="En alerta" value={String(cuentasEnAlerta.length)} accent="#fbbf24" />
                    <DashboardMiniStat label="Saturadas" value={String(cuentas.filter((cuenta) => (cuenta.occupancyPercent || 0) >= 95).length)} accent="#f87171" />
                  </div>

                  {loadingCuentas ? (
                    <p>Cargando cuentas...</p>
                  ) : cuentasFiltradas.length === 0 ? (
                    <p>No hay cuentas registradas.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1240px' }}>
                        <thead>
                          <tr style={{ background: '#0f172a' }}>
                            <th style={thStyle}>N°</th>
                            <th style={thStyle}>Correo</th>
                            <th style={thStyle}>Capacidad</th>
                            <th style={thStyle}>Usados</th>
                            <th style={thStyle}>Libre</th>
                            <th style={thStyle}>Ocupación</th>
                            <th style={thStyle}>Estado</th>
                            <th style={thStyle}>Observación</th>
                            <th style={thStyle}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cuentasFiltradas.map((cuenta, index) => (
                            <tr key={cuenta.id}>
                              <td style={tdStyle}>{index + 1}</td>
                              <td style={tdStyle}>{cuenta.correo}</td>
                              <td style={tdStyle}>{cuenta.capacidad}</td>
                              <td style={tdStyle}>{cuenta.used}</td>
                              <td style={tdStyle}>{cuenta.free ?? Math.max(0, cuenta.capacidad - cuenta.used)}</td>
                              <td style={tdStyle}>
                                <div style={{ minWidth: '150px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                                    <span>{cuenta.occupancyPercent || 0}%</span>
                                    <span style={cuenta.alertLevel === 'CRITICA' ? badgeInactive : badgeActive}>
                                      {cuenta.alertLevel || 'NORMAL'}
                                    </span>
                                  </div>
                                  <div style={{ height: '8px', borderRadius: '999px', background: '#0f172a', overflow: 'hidden' }}>
                                    <div
                                      style={{
                                        width: `${Math.min(100, cuenta.occupancyPercent || 0)}%`,
                                        height: '100%',
                                        background:
                                          cuenta.alertLevel === 'CRITICA'
                                            ? '#ef4444'
                                            : cuenta.alertLevel === 'ALTA'
                                              ? '#f59e0b'
                                              : '#38bdf8',
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td style={tdStyle}>
                                <span style={cuenta.activa ? badgeActive : badgeInactive}>
                                  {cuenta.activa ? 'ACTIVA' : 'INACTIVA'}
                                </span>
                              </td>
                              <td style={tdStyle}>{cuenta.observacion || '-'}</td>
                              <td style={tdStyle}>
                                <div style={actionsStyle}>
                                  <button type="button" onClick={() => editarCuenta(cuenta)} style={buttonInfo}>
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => eliminarCuenta(cuenta.id, cuenta.correo)}
                                    style={buttonDanger}
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'historial' && (
              <HistorySection
                isAdmin={isAdmin}
                historialBajas={historialBajas}
                loadingHistorial={loadingHistorial}
                pagos={pagos}
                loadingPagos={loadingPagos}
                pagosResumen={pagosResumen}
                loadingPagosResumen={loadingPagosResumen}
                actividad={actividad}
                loadingActividad={loadingActividad}
                whatsAppLogs={whatsAppLogs}
                loadingWhatsAppLogs={loadingWhatsAppLogs}
                onClearHistory={clearHistory}
              />
            )}

            {activeTab === 'chats' && (
              <div style={{ display: 'grid', gap: '20px' }}>
                <div style={cardStyle}>
                  <div style={headerRowStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: '14px',
                          background: 'rgba(34,197,94,0.14)',
                          color: '#86efac',
                        }}
                      >
                        <AppIcon name="whatsapp" />
                      </div>
                      <div>
                        <h2 style={{ margin: 0, color: '#f8fafc' }}>Chats de WhatsApp</h2>
                        <p style={{ margin: '6px 0 0', color: '#94a3b8' }}>
                          Revisa respuestas entrantes y contesta desde el sistema.
                        </p>
                      </div>
                    </div>

                    <button type="button" onClick={() => void cargarWhatsAppChats()} style={buttonSecondary}>
                      Actualizar chats
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isPhone ? 'minmax(0, 1fr)' : '340px minmax(0, 1fr)',
                      gap: '16px',
                    }}
                  >
                    <div
                      style={{
                        border: '1px solid #1e293b',
                        borderRadius: '18px',
                        background: 'rgba(2,6,23,0.22)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: '14px 16px',
                          borderBottom: '1px solid #1e293b',
                          color: '#f8fafc',
                          fontWeight: 700,
                        }}
                      >
                        Conversaciones
                      </div>

                      {loadingWhatsAppChats ? (
                        <div style={{ padding: '16px', color: '#94a3b8' }}>Cargando conversaciones...</div>
                      ) : whatsAppChats.length === 0 ? (
                        <div style={{ padding: '16px', color: '#94a3b8', lineHeight: 1.6 }}>
                          Aún no hay respuestas entrantes.
                          <br />
                          Cuando configures el webhook en Meta, aquí aparecerán los mensajes de tus clientes.
                        </div>
                      ) : (
                        <div style={{ display: 'grid' }}>
                          {whatsAppChats.map((chat) => {
                            const active = chat.telefono === selectedWhatsAppChatPhone

                            return (
                              <button
                                key={chat.telefono}
                                type="button"
                                onClick={() => setSelectedWhatsAppChatPhone(chat.telefono)}
                                style={{
                                  padding: '14px 16px',
                                  textAlign: 'left',
                                  border: 'none',
                                  borderBottom: '1px solid #1e293b',
                                  background: active ? 'rgba(37,99,235,0.16)' : 'transparent',
                                  color: '#e2e8f0',
                                  cursor: 'pointer',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                  <div style={{ color: '#f8fafc', fontWeight: 700 }}>
                                    {chat.clienteNombre || 'Cliente'}
                                  </div>
                                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                                    {formatChatTimestamp(chat.lastAt)}
                                  </div>
                                </div>
                                <div style={{ color: '#60a5fa', fontSize: '12px', marginTop: '4px' }}>
                                  {chat.telefono}
                                </div>
                                <div
                                  style={{
                                    marginTop: '8px',
                                    color: '#cbd5e1',
                                    fontSize: '13px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {chat.lastDirection === 'IN' ? 'Cliente: ' : 'Tú: '}
                                  {chat.lastMessage}
                                </div>
                                {chat.unreadCount > 0 && (
                                  <div style={{ marginTop: '10px' }}>
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minWidth: '26px',
                                        padding: '4px 8px',
                                        borderRadius: '999px',
                                        background: 'rgba(34,197,94,0.18)',
                                        color: '#86efac',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                      }}
                                    >
                                      {chat.unreadCount} nuevo{chat.unreadCount === 1 ? '' : 's'}
                                    </span>
                                  </div>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        border: '1px solid #1e293b',
                        borderRadius: '18px',
                        background: 'rgba(2,6,23,0.22)',
                        overflow: 'hidden',
                        minHeight: '540px',
                        display: 'grid',
                        gridTemplateRows: 'auto minmax(0, 1fr) auto',
                      }}
                    >
                      <div
                        style={{
                          padding: '14px 16px',
                          borderBottom: '1px solid #1e293b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div style={{ color: '#f8fafc', fontWeight: 700 }}>
                            {selectedWhatsAppChat?.clienteNombre || 'Sin conversación seleccionada'}
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
                            {selectedWhatsAppChat?.telefono || 'Selecciona un chat para ver los mensajes'}
                          </div>
                        </div>

                        {selectedWhatsAppChatPhone && (
                          <button
                            type="button"
                            onClick={() => void cargarWhatsAppChatMessages(selectedWhatsAppChatPhone)}
                            style={buttonSecondary}
                          >
                            Actualizar mensajes
                          </button>
                        )}
                      </div>

                      <div
                        style={{
                          padding: '16px',
                          overflowY: 'auto',
                          display: 'grid',
                          gap: '12px',
                          alignContent: 'start',
                        }}
                      >
                        {!selectedWhatsAppChatPhone ? (
                          <div style={{ color: '#94a3b8' }}>
                            Selecciona una conversación para revisar los mensajes y responder.
                          </div>
                        ) : loadingWhatsAppChatMessages ? (
                          <div style={{ color: '#94a3b8' }}>Cargando mensajes...</div>
                        ) : whatsAppChatMessages.length === 0 ? (
                          <div style={{ color: '#94a3b8' }}>Aún no hay mensajes en esta conversación.</div>
                        ) : (
                          whatsAppChatMessages.map((message) => {
                            const incoming = message.direction === 'IN'

                            return (
                              <div
                                key={message.id}
                                style={{
                                  justifySelf: incoming ? 'start' : 'end',
                                  maxWidth: isPhone ? '92%' : '78%',
                                  padding: '12px 14px',
                                  borderRadius: incoming ? '18px 18px 18px 6px' : '18px 18px 6px 18px',
                                  background: incoming ? 'rgba(15,23,42,0.92)' : 'rgba(37,99,235,0.18)',
                                  border: incoming
                                    ? '1px solid rgba(148,163,184,0.14)'
                                    : '1px solid rgba(59,130,246,0.25)',
                                }}
                              >
                                <div style={{ color: '#f8fafc', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                                  {message.text || '(sin contenido)'}
                                </div>
                                <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '12px' }}>
                                  {incoming ? 'Cliente' : 'Tú'} · {formatChatTimestamp(message.createdAt)}
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>

                      <div
                        style={{
                          padding: '14px 16px',
                          borderTop: '1px solid #1e293b',
                          display: 'grid',
                          gap: '10px',
                        }}
                      >
                        <textarea
                          value={whatsAppReplyText}
                          onChange={(e) => setWhatsAppReplyText(e.target.value)}
                          placeholder={
                            selectedWhatsAppChatPhone
                              ? 'Escribe tu respuesta al cliente...'
                              : 'Selecciona primero una conversación'
                          }
                          disabled={!selectedWhatsAppChatPhone || sendingWhatsAppReply}
                          rows={4}
                          style={{
                            ...inputStyle,
                            resize: 'vertical',
                            opacity: !selectedWhatsAppChatPhone || sendingWhatsAppReply ? 0.75 : 1,
                          }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                          <div style={{ color: '#94a3b8', fontSize: '12px', lineHeight: 1.5 }}>
                            La respuesta manual usa el canal de atención de WhatsApp. Si Meta rechaza el envío,
                            normalmente es porque ya venció la ventana de 24 horas.
                          </div>
                          <button
                            type="button"
                            onClick={() => void responderWhatsAppChat()}
                            disabled={!selectedWhatsAppChatPhone || sendingWhatsAppReply}
                            style={{
                              ...buttonPrimary,
                              opacity: !selectedWhatsAppChatPhone || sendingWhatsAppReply ? 0.6 : 1,
                              cursor: !selectedWhatsAppChatPhone || sendingWhatsAppReply ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {sendingWhatsAppReply ? 'Enviando...' : 'Responder chat'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'configuracion' && (
              <div style={{ display: 'grid', gap: '20px' }}>
                <div style={cardStyle}>
                  <div style={headerRowStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: '14px',
                          background: 'rgba(37,99,235,0.14)',
                          color: '#bfdbfe',
                        }}
                      >
                        <AppIcon name="shield" />
                      </div>
                      <div>
                        <h2 style={{ margin: 0, color: '#f8fafc' }}>Seguridad y acceso</h2>
                        <p style={{ margin: '6px 0 0', color: '#94a3b8' }}>
                          Gestiona tu contraseña, revisa tu sesión actual y cierra sesiones abiertas.
                        </p>
                      </div>
                    </div>
                    <button type="button" onClick={() => void cargarSecurityInfo()} style={buttonSecondary}>
                      Actualizar seguridad
                    </button>
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
                      label="Sesiones activas"
                      value={loadingSecurity ? '...' : String(securityInfo?.activeSessions ?? 0)}
                      accent="#60a5fa"
                    />
                    <DashboardMiniStat
                      label="Duración de sesión"
                      value={loadingSecurity ? '...' : `${securityInfo?.sessionDurationDays ?? 0} días`}
                      accent="#fbbf24"
                    />
                    <DashboardMiniStat
                      label="Rol actual"
                      value={currentUser?.rol === 'ADMIN' ? 'Administrador' : 'Operador'}
                      accent="#c084fc"
                    />
                    <DashboardMiniStat
                      label="Sesión vence"
                      value={
                        loadingSecurity
                          ? '...'
                          : securityInfo?.currentSessionExpiresAt
                            ? formatDateDisplay(securityInfo.currentSessionExpiresAt)
                            : 'No disponible'
                      }
                      accent="#4ade80"
                    />
                  </div>

                  <div
                    style={{
                      marginBottom: '18px',
                      padding: '14px 16px',
                      borderRadius: '16px',
                      border: '1px solid rgba(148,163,184,0.12)',
                      background: 'rgba(2,6,23,0.34)',
                    }}
                  >
                    <div style={{ color: '#f8fafc', fontWeight: 700, marginBottom: '4px' }}>Usuario actual</div>
                    <div style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
                      {currentUser?.nombre || 'Usuario'} · {currentUser?.correo || 'sin correo'}
                    </div>
                  </div>

                  <form onSubmit={submitChangePassword} style={{ display: 'grid', gap: '14px' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '12px',
                      }}
                    >
                      <input
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e) =>
                          setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                        }
                        placeholder="Contraseña actual"
                        style={inputStyle}
                      />
                      <input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) =>
                          setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                        }
                        placeholder="Nueva contraseña"
                        style={inputStyle}
                      />
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) =>
                          setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                        }
                        placeholder="Confirmar nueva contraseña"
                        style={inputStyle}
                      />
                    </div>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        color: '#cbd5e1',
                        fontSize: '14px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={passwordForm.logoutOthers}
                        onChange={(e) =>
                          setPasswordForm((prev) => ({ ...prev, logoutOthers: e.target.checked }))
                        }
                      />
                      Cerrar las demás sesiones al actualizar la contraseña
                    </label>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button type="submit" style={buttonPrimary}>
                        Actualizar contraseña
                      </button>
                      <button type="button" onClick={() => void cerrarOtrasSesiones()} style={buttonSecondary}>
                        Cerrar otras sesiones
                      </button>
                    </div>
                  </form>
                </div>

                <div style={cardStyle}>
                  <div style={headerRowStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: '14px',
                          background: 'rgba(37,99,235,0.14)',
                          color: '#bfdbfe',
                        }}
                      >
                        <AppIcon name="dashboard" />
                      </div>
                      <div>
                        <h2 style={{ margin: 0, color: '#f8fafc' }}>Estado operativo</h2>
                        <p style={{ margin: '6px 0 0', color: '#94a3b8' }}>
                          Supervisa el backend, la cobranza y el último envío de prueba.
                        </p>
                      </div>
                    </div>
                    <button type="button" onClick={retryAuthCheck} style={buttonSecondary}>
                      Actualizar estado
                    </button>
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
                      label="Backend"
                      value={healthStatus?.dbOk ? 'OK' : 'FALLA'}
                      accent={healthStatus?.dbOk ? '#4ade80' : '#f87171'}
                    />
                    <DashboardMiniStat
                      label="Pagos registrados"
                      value={loadingPagosResumen ? '...' : String(pagosResumen.totalPagos)}
                      accent="#60a5fa"
                    />
                    <DashboardMiniStat
                      label="Cobrado hoy"
                      value={loadingPagosResumen ? '...' : formatCurrencyPen(pagosResumen.pagosHoy)}
                      accent="#fbbf24"
                    />
                    <DashboardMiniStat
                      label="Clientes con deuda"
                      value={loadingPagosResumen ? '...' : String(pagosResumen.clientesConDeuda)}
                      accent="#f87171"
                    />
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        padding: '16px',
                        borderRadius: '16px',
                        border: `1px solid ${healthStatus?.dbOk ? 'rgba(34,197,94,0.35)' : 'rgba(248,113,113,0.35)'}`,
                        background: healthStatus?.dbOk ? 'rgba(20,83,45,0.22)' : 'rgba(69,10,10,0.22)',
                      }}
                    >
                      <div style={{ color: '#f8fafc', fontWeight: 700, marginBottom: '6px' }}>Estado del backend</div>
                      <div style={{ color: healthStatus?.dbOk ? '#bbf7d0' : '#fecaca', lineHeight: 1.6 }}>
                        {healthStatus?.dbOk
                          ? 'El backend está operativo y la base de datos responde correctamente.'
                          : healthStatus?.error || 'No se pudo verificar el estado del backend.'}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '10px' }}>
                        Hora del servidor: {formatDateDisplay(healthStatus?.serverTime)}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '16px',
                        borderRadius: '16px',
                        border: '1px solid rgba(96,165,250,0.2)',
                        background: 'rgba(15,23,42,0.68)',
                      }}
                    >
                      <div style={{ color: '#f8fafc', fontWeight: 700, marginBottom: '6px' }}>Resumen de cobranza</div>
                      <div style={{ color: '#cbd5e1', lineHeight: 1.7 }}>
                        Ticket promedio: {loadingPagosResumen ? '...' : formatCurrencyPen(pagosResumen.ticketPromedio)}
                        <br />
                        Deuda pendiente: {loadingPagosResumen ? '...' : formatCurrencyPen(pagosResumen.deudaPendienteTotal)}
                        <br />
                        Última prueba: {lastWhatsAppTest?.to || 'Sin ejecutar'}
                      </div>
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <>
                <div style={cardStyle}>
                  <div style={headerRowStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: '14px',
                          background: 'rgba(34,197,94,0.14)',
                          color: '#86efac',
                        }}
                      >
                        <AppIcon name="whatsapp" />
                      </div>
                      <div>
                        <h2 style={{ margin: 0, color: '#f8fafc' }}>Configuración de WhatsApp</h2>
                        <p style={{ margin: '6px 0 0', color: '#94a3b8' }}>
                          Administra el canal, ejecuta pruebas y lanza el envío manual de cobros.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={whatsAppConfig.enabled ? badgeActive : badgeInactive}>
                        {whatsAppConfig.enabled ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleWhatsAppEnabled(!whatsAppConfig.enabled)}
                        style={whatsAppConfig.enabled ? buttonInfo : buttonSecondary}
                      >
                        {whatsAppConfig.enabled ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
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
                      label="Versión Graph"
                      value={whatsAppConfig.graphVersion || 'Sin definir'}
                      accent="#60a5fa"
                    />
                    <DashboardMiniStat
                      label="Token guardado"
                      value={whatsAppConfig.hasToken ? 'Sí' : 'No'}
                      accent={whatsAppConfig.hasToken ? '#4ade80' : '#f87171'}
                    />
                    <DashboardMiniStat
                      label="Plantilla hoy"
                      value={whatsAppConfig.dueTodayTemplateName || 'Sin definir'}
                      accent="#fbbf24"
                    />
                    <DashboardMiniStat
                      label="Última prueba"
                      value={lastWhatsAppTest?.to || 'Sin ejecutar'}
                      accent="#c084fc"
                    />
                  </div>

                  {lastWhatsAppTest && (
                    <div
                      style={{
                        marginBottom: '18px',
                        padding: '14px 16px',
                        borderRadius: '16px',
                        border: '1px solid rgba(96,165,250,0.2)',
                        background: 'rgba(15,23,42,0.68)',
                      }}
                    >
                      <div style={{ color: '#f8fafc', fontWeight: 700, marginBottom: '6px' }}>
                        Última prueba registrada
                      </div>
                      <div style={{ color: '#cbd5e1', lineHeight: 1.7 }}>
                        Destino: {lastWhatsAppTest.to || 'Sin destino'}
                        <br />
                        Modo: {getWhatsAppModeLabel(lastWhatsAppTest.mode as WhatsAppTestFormState['mode'])}
                        <br />
                        Plantilla: {lastWhatsAppTest.templateName || 'Sin plantilla'}
                        <br />
                        Idioma: {lastWhatsAppTest.langCode || 'Sin idioma'}
                      </div>
                    </div>
                  )}

                  <form onSubmit={guardarWhatsAppConfig}>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      <input
                        value={whatsAppConfig.graphVersion}
                        onChange={(e) =>
                          setWhatsAppConfig((prev) => ({ ...prev, graphVersion: e.target.value }))
                        }
                        placeholder="Graph version"
                        style={inputStyle}
                      />
                      <input
                        value={whatsAppConfig.phoneNumberId}
                        onChange={(e) =>
                          setWhatsAppConfig((prev) => ({ ...prev, phoneNumberId: e.target.value }))
                        }
                        placeholder="Phone Number ID"
                        style={inputStyle}
                      />
                      <input
                        value={whatsAppConfig.webhookUrl}
                        onChange={(e) =>
                          setWhatsAppConfig((prev) => ({ ...prev, webhookUrl: e.target.value }))
                        }
                        placeholder={`Webhook URL publico (si lo dejas vacio: ${defaultWhatsAppWebhookUrl})`}
                        style={inputStyle}
                      />
                      <input
                        value={whatsAppConfig.webhookVerifyToken}
                        onChange={(e) =>
                          setWhatsAppConfig((prev) => ({ ...prev, webhookVerifyToken: e.target.value }))
                        }
                        placeholder="Webhook verify token"
                        style={inputStyle}
                      />
                      <input
                        value={whatsAppConfig.notifyPhone}
                        onChange={(e) =>
                          setWhatsAppConfig((prev) => ({ ...prev, notifyPhone: e.target.value }))
                        }
                        placeholder="Numero para alertas de respuesta (+51989267132)"
                        style={inputStyle}
                      />
                      <input
                        value={whatsAppConfig.replyAlertTemplateName}
                        onChange={(e) =>
                          setWhatsAppConfig((prev) => ({ ...prev, replyAlertTemplateName: e.target.value }))
                        }
                        placeholder="Plantilla alerta respuesta"
                        style={inputStyle}
                      />
                      <input
                        value={whatsAppConfig.replyAlertLangCode}
                        onChange={(e) =>
                          setWhatsAppConfig((prev) => ({ ...prev, replyAlertLangCode: e.target.value }))
                        }
                        placeholder="Idioma alerta respuesta"
                        style={inputStyle}
                      />
                      <input
                        value={whatsAppConfig.dueTomorrowTemplateName}
                        onChange={(e) =>
                          setWhatsAppConfig((prev) => ({ ...prev, dueTomorrowTemplateName: e.target.value }))
                        }
                        placeholder="Plantilla vence manana"
                        style={inputStyle}
                      />
                      <input
                        value={whatsAppConfig.dueTomorrowLangCode}
                        onChange={(e) =>
                          setWhatsAppConfig((prev) => ({ ...prev, dueTomorrowLangCode: e.target.value }))
                        }
                        placeholder="Idioma vence manana"
                        style={inputStyle}
                      />
                      <input
                        value={whatsAppConfig.dueTodayTemplateName}
                        onChange={(e) =>
                          setWhatsAppConfig((prev) => ({
                            ...prev,
                            templateName: e.target.value,
                            dueTodayTemplateName: e.target.value,
                          }))
                        }
                        placeholder="Plantilla vence hoy"
                        style={inputStyle}
                      />
                      <input
                        value={whatsAppConfig.dueTodayLangCode}
                        onChange={(e) =>
                          setWhatsAppConfig((prev) => ({
                            ...prev,
                            langCode: e.target.value,
                            dueTodayLangCode: e.target.value,
                          }))
                        }
                        placeholder="Idioma vence hoy"
                        style={inputStyle}
                      />
                      <input
                        value={whatsAppConfig.overdueTemplateName}
                        onChange={(e) =>
                          setWhatsAppConfig((prev) => ({ ...prev, overdueTemplateName: e.target.value }))
                        }
                        placeholder="Plantilla vencido"
                        style={inputStyle}
                      />
                      <input
                        value={whatsAppConfig.overdueLangCode}
                        onChange={(e) =>
                          setWhatsAppConfig((prev) => ({ ...prev, overdueLangCode: e.target.value }))
                        }
                        placeholder="Idioma vencido"
                        style={inputStyle}
                      />
                      <input
                        value={whatsAppConfig.accessUpdateTemplateName}
                        onChange={(e) =>
                          setWhatsAppConfig((prev) => ({ ...prev, accessUpdateTemplateName: e.target.value }))
                        }
                        placeholder="Plantilla cambio de acceso"
                        style={inputStyle}
                      />
                      <input
                        value={whatsAppConfig.accessUpdateLangCode}
                        onChange={(e) =>
                          setWhatsAppConfig((prev) => ({ ...prev, accessUpdateLangCode: e.target.value }))
                        }
                        placeholder="Idioma cambio de acceso"
                        style={inputStyle}
                      />
                      <input
                        value={whatsAppConfig.paymentMethods}
                        onChange={(e) =>
                          setWhatsAppConfig((prev) => ({ ...prev, paymentMethods: e.target.value }))
                        }
                        placeholder="Metodos de pago"
                        style={inputStyle}
                      />
                      <input
                        value={whatsAppConfig.paymentPhone}
                        onChange={(e) =>
                          setWhatsAppConfig((prev) => ({ ...prev, paymentPhone: e.target.value }))
                        }
                        placeholder="Numero de cobro"
                        style={inputStyle}
                      />
                      <input
                        value={whatsAppConfig.paymentContactName}
                        onChange={(e) =>
                          setWhatsAppConfig((prev) => ({ ...prev, paymentContactName: e.target.value }))
                        }
                        placeholder="Nombre de cobro"
                        style={inputStyle}
                      />
                      <input
                        value={whatsAppTokenInput}
                        onChange={(e) => setWhatsAppTokenInput(e.target.value)}
                        placeholder={whatsAppConfig.hasToken ? 'Nuevo token (opcional)' : 'Access token'}
                        style={inputStyle}
                      />
                      <div
                        style={{
                          padding: '12px 14px',
                          borderRadius: '14px',
                          border: '1px solid rgba(148,163,184,0.12)',
                          background: 'rgba(2,6,23,0.28)',
                          color: '#94a3b8',
                          fontSize: '12px',
                          lineHeight: 1.6,
                        }}
                      >
                        URL efectivo del webhook: <b style={{ color: '#f8fafc' }}>{whatsAppWebhookUrl}</b>
                        <br />
                        Si tu backend está desplegado, pega aquí su URL pública completa terminando en <b style={{ color: '#f8fafc' }}>/webhooks/whatsapp</b>.
                        <br />
                        Luego configura en Meta ese callback URL y usa este verify token:{' '}
                        <b style={{ color: '#f8fafc' }}>{whatsAppConfig.webhookVerifyToken || 'sistema-cobro-whatsapp'}</b>
                      </div>

                      <div
                        style={{
                          marginTop: '8px',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                          gap: '12px',
                          padding: '14px',
                          borderRadius: '16px',
                          background: 'rgba(2,6,23,0.32)',
                          border: '1px solid rgba(148,163,184,0.12)',
                        }}
                      >
                        <div style={{ gridColumn: '1 / -1', color: '#f8fafc', fontWeight: 700 }}>
                          Prueba de WhatsApp
                        </div>
                        <input
                          value={whatsAppTestForm.to}
                          onChange={(e) =>
                            setWhatsAppTestForm((prev) => ({ ...prev, to: e.target.value }))
                          }
                          placeholder="Número destino (+519...)"
                          style={inputStyle}
                        />
                        <select
                          value={whatsAppTestForm.mode}
                          onChange={(e) =>
                            setWhatsAppTestForm((prev) => ({
                              ...prev,
                              mode: e.target.value as WhatsAppTestFormState['mode'],
                            }))
                          }
                          style={inputStyle}
                        >
                          <option value="due_tomorrow">Vence manana</option>
                          <option value="due_today">Vence hoy</option>
                          <option value="overdue">Vencido</option>
                          <option value="access_update">Cambio de acceso</option>
                          <option value="hello_world">hello_world</option>
                        </select>
                        <input
                          value={whatsAppTestForm.cliente}
                          onChange={(e) =>
                            setWhatsAppTestForm((prev) => ({ ...prev, cliente: e.target.value }))
                          }
                          placeholder="Nombre de prueba"
                          style={inputStyle}
                        />
                        {whatsAppTestForm.mode === 'access_update' ? (
                          <>
                            <input
                              value={whatsAppTestForm.correoCuenta}
                              onChange={(e) =>
                                setWhatsAppTestForm((prev) => ({ ...prev, correoCuenta: e.target.value }))
                              }
                              placeholder="Correo de acceso"
                              style={inputStyle}
                            />
                            <input
                              value={whatsAppTestForm.passwordCuenta}
                              onChange={(e) =>
                                setWhatsAppTestForm((prev) => ({ ...prev, passwordCuenta: e.target.value }))
                              }
                              placeholder="Contrasena de acceso"
                              style={inputStyle}
                            />
                          </>
                        ) : (
                          <>
                            <input
                              type="date"
                              value={whatsAppTestForm.fechaCierre}
                              onChange={(e) =>
                                setWhatsAppTestForm((prev) => ({ ...prev, fechaCierre: e.target.value }))
                              }
                              style={inputStyle}
                            />
                            <input
                              value={whatsAppTestForm.monto}
                              onChange={(e) =>
                                setWhatsAppTestForm((prev) => ({ ...prev, monto: e.target.value }))
                              }
                              placeholder="Monto de prueba"
                              style={inputStyle}
                            />
                          </>
                        )}
                        <button type="button" onClick={() => void runWhatsAppTest()} style={buttonSecondary}>
                          Enviar prueba
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button type="submit" style={buttonPrimary}>
                          Guardar configuración
                        </button>
                        <button type="button" onClick={runWhatsAppDueTodayNow} style={buttonInfo}>
                          Enviar recordatorios ahora
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

                <div style={cardStyle}>
                  <div style={headerRowStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: '14px',
                          background: 'rgba(37,99,235,0.14)',
                          color: '#bfdbfe',
                        }}
                      >
                        <AppIcon name="usuario" />
                      </div>
                      <div>
                        <h2 style={{ margin: 0, color: '#f8fafc' }}>Usuarios y roles</h2>
                        <p style={{ margin: '6px 0 0', color: '#94a3b8' }}>
                          Crea operadores, define permisos y controla quién ingresa al sistema.
                        </p>
                      </div>
                    </div>
                    {editingUserId && (
                      <button type="button" onClick={resetUserForm} style={buttonSecondary}>
                        Cancelar edición
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
                    <DashboardMiniStat label="Usuarios" value={loadingUsers ? '...' : String(users.length)} accent="#60a5fa" />
                    <DashboardMiniStat label="Activos" value={loadingUsers ? '...' : String(usuariosActivosCount)} accent="#4ade80" />
                    <DashboardMiniStat label="Administradores" value={loadingUsers ? '...' : String(usuariosAdminCount)} accent="#c084fc" />
                    <DashboardMiniStat label="Operadores" value={loadingUsers ? '...' : String(usuariosOperadorCount)} accent="#fbbf24" />
                  </div>

                  <form onSubmit={submitGuardarUsuario} style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                      <input
                        value={userForm.nombre}
                        onChange={(e) => setUserForm((prev) => ({ ...prev, nombre: e.target.value }))}
                        placeholder="Nombre"
                        style={inputStyle}
                      />
                      <input
                        value={userForm.correo}
                        onChange={(e) => setUserForm((prev) => ({ ...prev, correo: e.target.value }))}
                        placeholder="Correo"
                        style={inputStyle}
                      />
                      <input
                        type="password"
                        value={userForm.password}
                        onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
                        placeholder={editingUserId ? 'Nueva contraseña (opcional)' : 'Contraseña'}
                        style={inputStyle}
                      />
                      <select
                        value={userForm.rol}
                        onChange={(e) =>
                          setUserForm((prev) => ({ ...prev, rol: e.target.value as 'ADMIN' | 'OPERADOR' }))
                        }
                        style={inputStyle}
                      >
                        <option value="OPERADOR">Operador</option>
                        <option value="ADMIN">Administrador</option>
                      </select>
                      <select
                        value={String(userForm.activo)}
                        onChange={(e) =>
                          setUserForm((prev) => ({ ...prev, activo: e.target.value === 'true' }))
                        }
                        style={inputStyle}
                      >
                        <option value="true">Activo</option>
                        <option value="false">Inactivo</option>
                      </select>
                    </div>
                    <button type="submit" style={buttonPrimary}>
                      {editingUserId ? 'Actualizar usuario' : 'Crear usuario'}
                    </button>
                  </form>

                  {loadingUsers ? (
                    <p>Cargando usuarios...</p>
                  ) : users.length === 0 ? (
                    <p>No hay usuarios registrados.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                        <thead>
                          <tr style={{ background: '#0f172a' }}>
                            <th style={thStyle}>N°</th>
                            <th style={thStyle}>Nombre</th>
                            <th style={thStyle}>Correo</th>
                            <th style={thStyle}>Rol</th>
                            <th style={thStyle}>Estado</th>
                            <th style={thStyle}>Actualizado</th>
                            <th style={thStyle}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usuariosOrdenados.map((usuario, index) => (
                            <tr key={usuario.id}>
                              <td style={tdStyle}>{index + 1}</td>
                              <td style={tdStyle}>{usuario.nombre}</td>
                              <td style={tdStyle}>{usuario.correo}</td>
                              <td style={tdStyle}>{usuario.rol}</td>
                              <td style={tdStyle}>
                                <span style={usuario.activo ? badgeActive : badgeInactive}>
                                  {usuario.activo ? 'ACTIVO' : 'INACTIVO'}
                                </span>
                              </td>
                              <td style={tdStyle}>{formatDateDisplay(usuario.updatedAt)}</td>
                              <td style={tdStyle}>
                                <button type="button" onClick={() => editarUsuario(usuario)} style={buttonInfo}>
                                  Editar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                  </>
                )}
              </div>
            )}

            {confirmModal.open && (
              <div style={modalOverlayStyle}>
                <div style={modalCardStyle}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div style={getModalIconBoxStyle(confirmModal.type)}>
                      {getModalIconSymbol(confirmModal.type)}
                    </div>

                    <div style={{ flex: 1 }}>
                      <h3 style={modalTitleStyle}>{confirmModal.title}</h3>
                      <p style={modalTextStyle}>{confirmModal.message}</p>
                    </div>
                  </div>

                  <div style={modalActionsStyle}>
                    <button type="button" onClick={closeConfirmModal} style={buttonSecondary}>
                      Cancelar
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmModalOk}
                      style={getModalConfirmButtonStyle(confirmModal.type)}
                    >
                      {confirmModal.confirmText}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {paymentModalVenta && (
              <div style={modalOverlayStyle}>
                <div style={{ ...modalCardStyle, maxWidth: '760px' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '18px' }}>
                    <div style={getModalIconBoxStyle('success')}>✓</div>

                    <div style={{ flex: 1 }}>
                      <h3 style={modalTitleStyle}>Registrar pago</h3>
                      <p style={modalTextStyle}>
                        El monto se calcula automáticamente con el precio fijo del cliente. Al guardar, el sistema extenderá el ciclo 1 o 2 meses desde la fecha actual de cierre.
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isPhone ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
                      gap: '16px',
                      marginBottom: '22px',
                    }}
                  >
                    <div>
                      <label style={formLabelStyle}>Monto mensual fijo</label>
                      <input
                        type="text"
                        value={`S/. ${getVentaMontoMensual(paymentModalVenta).toFixed(2)}`}
                        readOnly
                        style={{
                          ...inputStyle,
                          background: '#0b1730',
                          cursor: 'not-allowed',
                        }}
                      />
                    </div>

                    <div>
                      <label style={formLabelStyle}>Meses a cancelar</label>
                      <select
                        value={paymentMeses}
                        onChange={(e) => setPaymentMeses(e.target.value as '1' | '2')}
                        style={inputStyle}
                      >
                        <option value="1">1 mes</option>
                        <option value="2">2 meses</option>
                      </select>
                    </div>

                    <div>
                      <label style={formLabelStyle}>Cantidad pagada</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={paymentMonto}
                        readOnly
                        style={{
                          ...inputStyle,
                          background: '#0b1730',
                          cursor: 'not-allowed',
                        }}
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label style={formLabelStyle}>Fecha de pago</label>
                      <input
                        type="date"
                        value={paymentFecha}
                        onChange={(e) => setPaymentFecha(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div style={modalActionsStyle}>
                    <button type="button" onClick={closePaymentModal} style={buttonSecondary}>
                      Cancelar
                    </button>

                    <button type="button" onClick={submitPaymentModal} style={buttonSuccess}>
                      Guardar pago
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.88)',
  border: '1px solid #1e293b',
  borderRadius: '18px',
  padding: '20px',
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
  backdropFilter: 'blur(6px)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '12px',
  border: '1px solid #334155',
  fontSize: '14px',
  background: '#0f172a',
  color: '#e5e7eb',
  outline: 'none',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 10px',
  borderBottom: '1px solid #334155',
  color: '#cbd5e1',
  background: '#0f172a',
  fontSize: '13px',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 10px',
  borderBottom: '1px solid #1e293b',
  verticalAlign: 'top',
  color: '#e5e7eb',
  fontSize: '13px',
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  lineHeight: 1.45,
}

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
  alignItems: 'center',
  marginBottom: '16px',
}

const formLabelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  color: '#f8fafc',
  fontSize: '13px',
  fontWeight: 700,
}

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'nowrap',
  alignItems: 'center',
  whiteSpace: 'nowrap',
}

const buttonPrimary: React.CSSProperties = {
  padding: '10px 16px',
  border: 'none',
  borderRadius: '10px',
  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
  color: '#ffffff',
  cursor: 'pointer',
  fontWeight: 600,
}

const buttonSecondary: React.CSSProperties = {
  padding: '10px 16px',
  border: 'none',
  borderRadius: '10px',
  background: '#1e293b',
  color: '#e2e8f0',
  cursor: 'pointer',
  fontWeight: 600,
}

const buttonInfo: React.CSSProperties = {
  padding: '8px 12px',
  border: 'none',
  borderRadius: '8px',
  background: '#1e3a8a',
  color: '#dbeafe',
  cursor: 'pointer',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  flexShrink: 0,
}

const buttonSuccess: React.CSSProperties = {
  padding: '8px 12px',
  border: 'none',
  borderRadius: '8px',
  background: '#166534',
  color: '#dcfce7',
  cursor: 'pointer',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  flexShrink: 0,
}

const buttonDanger: React.CSSProperties = {
  padding: '8px 12px',
  border: 'none',
  borderRadius: '8px',
  background: '#7f1d1d',
  color: '#fee2e2',
  cursor: 'pointer',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  flexShrink: 0,
}

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(2, 6, 23, 0.72)',
  backdropFilter: 'blur(6px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  zIndex: 9999,
}

const modalCardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '620px',
  background: 'linear-gradient(180deg, #172033 0%, #101827 100%)',
  border: '1px solid #2b3b52',
  borderRadius: '24px',
  padding: '28px',
  boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
}

const modalTitleStyle: React.CSSProperties = {
  margin: 0,
  color: '#f8fafc',
  fontSize: '20px',
  fontWeight: 800,
}

const modalTextStyle: React.CSSProperties = {
  marginTop: '10px',
  marginBottom: 0,
  color: '#cbd5e1',
  fontSize: '16px',
  lineHeight: 1.6,
}

const modalActionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  flexWrap: 'wrap',
  marginTop: '22px',
}

function getModalIconSymbol(type: ModalType) {
  if (type === 'success') return '✓'
  if (type === 'warning') return '!'
  if (type === 'danger') return '🗑'
  return 'i'
}

function getModalIconBoxStyle(type: ModalType): React.CSSProperties {
  if (type === 'success') {
    return {
      width: '58px',
      height: '58px',
      borderRadius: '18px',
      background: 'rgba(34,197,94,.16)',
      color: '#86efac',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '34px',
      fontWeight: 700,
      flexShrink: 0,
    }
  }

  if (type === 'warning') {
    return {
      width: '58px',
      height: '58px',
      borderRadius: '18px',
      background: 'rgba(245,158,11,.16)',
      color: '#fcd34d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '34px',
      fontWeight: 700,
      flexShrink: 0,
    }
  }

  if (type === 'danger') {
    return {
      width: '58px',
      height: '58px',
      borderRadius: '18px',
      background: 'rgba(239,68,68,.16)',
      color: '#fca5a5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '28px',
      fontWeight: 700,
      flexShrink: 0,
    }
  }

  return {
    width: '58px',
    height: '58px',
    borderRadius: '18px',
    background: 'rgba(59,130,246,.16)',
    color: '#93c5fd',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '30px',
    fontWeight: 700,
    flexShrink: 0,
  }
}

function getModalConfirmButtonStyle(type: ModalType): React.CSSProperties {
  if (type === 'danger') {
    return {
      ...buttonDanger,
      padding: '12px 22px',
      borderRadius: '12px',
      fontWeight: 700,
    }
  }

  if (type === 'warning') {
    return {
      ...buttonSecondary,
      padding: '12px 22px',
      borderRadius: '12px',
      background: '#d97706',
      color: '#fff7ed',
      fontWeight: 700,
    }
  }

  if (type === 'success') {
    return {
      ...buttonSuccess,
      padding: '12px 22px',
      borderRadius: '12px',
      fontWeight: 700,
    }
  }

  return {
    ...buttonInfo,
    padding: '12px 22px',
    borderRadius: '12px',
    fontWeight: 700,
  }
}

const badgeActive: React.CSSProperties = {
  display: 'inline-block',
  padding: '6px 10px',
  borderRadius: '999px',
  background: '#052e16',
  color: '#86efac',
  fontSize: '12px',
  fontWeight: 700,
}

const badgeInactive: React.CSSProperties = {
  display: 'inline-block',
  padding: '6px 10px',
  borderRadius: '999px',
  background: '#1e293b',
  color: '#cbd5e1',
  fontSize: '12px',
  fontWeight: 700,
}

function estadoBadge(estado: string): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-block',
    padding: '6px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  }

  if (estado === 'PAGADO') {
    return { ...base, background: '#052e16', color: '#86efac' }
  }

  if (estado === 'PENDIENTE') {
    return { ...base, background: '#78350f', color: '#fde68a' }
  }

  if (estado === 'MENSAJE_ENVIADO') {
    return { ...base, background: '#1e3a8a', color: '#bfdbfe' }
  }

  if (estado === 'BAJA') {
    return { ...base, background: '#7f1d1d', color: '#fecaca' }
  }

  return { ...base, background: '#1e293b', color: '#cbd5e1' }
}

export default App
