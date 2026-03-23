import React, { useEffect, useMemo, useState } from 'react'

type Cliente = {
  id: number
  nombre: string
  telefono: string
  monto: number | string
  carpeta: string
  observacion?: string | null
}

type CuentaAcceso = {
  id: number
  correo: string
  password: string
  capacidad: number
  activa: boolean
  observacion?: string | null
  used: number
}

type Venta = {
  id: number
  no?: number
  clienteId: number
  cuentaAccesoId?: number | null
  fechaInicio: string
  fechaCierre: string
  fechaPago?: string | null
  monto: number | string
  descuento: number | string
  estado: string
  tipoDispositivo: string
  cantidadDispositivos: number
  observacion?: string | null
  cliente: Cliente
  cuentaAcceso?: CuentaAcceso | null
}

type HistorialBaja = {
  id: number
  ventaId?: number | null
  clienteId: number
  clienteNombre: string
  telefono?: string | null
  detalle?: string | null
  fechaBaja: string
}

type WhatsAppLog = {
  id: number
  ventaId?: number | null
  clienteNombre?: string | null
  telefono?: string | null
  fechaObjetivo?: string | null
  estado?: string | null
  detalle?: string | null
  createdAt: string
}

type WhatsAppConfig = {
  enabled: boolean
  graphVersion: string
  phoneNumberId: string
  templateName: string
  langCode: string
  hasToken: boolean
}

type CuentaPreview = {
  id?: number | null
  correo: string
  password: string
  capacidad: number
  activa: boolean
  observacion?: string | null
  used: number
}

type TabKey =
  | 'dashboard'
  | 'registro'
  | 'ventas'
  | 'clientes'
  | 'cuentas'
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

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const ESTADOS = ['PENDIENTE', 'PAGADO', 'MENSAJE_ENVIADO', 'BAJA']
const ESTADOS_FORM = ['PENDIENTE', 'MENSAJE_ENVIADO', 'BAJA']
const DISPOSITIVOS = ['PC', 'Laptop', 'Celular', 'Tablet', 'Otro']
const MAX_CLIENTES_POR_CORREO = 20

const PHONE_COUNTRIES: PhoneCountry[] = [
  { label: '+51 (PE)', dialCode: '51' },
  { label: '+1 (US)', dialCode: '1' },
  { label: '+34 (ES)', dialCode: '34' },
  { label: '+52 (MX)', dialCode: '52' },
  { label: '+54 (AR)', dialCode: '54' },
  { label: '+57 (CO)', dialCode: '57' },
]

const MANUAL_ACCOUNT_PRESETS = [
  {
    correo: 'luiscadenas319@gmail.com',
    password: 'DragonBall.940',
  },
  {
    correo: 'kinguvillalobos@gmail.com',
    password: 'DragonBallGT.940',
  },
]

const emptyClienteForm = {
  nombre: '',
  telefono: '',
  monto: '',
  carpeta: '',
  observacion: '',
}

const emptyCuentaForm = {
  correo: '',
  password: '',
  capacidad: '20',
  activa: 'true',
  observacion: '',
}

const emptyVentaForm = {
  cliente: '',
  telefono: '',
  carpeta: '',
  fechaInicio: '',
  fechaCierre: '',
  fechaPago: '',
  monto: '',
  descuento: '',
  estado: 'PENDIENTE',
  tipoDispositivo: '',
  cantidadDispositivos: '',
  observacion: '',
  assignmentMode: 'auto',
  cuentaAccesoId: '',
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

function getVentaMontoMensual(venta?: Venta | null) {
  if (!venta) return 0
  const montoCliente = Number(venta.cliente?.monto || 0)
  if (montoCliente > 0) return montoCliente
  return Number(venta.monto || 0)
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard')

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [cuentas, setCuentas] = useState<CuentaAcceso[]>([])
  const [ventas, setVentas] = useState<Venta[]>([])
  const [historialBajas, setHistorialBajas] = useState<HistorialBaja[]>([])
  const [whatsAppLogs, setWhatsAppLogs] = useState<WhatsAppLog[]>([])

  const [loadingClientes, setLoadingClientes] = useState(true)
  const [loadingCuentas, setLoadingCuentas] = useState(true)
  const [loadingVentas, setLoadingVentas] = useState(true)
  const [loadingHistorial, setLoadingHistorial] = useState(true)
  const [loadingWhatsAppLogs, setLoadingWhatsAppLogs] = useState(true)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [clienteForm, setClienteForm] = useState(emptyClienteForm)
  const [cuentaForm, setCuentaForm] = useState(emptyCuentaForm)
  const [ventaForm, setVentaForm] = useState(emptyVentaForm)
  const [telefonoPais, setTelefonoPais] = useState(defaultPhoneCountry.dialCode)

  const [whatsAppConfig, setWhatsAppConfig] = useState<WhatsAppConfig>({
    enabled: false,
    graphVersion: 'v23.0',
    phoneNumberId: '',
    templateName: 'gpt_plus_vence_hoy',
    langCode: 'es_PE',
    hasToken: false,
  })

  const [whatsAppTokenInput, setWhatsAppTokenInput] = useState('')
  const [editingClienteId, setEditingClienteId] = useState<number | null>(null)
  const [editingCuentaId, setEditingCuentaId] = useState<number | null>(null)
  const [editingVentaId, setEditingVentaId] = useState<number | null>(null)
  const [showAccessPassword, setShowAccessPassword] = useState(false)

  const [searchCliente, setSearchCliente] = useState('')
  const [searchCuenta, setSearchCuenta] = useState('')
  const [searchVenta, setSearchVenta] = useState('')
  const [filterCorreoVenta, setFilterCorreoVenta] = useState('')
  const [filterEstadoVenta, setFilterEstadoVenta] = useState('')
  const [filterMesVenta, setFilterMesVenta] = useState('')
  const [filterFechaCierreVenta, setFilterFechaCierreVenta] = useState('')

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

  async function fetchJson(path: string, options?: RequestInit) {
    const res = await fetch(`${API_BASE}${path}`, options)
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(data.error || 'Ocurrió un error.')
    }

    return data
  }

  async function cargarClientes() {
    try {
      setLoadingClientes(true)
      const data = await fetchJson('/clientes')
      setClientes(data)
    } catch (err: any) {
      setError(err.message || 'Error cargando clientes.')
    } finally {
      setLoadingClientes(false)
    }
  }

  async function cargarCuentas() {
    try {
      setLoadingCuentas(true)
      const data = await fetchJson('/cuentas')
      setCuentas(data)
    } catch (err: any) {
      setError(err.message || 'Error cargando cuentas.')
    } finally {
      setLoadingCuentas(false)
    }
  }

  async function cargarVentas() {
    try {
      setLoadingVentas(true)
      const data = await fetchJson('/ventas')
      setVentas(data)
    } catch (err: any) {
      setError(err.message || 'Error cargando ventas.')
    } finally {
      setLoadingVentas(false)
    }
  }

  async function actualizarVistaVentas() {
    limpiarMensajes()

    try {
      setLoadingVentas(true)
      setLoadingCuentas(true)
      setLoadingClientes(true)

      const [ventasData, cuentasData, clientesData] = await Promise.all([
        fetchJson('/ventas'),
        fetchJson('/cuentas'),
        fetchJson('/clientes'),
      ])

      setVentas(ventasData)
      setCuentas(cuentasData)
      setClientes(clientesData)
      setSuccess('Listado de ventas actualizado.')
    } catch (err: any) {
      setError(err.message || 'Error actualizando ventas.')
    } finally {
      setLoadingVentas(false)
      setLoadingCuentas(false)
      setLoadingClientes(false)
    }
  }

  async function cargarHistorialBajas() {
    try {
      setLoadingHistorial(true)
      const data = await fetchJson('/historial-bajas')
      setHistorialBajas(data)
    } catch (err: any) {
      setError(err.message || 'Error cargando historial de bajas.')
    } finally {
      setLoadingHistorial(false)
    }
  }

  async function cargarWhatsAppLogs() {
    try {
      setLoadingWhatsAppLogs(true)
      const data = await fetchJson('/whatsapp/logs')
      setWhatsAppLogs(data)
    } catch (err: any) {
      setError(err.message || 'Error cargando logs de WhatsApp.')
    } finally {
      setLoadingWhatsAppLogs(false)
    }
  }

  async function cargarWhatsAppConfig() {
    try {
      const data = await fetchJson('/config/whatsapp')
      setWhatsAppConfig(data)
    } catch (err: any) {
      setError(err.message || 'Error cargando configuración de WhatsApp.')
    }
  }

  useEffect(() => {
    cargarHistorialBajas()
    cargarWhatsAppLogs()
    cargarWhatsAppConfig()
    cargarClientes()
    cargarCuentas()
    cargarVentas()
  }, [])

  useEffect(() => {
    if (!paymentModalVenta) return
    const montoMensual = getVentaMontoMensual(paymentModalVenta)
    setPaymentMonto((montoMensual * Number(paymentMeses)).toFixed(2))
  }, [paymentMeses, paymentModalVenta])

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
      setError('Selecciona si cancelará 1 o 2 meses.')
      return
    }

    if (!paymentFecha) {
      setError('Selecciona la fecha de pago.')
      return
    }

    try {
      await fetchJson(`/ventas/${paymentModalVenta.id}/pagar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          montoPagado: monto,
          fechaPago: paymentFecha,
          mesesPagados,
        }),
      })

      setSuccess(
        `Pago registrado correctamente para ${paymentModalVenta.cliente?.nombre || 'el cliente'}.`
      )

      closePaymentModal()
      await cargarVentas()
      await cargarCuentas()
      await cargarClientes()
    } catch (err: any) {
      setError(err.message || 'Error al registrar pago.')
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
    setShowAccessPassword(false)
  }

  async function submitGuardarCliente() {
    const payload = {
      ...clienteForm,
      monto: Number(clienteForm.monto),
    }

    if (editingClienteId) {
      await fetchJson(`/clientes/${editingClienteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setSuccess('Cliente actualizado correctamente.')
    } else {
      await fetchJson('/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setSuccess('Cliente guardado correctamente.')
    }

    resetClienteForm()
    await cargarClientes()
    await cargarVentas()
    await cargarCuentas()
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
        } catch (err: any) {
          setError(err.message || 'Error al guardar cliente.')
        }
      },
    })
  }

  async function submitGuardarCuenta() {
    if (editingCuentaId) {
      await fetchJson(`/cuentas/${editingCuentaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuentaForm),
      })
      setSuccess('Cuenta actualizada correctamente.')
    } else {
      await fetchJson('/cuentas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuentaForm),
      })
      setSuccess('Cuenta guardada correctamente.')
    }

    resetCuentaForm()
    await cargarCuentas()
    await cargarVentas()
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
        } catch (err: any) {
          setError(err.message || 'Error al guardar cuenta.')
        }
      },
    })
  }

  async function submitGuardarVenta() {
    const selectedManualAccount = manualAccounts.find(
      (cuenta) => String(cuenta.id ?? '') === String(ventaForm.cuentaAccesoId)
    )

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

    const payload = {
      ...ventaForm,
      telefono: telefonoCompleto,
      monto: Number(ventaForm.monto),
      descuento: Number(ventaForm.descuento || 0),
      tipoDispositivo: getSelectedTipos(ventaForm.tipoDispositivo),
      cantidadDispositivos: cantidadTiposSeleccionados,
      cuentaAccesoId:
        ventaForm.assignmentMode === 'manual'
          ? Number(selectedManualAccount!.id)
          : null,
    }

    if (editingVentaId) {
      await fetchJson(`/ventas/${editingVentaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setSuccess('Venta actualizada correctamente.')
    } else {
      await fetchJson('/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setSuccess('Venta guardada correctamente.')
    }

    resetVentaForm()
    await cargarVentas()
    await cargarCuentas()
    await cargarClientes()
  }

  async function guardarVenta(e: React.FormEvent) {
    e.preventDefault()
    limpiarMensajes()

    if (
      !ventaForm.cliente.trim() ||
      !ventaForm.telefono.trim() ||
      !ventaForm.fechaInicio ||
      !ventaForm.fechaCierre ||
      !ventaForm.monto ||
      !ventaForm.tipoDispositivo
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
        } catch (err: any) {
          setError(err.message || 'Error al guardar venta.')
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
    setTelefonoPais(phone.dialCode)

    setEditingVentaId(venta.id)
    setVentaForm({
      cliente: venta.cliente?.nombre || '',
      telefono: phone.local || '',
      carpeta: venta.cliente?.carpeta || '',
      fechaInicio: toInputDate(venta.fechaInicio),
      fechaCierre: toInputDate(venta.fechaCierre),
      fechaPago: toInputDate(venta.fechaPago),
      monto: String(venta.monto ?? ''),
      descuento: String(venta.descuento ?? 0),
      estado: venta.estado || 'PENDIENTE',
      tipoDispositivo: venta.tipoDispositivo || '',
      cantidadDispositivos: String(venta.cantidadDispositivos ?? ''),
      observacion: String(venta.observacion ?? ''),
      assignmentMode: venta.cuentaAccesoId ? 'manual' : 'auto',
      cuentaAccesoId: venta.cuentaAccesoId ? String(venta.cuentaAccesoId) : '',
    })
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
          await fetchJson(`/clientes/${id}`, { method: 'DELETE' })
          setSuccess('Cliente eliminado correctamente.')
          if (editingClienteId === id) resetClienteForm()
          await cargarClientes()
          await cargarVentas()
          await cargarCuentas()
        } catch (err: any) {
          setError(err.message || 'Error al eliminar cliente.')
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
          await fetchJson(`/cuentas/${id}`, { method: 'DELETE' })
          setSuccess('Cuenta eliminada correctamente.')
          if (editingCuentaId === id) resetCuentaForm()
          await cargarCuentas()
          await cargarVentas()
        } catch (err: any) {
          setError(err.message || 'Error al eliminar cuenta.')
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
          await fetchJson(`/ventas/${id}`, { method: 'DELETE' })
          setSuccess('Venta eliminada correctamente.')
          if (editingVentaId === id) resetVentaForm()
          await cargarVentas()
          await cargarCuentas()
        } catch (err: any) {
          setError(err.message || 'Error al eliminar venta.')
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

  async function guardarWhatsAppConfig(e: React.FormEvent) {
    e.preventDefault()
    limpiarMensajes()

    openConfirmModal({
      title: 'Guardar configuración',
      message: 'Se actualizará la configuración de WhatsApp.',
      type: 'success',
      confirmText: 'Guardar',
      onConfirm: async () => {
        try {
          await fetchJson('/config/whatsapp', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              graphVersion: whatsAppConfig.graphVersion,
              phoneNumberId: whatsAppConfig.phoneNumberId,
              templateName: whatsAppConfig.templateName,
              langCode: whatsAppConfig.langCode,
              accessToken: whatsAppTokenInput,
            }),
          })

          setSuccess('Configuración de WhatsApp guardada correctamente.')
          setWhatsAppTokenInput('')
          await cargarWhatsAppConfig()
        } catch (err: any) {
          setError(err.message || 'Error guardando configuración de WhatsApp.')
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
          await fetchJson('/config/whatsapp/enabled', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled }),
          })

          setWhatsAppConfig((prev) => ({ ...prev, enabled }))
          setSuccess(enabled ? 'WhatsApp activado.' : 'WhatsApp desactivado.')
        } catch (err: any) {
          setError(err.message || 'Error cambiando estado de WhatsApp.')
        }
      },
    })
  }

  function runWhatsAppDueTodayNow() {
    limpiarMensajes()

    openConfirmModal({
      title: 'Enviar cobros de hoy',
      message: 'Se ejecutará el envío manual de los cobros que vencen hoy.',
      type: 'info',
      confirmText: 'Ejecutar',
      onConfirm: async () => {
        try {
          const result = await fetchJson('/whatsapp/send-due-today', {
            method: 'POST',
          })

          setSuccess(
            `Proceso ejecutado. Enviados: ${result.sent || 0}, omitidos: ${result.skipped || 0}, errores: ${result.errors || 0}.`
          )

          await cargarVentas()
          await cargarWhatsAppLogs()
        } catch (err: any) {
          setError(err.message || 'Error ejecutando envío de WhatsApp.')
        }
      },
    })
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
          await fetchJson('/maintenance/clear-history', { method: 'DELETE' })
          setSuccess('Historial limpiado correctamente.')
          await cargarHistorialBajas()
          await cargarWhatsAppLogs()
        } catch (err: any) {
          setError(err.message || 'Error limpiando historial.')
        }
      },
    })
  }

  const resumen = useMemo(() => {
    const totalClientes = clientes.length
    const totalCuentas = cuentas.length
    const cuentasActivas = cuentas.filter((c) => c.activa).length
    const totalVentas = ventas.length
    const pagadas = ventas.filter((v) => v.estado === 'PAGADO').length
    const pendientes = ventas.filter((v) => v.estado === 'PENDIENTE').length
    const mensajes = ventas.filter((v) => v.estado === 'MENSAJE_ENVIADO').length
    const bajas = ventas.filter((v) => v.estado === 'BAJA').length
    const vencenHoy = ventas.filter((v) => {
      if (v.estado === 'PAGADO' || v.estado === 'BAJA') return false
      return diffDaysFromToday(v.fechaCierre) === 0
    }).length

    const vencidos = ventas.filter((v) => {
      if (v.estado === 'PAGADO' || v.estado === 'BAJA') return false
      const diff = diffDaysFromToday(v.fechaCierre)
      return diff !== null && diff < 0
    }).length

    const montoTotal = ventas.reduce((acc, v) => acc + Number(v.monto || 0), 0)
    const descuentoTotal = ventas.reduce((acc, v) => acc + Number(v.descuento || 0), 0)
    const neto = montoTotal - descuentoTotal

    return {
      totalClientes,
      totalCuentas,
      cuentasActivas,
      totalVentas,
      pagadas,
      pendientes,
      mensajes,
      bajas,
      montoTotal,
      descuentoTotal,
      neto,
      vencenHoy,
      vencidos,
    }
  }, [clientes, cuentas, ventas])

  const accountClientCountMap = useMemo(() => {
    const byId = new Map<string, Set<number>>()
    const byCorreo = new Map<string, Set<number>>()

    ventas.forEach((venta) => {
      const clienteId = Number(venta.clienteId || venta.cliente?.id || 0)
      if (!clienteId) return

      if (venta.cuentaAccesoId !== null && venta.cuentaAccesoId !== undefined) {
        const key = String(venta.cuentaAccesoId)
        if (!byId.has(key)) byId.set(key, new Set<number>())
        byId.get(key)?.add(clienteId)
      }

      const correo = normalizeText(venta.cuentaAcceso?.correo || '')
      if (correo) {
        if (!byCorreo.has(correo)) byCorreo.set(correo, new Set<number>())
        byCorreo.get(correo)?.add(clienteId)
      }
    })

    return { byId, byCorreo }
  }, [ventas])

  const manualAccounts = useMemo<CuentaPreview[]>(() => {
    return MANUAL_ACCOUNT_PRESETS.map((preset) => {
      const linkedAccount =
        cuentas.find((cuenta) => normalizeText(cuenta.correo) === normalizeText(preset.correo)) || null

      const usedById = linkedAccount?.id
        ? accountClientCountMap.byId.get(String(linkedAccount.id))?.size || 0
        : 0
      const usedByCorreo = accountClientCountMap.byCorreo.get(normalizeText(preset.correo))?.size || 0

      return {
        id: linkedAccount?.id ?? null,
        correo: preset.correo,
        password: preset.password,
        capacidad: MAX_CLIENTES_POR_CORREO,
        activa: linkedAccount?.activa ?? true,
        observacion: linkedAccount?.observacion || '',
        used: Math.max(usedById, usedByCorreo),
      }
    })
  }, [cuentas, accountClientCountMap])

  const bestAutoAccount = useMemo<CuentaPreview | null>(() => {
    const disponibles = cuentas
      .filter((c) => c.activa)
      .map((cuenta) => {
        const usedById = accountClientCountMap.byId.get(String(cuenta.id))?.size || 0
        const usedByCorreo = accountClientCountMap.byCorreo.get(normalizeText(cuenta.correo))?.size || 0

        return {
          ...cuenta,
          capacidad: MAX_CLIENTES_POR_CORREO,
          used: Math.max(usedById, usedByCorreo),
        }
      })
      .filter((c) => Number(c.used || 0) < MAX_CLIENTES_POR_CORREO)
      .sort((a, b) => {
        if ((a.used || 0) !== (b.used || 0)) return (a.used || 0) - (b.used || 0)
        return a.correo.localeCompare(b.correo)
      })

    return disponibles[0] || null
  }, [cuentas, accountClientCountMap])

  const selectedCuentaPreview = useMemo<CuentaPreview | null>(() => {
    if (ventaForm.assignmentMode === 'manual') {
      return (
        manualAccounts.find(
          (cuenta) => String(cuenta.id ?? '') === String(ventaForm.cuentaAccesoId)
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

  function handleEstadoSelect(estado: string) {
    setVentaForm((prev) => ({ ...prev, estado }))
  }

  function getSelectedTipos(value: string) {
    return String(value || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
  }

  function handleTipoDispositivoSelect(tipo: string) {
    setVentaForm((prev) => {
      const actuales = getSelectedTipos(prev.tipoDispositivo)
      const siguientes = actuales.includes(tipo)
        ? actuales.filter((t) => t !== tipo)
        : [...actuales, tipo]

      return {
        ...prev,
        tipoDispositivo: siguientes.join(', '),
        cantidadDispositivos: siguientes.length ? String(siguientes.length) : '',
      }
    })
  }

  const dueTodayRows = useMemo(() => {
    return ventas.filter((v) => {
      if (v.estado === 'PAGADO' || v.estado === 'BAJA') return false
      return diffDaysFromToday(v.fechaCierre) === 0
    })
  }, [ventas])

  const overdueRows = useMemo(() => {
    return ventas.filter((v) => {
      if (v.estado === 'PAGADO' || v.estado === 'BAJA') return false
      const diff = diffDaysFromToday(v.fechaCierre)
      return diff !== null && diff < 0
    })
  }, [ventas])

  const clientesFiltrados = useMemo(() => {
    const q = normalizeText(searchCliente)
    return clientes.filter((c) => {
      if (!q) return true
      const blob = normalizeText(
        `${c.nombre} ${c.telefono} ${c.monto} ${c.carpeta} ${c.observacion || ''}`
      )
      return blob.includes(q)
    })
  }, [clientes, searchCliente])

  const cuentasFiltradas = useMemo(() => {
    const q = normalizeText(searchCuenta)
    return cuentas.filter((c) => {
      if (!q) return true
      const blob = normalizeText(`${c.correo} ${c.observacion || ''}`)
      return blob.includes(q)
    })
  }, [cuentas, searchCuenta])

  const ventasFiltradas = useMemo(() => {
    const q = normalizeText(searchVenta)

    return [...ventas]
      .filter((v) => {
        if (filterCorreoVenta) {
          const correo = normalizeText(v.cuentaAcceso?.correo || '')
          if (correo !== normalizeText(filterCorreoVenta)) return false
        }

        if (filterEstadoVenta && v.estado !== filterEstadoVenta) return false

        if (filterMesVenta) {
          const mesVenta = String(v.fechaCierre || '').slice(0, 7)
          if (mesVenta !== filterMesVenta) return false
        }

        if (filterFechaCierreVenta) {
          const cierre = toInputDate(v.fechaCierre)
          if (cierre !== filterFechaCierreVenta) return false
        }

        if (!q) return true

        const blob = normalizeText(
          `${v.cliente?.nombre || ''} ${v.cliente?.telefono || ''} ${v.tipoDispositivo} ${v.estado} ${v.monto} ${v.cuentaAcceso?.correo || ''} ${v.observacion || ''}`
        )
        return blob.includes(q)
      })
      .sort((a, b) => {
        const na = Number(a.no || a.id || 0)
        const nb = Number(b.no || b.id || 0)
        return na - nb
      })
  }, [ventas, searchVenta, filterCorreoVenta, filterEstadoVenta, filterMesVenta, filterFechaCierreVenta])

  const cantidadTiposSeleccionados = useMemo(() => {
    return getSelectedTipos(ventaForm.tipoDispositivo).length
  }, [ventaForm.tipoDispositivo])

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        overflowX: 'hidden',
        background: 'linear-gradient(135deg, #020617 0%, #0f172a 45%, #111827 100%)',
        padding: '16px 20px 16px 0',
        fontFamily: 'Arial, sans-serif',
        color: '#e5e7eb',
      }}
    >
      <div style={{ width: '100%', maxWidth: 'none', margin: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '260px minmax(0, 1fr)',
            gap: '20px',
            alignItems: 'start',
          }}
        >
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
                SISTEMA DE COBRO
              </h1>
              <p style={{ marginTop: '8px', fontSize: '13px', color: '#94a3b8', lineHeight: 1.4 }}>
                Gestión de clientes y ventas
              </p>
            </div>

            <div style={{ display: 'grid', gap: '10px', padding: '18px 14px' }}>
              {sideNavButton('dashboard', 'Dashboard', activeTab, setActiveTab)}
              {sideNavButton('registro', 'Registrar / Editar', activeTab, setActiveTab)}
              {sideNavButton('ventas', 'Ventas', activeTab, setActiveTab)}
              {sideNavButton('clientes', 'Clientes', activeTab, setActiveTab)}
              {sideNavButton('cuentas', 'Cuentas', activeTab, setActiveTab)}
              {sideNavButton('historial', 'Historial', activeTab, setActiveTab)}
              {sideNavButton('configuracion', 'Configuración', activeTab, setActiveTab)}
            </div>
          </aside>

          <main style={{ minWidth: 0, width: '100%', paddingLeft: '6px' }}>
            <div style={{ marginBottom: '16px' }}>
              {error && <Alert type="error" text={error} />}
              {success && <Alert type="success" text={success} />}
            </div>

            {activeTab === 'dashboard' && (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
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
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '16px',
                  }}
                >
                  <div style={cardStyle}>
                    <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Resumen económico</h3>
                    <p>Monto total: <b>S/. {resumen.montoTotal.toFixed(2)}</b></p>
                    <p>Descuento total: <b>S/. {resumen.descuentoTotal.toFixed(2)}</b></p>
                    <p>Neto estimado: <b>S/. {resumen.neto.toFixed(2)}</b></p>
                  </div>

                  <div style={cardStyle}>
                    <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Vencen hoy</h3>
                    {dueTodayRows.length === 0 ? (
                      <p>No hay clientes que venzan hoy.</p>
                    ) : (
                      dueTodayRows.slice(0, 10).map((v) => (
                        <p key={v.id}>
                          <b>{v.cliente?.nombre}</b> — {formatDateDisplay(v.fechaCierre)}
                        </p>
                      ))
                    )}
                  </div>

                  <div style={cardStyle}>
                    <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Vencidos</h3>
                    {overdueRows.length === 0 ? (
                      <p>No hay clientes vencidos.</p>
                    ) : (
                      overdueRows.slice(0, 10).map((v) => (
                        <p key={v.id}>
                          <b>{v.cliente?.nombre}</b> — {formatDateDisplay(v.fechaCierre)}
                        </p>
                      ))
                    )}
                  </div>

                  <div style={cardStyle}>
                    <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Asignación</h3>
                    <p>Total cuentas: <b>{resumen.totalCuentas}</b></p>
                    <p>Cuentas activas: <b>{resumen.cuentasActivas}</b></p>
                    <p>
                      Mejor cuenta automática:{' '}
                      <b>
                        {bestAutoAccount
                          ? `${bestAutoAccount.correo} (${bestAutoAccount.used}/${bestAutoAccount.capacidad})`
                          : 'Sin disponible'}
                      </b>
                    </p>
                  </div>
                </div>
              </>
            )}

            {(activeTab === 'registro' || activeTab === 'ventas') && (
              <>
                {activeTab === 'registro' && (
                  <div style={{ display: 'grid', gap: '20px' }}>
                    <div style={{ ...cardStyle, width: '100%', minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ marginBottom: '14px' }}>
                        <h2 style={{ marginTop: 0, color: '#f8fafc' }}>Registrar / Editar venta</h2>
                        <p style={{ marginTop: '6px', color: '#94a3b8', fontSize: '14px' }}>
                          Guarda ventas, fechas de cobro y estado de seguimiento.
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
                              gridTemplateColumns: 'repeat(2, minmax(280px, 1fr))',
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
                                  gridTemplateColumns: '150px minmax(0, 1fr)',
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
                              <label style={formLabelStyle}>Fecha de pago</label>
                              <input
                                type="date"
                                name="fechaPago"
                                value={ventaForm.fechaPago}
                                onChange={handleVentaChange}
                                style={inputStyle}
                              />
                            </div>

                            <div>
                              <label style={formLabelStyle}>Estado *</label>
                              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', paddingTop: '2px' }}>
                                {ESTADOS_FORM.map((estado) => (
                                  <button
                                    key={estado}
                                    type="button"
                                    onClick={() => handleEstadoSelect(estado)}
                                    style={{
                                      padding: '8px 12px',
                                      borderRadius: '999px',
                                      border:
                                        ventaForm.estado === estado
                                          ? '1px solid #60a5fa'
                                          : '1px solid #334155',
                                      background: ventaForm.estado === estado ? '#13233f' : 'transparent',
                                      color: '#e5e7eb',
                                      cursor: 'pointer',
                                      fontWeight: 700,
                                      fontSize: '12px',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {estado}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={formLabelStyle}>Tipo de dispositivo</label>
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
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
                                        key={cuenta.correo}
                                        value={cuenta.id ?? ''}
                                        disabled={!cuenta.id}
                                      >
                                        {cuenta.id
                                          ? `${cuenta.correo} (${cuenta.used}/${MAX_CLIENTES_POR_CORREO} clientes)`
                                          : `${cuenta.correo} (crear en Cuentas primero)`}
                                      </option>
                                    ))}
                                  </select>
                                  <div style={{ marginTop: '6px', color: '#94a3b8', fontSize: '12px' }}>
                                    {selectedCuentaPreview
                                      ? `Clientes registrados: ${selectedCuentaPreview.used}/${MAX_CLIENTES_POR_CORREO}`
                                      : 'Solo se muestran los 2 correos autorizados.'}
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
                                  Acceso (solo visual)
                                </div>

                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '12px',
                                    alignItems: 'end',
                                  }}
                                >
                                  <div>
                                    <label style={formLabelStyle}>Usuario</label>
                                    <input
                                      value={selectedCuentaPreview?.correo || ''}
                                      readOnly
                                      style={{ ...inputStyle, color: '#e5e7eb' }}
                                    />
                                    <div style={{ marginTop: '6px', color: '#94a3b8', fontSize: '12px' }}>
                                      {ventaForm.assignmentMode === 'auto'
                                        ? 'Mostrando la cuenta que se autoasignará en este momento.'
                                        : selectedCuentaPreview
                                          ? `Clientes registrados con este correo: ${selectedCuentaPreview.used}/${MAX_CLIENTES_POR_CORREO}. Máximo ${MAX_CLIENTES_POR_CORREO} clientes.`
                                          : 'Selecciona uno de los 2 correos manuales.'}
                                    </div>
                                  </div>

                                  <div>
                                    <label style={formLabelStyle}>Contraseña</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                                      <input
                                        type={showAccessPassword ? 'text' : 'password'}
                                        value={selectedCuentaPreview?.password || ''}
                                        readOnly
                                        style={inputStyle}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setShowAccessPassword((prev) => !prev)}
                                        style={buttonSecondary}
                                      >
                                        {showAccessPassword ? 'Ocultar' : 'Ver'}
                                      </button>
                                    </div>
                                  </div>
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
                          onChange={(e) => setSearchVenta(e.target.value)}
                          style={inputStyle}
                        />

                        <select
                          value={filterCorreoVenta}
                          onChange={(e) => setFilterCorreoVenta(e.target.value)}
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
                          onChange={(e) => setFilterEstadoVenta(e.target.value)}
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
                          onChange={(e) => setFilterMesVenta(e.target.value)}
                          style={inputStyle}
                        />

                        <input
                          type="date"
                          value={filterFechaCierreVenta}
                          onChange={(e) => setFilterFechaCierreVenta(e.target.value)}
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
                      <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', paddingBottom: '6px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1700px', tableLayout: 'auto' }}>
                          <thead>
                            <tr style={{ background: '#0f172a' }}>
                              <th style={thStyle}>ID</th>
                              <th style={thStyle}>Cliente</th>
                              <th style={thStyle}>Teléfono</th>
                              <th style={thStyle}>Inicio</th>
                              <th style={thStyle}>Cierre</th>
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
                                    {venta.estado === 'PENDIENTE' && (
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

                  {loadingClientes ? (
                    <p>Cargando clientes...</p>
                  ) : clientesFiltrados.length === 0 ? (
                    <p>No hay clientes registrados.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '980px' }}>
                        <thead>
                          <tr style={{ background: '#0f172a' }}>
                            <th style={thStyle}>ID</th>
                            <th style={thStyle}>Nombre</th>
                            <th style={thStyle}>Teléfono</th>
                            <th style={thStyle}>Monto</th>
                            <th style={thStyle}>Carpeta</th>
                            <th style={thStyle}>Observación</th>
                            <th style={thStyle}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientesFiltrados.map((cliente) => (
                            <tr key={cliente.id}>
                              <td style={tdStyle}>{cliente.id}</td>
                              <td style={tdStyle}>{cliente.nombre}</td>
                              <td style={tdStyle}>{cliente.telefono}</td>
                              <td style={tdStyle}>S/. {Number(cliente.monto || 0).toFixed(2)}</td>
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

                  {loadingCuentas ? (
                    <p>Cargando cuentas...</p>
                  ) : cuentasFiltradas.length === 0 ? (
                    <p>No hay cuentas registradas.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                        <thead>
                          <tr style={{ background: '#0f172a' }}>
                            <th style={thStyle}>ID</th>
                            <th style={thStyle}>Correo</th>
                            <th style={thStyle}>Capacidad</th>
                            <th style={thStyle}>Usados</th>
                            <th style={thStyle}>Estado</th>
                            <th style={thStyle}>Observación</th>
                            <th style={thStyle}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cuentasFiltradas.map((cuenta) => (
                            <tr key={cuenta.id}>
                              <td style={tdStyle}>{cuenta.id}</td>
                              <td style={tdStyle}>{cuenta.correo}</td>
                              <td style={tdStyle}>{cuenta.capacidad}</td>
                              <td style={tdStyle}>{cuenta.used}</td>
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
              <div style={{ display: 'grid', gap: '20px' }}>
                <div style={cardStyle}>
                  <div style={headerRowStyle}>
                    <h2 style={{ margin: 0, color: '#f8fafc' }}>Historial de bajas</h2>
                    <button type="button" onClick={clearHistory} style={buttonDanger}>
                      Limpiar historial
                    </button>
                  </div>

                  {loadingHistorial ? (
                    <p>Cargando historial...</p>
                  ) : historialBajas.length === 0 ? (
                    <p>No hay historial de bajas.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                        <thead>
                          <tr style={{ background: '#0f172a' }}>
                            <th style={thStyle}>ID</th>
                            <th style={thStyle}>Cliente</th>
                            <th style={thStyle}>Teléfono</th>
                            <th style={thStyle}>Detalle</th>
                            <th style={thStyle}>Fecha de baja</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historialBajas.map((row) => (
                            <tr key={row.id}>
                              <td style={tdStyle}>{row.id}</td>
                              <td style={tdStyle}>{row.clienteNombre}</td>
                              <td style={tdStyle}>{row.telefono || '-'}</td>
                              <td style={tdStyle}>{row.detalle || '-'}</td>
                              <td style={tdStyle}>{formatDateDisplay(row.fechaBaja)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div style={cardStyle}>
                  <h2 style={{ marginTop: 0, color: '#f8fafc' }}>Logs de WhatsApp</h2>

                  {loadingWhatsAppLogs ? (
                    <p>Cargando logs...</p>
                  ) : whatsAppLogs.length === 0 ? (
                    <p>No hay logs de WhatsApp.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                        <thead>
                          <tr style={{ background: '#0f172a' }}>
                            <th style={thStyle}>ID</th>
                            <th style={thStyle}>Cliente</th>
                            <th style={thStyle}>Teléfono</th>
                            <th style={thStyle}>Fecha objetivo</th>
                            <th style={thStyle}>Estado</th>
                            <th style={thStyle}>Detalle</th>
                            <th style={thStyle}>Creado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {whatsAppLogs.map((row) => (
                            <tr key={row.id}>
                              <td style={tdStyle}>{row.id}</td>
                              <td style={tdStyle}>{row.clienteNombre || '-'}</td>
                              <td style={tdStyle}>{row.telefono || '-'}</td>
                              <td style={tdStyle}>{formatDateDisplay(row.fechaObjetivo)}</td>
                              <td style={tdStyle}>{row.estado || '-'}</td>
                              <td style={tdStyle}>{row.detalle || '-'}</td>
                              <td style={tdStyle}>{formatDateDisplay(row.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'configuracion' && (
              <div style={{ display: 'grid', gap: '20px' }}>
                <div style={cardStyle}>
                  <h2 style={{ marginTop: 0, color: '#f8fafc' }}>Configuración de WhatsApp</h2>

                  <div
                    style={{
                      marginBottom: '16px',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>Estado:</span>
                    <button
                      type="button"
                      onClick={() => toggleWhatsAppEnabled(!whatsAppConfig.enabled)}
                      style={whatsAppConfig.enabled ? buttonInfo : buttonSecondary}
                    >
                      {whatsAppConfig.enabled ? 'Activo' : 'Inactivo'}
                    </button>
                  </div>

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
                        value={whatsAppConfig.templateName}
                        onChange={(e) =>
                          setWhatsAppConfig((prev) => ({ ...prev, templateName: e.target.value }))
                        }
                        placeholder="Template name"
                        style={inputStyle}
                      />
                      <input
                        value={whatsAppConfig.langCode}
                        onChange={(e) =>
                          setWhatsAppConfig((prev) => ({ ...prev, langCode: e.target.value }))
                        }
                        placeholder="Language code"
                        style={inputStyle}
                      />
                      <input
                        value={whatsAppTokenInput}
                        onChange={(e) => setWhatsAppTokenInput(e.target.value)}
                        placeholder={whatsAppConfig.hasToken ? 'Nuevo token (opcional)' : 'Access token'}
                        style={inputStyle}
                      />

                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button type="submit" style={buttonPrimary}>
                          Guardar configuración
                        </button>
                        <button type="button" onClick={runWhatsAppDueTodayNow} style={buttonInfo}>
                          Enviar cobros de hoy ahora
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
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
                        El monto se calcula automáticamente con el precio fijo del cliente. Solo eliges si cancelará 1 o 2 meses y la fecha de pago.
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
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

function Alert({ type, text }: { type: 'error' | 'success'; text: string }) {
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

function StatCard({
  title,
  value,
  accent,
}: {
  title: string
  value: string
  accent?: string
}) {
  return (
    <div style={cardStyle}>
      <div style={{ color: '#94a3b8', marginBottom: '8px' }}>{title}</div>
      <div style={{ fontSize: '32px', fontWeight: 700, color: accent || '#f8fafc' }}>
        {value}
      </div>
    </div>
  )
}

function sideNavButton(
  key: TabKey,
  label: string,
  activeTab: TabKey,
  setActiveTab: (tab: TabKey) => void
) {
  const active = activeTab === key

  return (
    <button
      type="button"
      onClick={() => setActiveTab(key)}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '15px 18px',
        borderRadius: '16px',
        border: active ? '1px solid #3b82f6' : '1px solid transparent',
        background: active ? 'rgba(37, 99, 235, 0.18)' : 'transparent',
        color: active ? '#ffffff' : '#e2e8f0',
        cursor: 'pointer',
        fontWeight: 700,
        fontSize: '15px',
        transition: 'all 0.2s ease',
      }}
    >
      {label}
    </button>
  )
}

function toInputDate(value?: string | null) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function formatDateDisplay(value?: string | null) {
  if (!value) return '-'
  const text = String(value).slice(0, 10)
  const parts = text.split('-')
  if (parts.length !== 3) return text
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function diffDaysFromToday(value?: string | null) {
  if (!value) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const due = new Date(String(value).slice(0, 10) + 'T00:00:00')
  if (isNaN(due.getTime())) return null

  const ms = due.getTime() - today.getTime()
  return Math.round(ms / 86400000)
}

function normalizeText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
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
