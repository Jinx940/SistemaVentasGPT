const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const app = express();

function parseAllowedOrigins(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const allowedCorsOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS);
const allowAllCorsOrigins = allowedCorsOrigins.includes('*');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

app.set('trust proxy', 1);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowAllCorsOrigins || allowedCorsOrigins.length === 0) {
        return callback(null, true);
      }

      if (allowedCorsOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Origen no permitido por CORS.'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
);
app.use(express.json());

const ESTADOS = ['PENDIENTE', 'PAGADO', 'MENSAJE_ENVIADO', 'BAJA'];
const ROLES_USUARIO = ['ADMIN', 'OPERADOR'];
const COSTO_CHATGPT_POR_CUENTA = 90;
const COSTO_POR_CORREO = COSTO_CHATGPT_POR_CUENTA;
const SESSION_DURATION_DAYS = 7;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

const loginAttemptStore = new Map();

const MONTH_SHEETS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const ESTADO_UI_TO_DB = {
  Pagado: 'PAGADO',
  Pendiente: 'PENDIENTE',
  'Mensaje enviado': 'MENSAJE_ENVIADO',
  Baja: 'BAJA',
};

const ESTADO_DB_TO_UI = {
  PAGADO: 'Pagado',
  PENDIENTE: 'Pendiente',
  MENSAJE_ENVIADO: 'Mensaje enviado',
  BAJA: 'Baja',
};

function cleanText(value) {
  return String(value ?? '').trim();
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function generateSessionToken() {
  return crypto.randomBytes(48).toString('hex');
}

function getSessionExpiryDate() {
  return new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

function getLoginAttemptKey(req, correo) {
  const ip =
    cleanText(req.headers['x-forwarded-for']) ||
    cleanText(req.ip) ||
    cleanText(req.socket?.remoteAddress) ||
    'unknown';

  return `${ip}|${normalizeEmail(correo) || 'anon'}`;
}

function getLoginThrottleMs(key) {
  const item = loginAttemptStore.get(key);
  if (!item) return 0;

  if (item.blockedUntil && item.blockedUntil > Date.now()) {
    return item.blockedUntil - Date.now();
  }

  if (item.windowStartedAt + LOGIN_WINDOW_MS <= Date.now()) {
    loginAttemptStore.delete(key);
  }

  return 0;
}

function registerFailedLoginAttempt(key) {
  const now = Date.now();
  const current = loginAttemptStore.get(key);

  if (!current || current.windowStartedAt + LOGIN_WINDOW_MS <= now) {
    loginAttemptStore.set(key, {
      count: 1,
      windowStartedAt: now,
      blockedUntil: 0,
    });
    return 1;
  }

  const count = current.count + 1;
  const blockedUntil = count >= LOGIN_MAX_ATTEMPTS ? now + LOGIN_WINDOW_MS : 0;

  loginAttemptStore.set(key, {
    count,
    windowStartedAt: current.windowStartedAt,
    blockedUntil,
  });

  return count;
}

function clearLoginAttempts(key) {
  loginAttemptStore.delete(key);
}

function normalizeClientPhone(value) {
  return normalizePhoneForStorage(value);
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeUserRole(value) {
  const role = String(value ?? '').trim().toUpperCase();
  return ROLES_USUARIO.includes(role) ? role : 'OPERADOR';
}

function normalizePhoneForStorage(raw) {
  const digits = String(raw || '').replace(/\D/g, '');

  if (!digits) return '';

  if (digits.length === 11 && digits.startsWith('51')) {
    return digits.slice(2);
  }

  return digits;
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function parseBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function moneyNumber(value) {
  return Number(value || 0);
}

function toDbEstado(value) {
  return ESTADO_UI_TO_DB[String(value || '').trim()] || String(value || '').trim();
}

function toUiEstado(value) {
  return ESTADO_DB_TO_UI[String(value || '').trim()] || String(value || '').trim();
}

function splitTipos(value) {
  return String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function formatDateUi(value) {
  if (!value) return '';
  const d = new Date(value);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function toISODateUi(value) {
  if (!value) return '';
  const d = new Date(value);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getMonthRangeByName(monthName) {
  const idx = MONTH_SHEETS.findIndex(
    (m) => m.toLowerCase() === String(monthName || '').trim().toLowerCase()
  );

  if (idx < 0) return null;

  const year = new Date().getFullYear();
  const start = new Date(year, idx, 1, 0, 0, 0, 0);
  const end = new Date(year, idx + 1, 1, 0, 0, 0, 0);

  return { start, end };
}

function parseLocalDate(value) {
  if (!value) return null;

  const text = String(value).slice(0, 10);
  const parts = text.split('-');
  if (parts.length !== 3) return null;

  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);

  if (!y || !m || !d) return null;

  return new Date(y, m - 1, d, 12, 0, 0);
}

function addMonthsPreserveDay(dateValue, months) {
  const base = new Date(dateValue);
  const targetFirst = new Date(base.getFullYear(), base.getMonth() + months, 1, 12, 0, 0);
  const lastDay = new Date(
    targetFirst.getFullYear(),
    targetFirst.getMonth() + 1,
    0
  ).getDate();
  const safeDay = Math.min(base.getDate(), lastDay);

  return new Date(
    targetFirst.getFullYear(),
    targetFirst.getMonth(),
    safeDay,
    12,
    0,
    0
  );
}

function formatDateForMessage(value) {
  if (!value) return '';
  const d = new Date(value);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function normalizePhoneDigits(raw) {
  let s = String(raw || '').trim().replace(/[^\d]/g, '');
  if (!s) return '';
  if (s.length === 9) s = '51' + s;
  if (s.length < 10) return '';
  return s;
}

function getVentaMontoNeto(venta) {
  const monto = Number(venta?.monto || 0);
  const descuento = Number(venta?.descuento || 0);
  return Math.max(0, monto - descuento);
}

function toIsoDateTime(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function buildClienteData(body) {
  const nombre = cleanText(body.nombre || body.cliente);
  const telefono = normalizePhoneForStorage(body.telefono || body.telefonoCliente);
  const monto = round2(Number(body.monto ?? body.montoCliente ?? body.monto_cliente));
  const carpeta = cleanText(body.carpeta);
  const observacion = cleanText(body.observacion);

  if (!nombre) {
    throw new Error('El nombre del cliente es obligatorio.');
  }

  if (!telefono) {
    throw new Error('El teléfono del cliente es obligatorio.');
  }

  if (!monto || monto <= 0) {
    throw new Error('El monto del cliente debe ser mayor a 0.');
  }

  return {
    nombre,
    telefono,
    monto,
    carpeta,
    observacion: observacion || null,
  };
}

function toCuentaAccesoDto(cuentaAcceso) {
  if (!cuentaAcceso) return null;

  const capacidad = Number(cuentaAcceso.capacidad || 0);
  const used =
    typeof cuentaAcceso.used === 'number'
      ? cuentaAcceso.used
      : Number(cuentaAcceso.used || 0);
  const free = Math.max(0, capacidad - used);
  const occupancyPercent = capacidad ? Math.min(100, Math.round((used / capacidad) * 100)) : 0;
  const alertLevel = occupancyPercent >= 95 ? 'CRITICA' : occupancyPercent >= 80 ? 'ALTA' : 'NORMAL';

  return {
    id: cuentaAcceso.id,
    correo: cuentaAcceso.correo || '',
    capacidad,
    activa: !!cuentaAcceso.activa,
    observacion: cuentaAcceso.observacion || null,
    used,
    free,
    occupancyPercent,
    alertLevel,
    createdAt: toIsoDateTime(cuentaAcceso.createdAt),
    updatedAt: toIsoDateTime(cuentaAcceso.updatedAt),
  };
}

function toClienteDto(cliente) {
  if (!cliente) return null;

  const ventas = Array.isArray(cliente.ventas) ? cliente.ventas : [];
  let ventasActivas = 0;
  let deudaPendiente = 0;
  let ultimoCierre = null;

  for (const venta of ventas) {
    const cierreIso = toIsoDateTime(venta.fechaCierre);

    if (cierreIso && (!ultimoCierre || new Date(cierreIso).getTime() > new Date(ultimoCierre).getTime())) {
      ultimoCierre = cierreIso;
    }

    if (cleanText(venta.estado) !== 'BAJA') {
      ventasActivas++;
    }

    if (isVentaPendiente(venta)) {
      deudaPendiente += getVentaMontoNeto(venta);
    }
  }

  return {
    id: cliente.id,
    nombre: cliente.nombre || '',
    telefono: cliente.telefono || '',
    monto: moneyNumber(cliente.monto),
    carpeta: cliente.carpeta || '',
    observacion: cliente.observacion || null,
    ventasActivas,
    deudaPendiente: round2(deudaPendiente),
    ultimoCierre,
    createdAt: toIsoDateTime(cliente.createdAt),
    updatedAt: toIsoDateTime(cliente.updatedAt),
  };
}

function toVentaDto(venta, no = null) {
  return {
    id: venta.id,
    no: no == null ? undefined : no,
    clienteId: venta.clienteId,
    cuentaAccesoId: venta.cuentaAccesoId ?? null,
    fechaInicio: toIsoDateTime(venta.fechaInicio),
    fechaCierre: toIsoDateTime(venta.fechaCierre),
    fechaPago: toIsoDateTime(venta.fechaPago),
    monto: moneyNumber(venta.monto),
    descuento: moneyNumber(venta.descuento),
    montoPagado: venta.montoPagado == null ? null : moneyNumber(venta.montoPagado),
    estado: cleanText(venta.estado),
    tipoDispositivo: venta.tipoDispositivo || '',
    cantidadDispositivos: Number(venta.cantidadDispositivos || 0),
    observacion: venta.observacion || null,
    createdAt: toIsoDateTime(venta.createdAt),
    updatedAt: toIsoDateTime(venta.updatedAt),
    cliente: toClienteDto(venta.cliente),
    cuentaAcceso: toCuentaAccesoDto(venta.cuentaAcceso),
  };
}

function toUsuarioDto(usuario) {
  if (!usuario) return null;

  return {
    id: usuario.id,
    nombre: usuario.nombre || '',
    correo: usuario.correo || '',
    rol: cleanText(usuario.rol || 'OPERADOR'),
    activo: !!usuario.activo,
    createdAt: toIsoDateTime(usuario.createdAt),
    updatedAt: toIsoDateTime(usuario.updatedAt),
  };
}

function toPagoDto(pago) {
  if (!pago) return null;

  return {
    id: pago.id,
    ventaId: pago.ventaId,
    usuarioId: pago.usuarioId ?? null,
    monto: moneyNumber(pago.monto),
    fechaPago: toIsoDateTime(pago.fechaPago),
    mesesPagados: Number(pago.mesesPagados || 1),
    observacion: pago.observacion || null,
    createdAt: toIsoDateTime(pago.createdAt),
    updatedAt: toIsoDateTime(pago.updatedAt),
    venta: pago.venta ? toVentaDto(pago.venta) : null,
    usuario: pago.usuario ? toUsuarioDto(pago.usuario) : null,
  };
}

function toActividadDto(actividad) {
  if (!actividad) return null;

  return {
    id: actividad.id,
    usuarioId: actividad.usuarioId ?? null,
    accion: actividad.accion || '',
    entidad: actividad.entidad || '',
    entidadId: actividad.entidadId ?? null,
    descripcion: actividad.descripcion || null,
    createdAt: toIsoDateTime(actividad.createdAt),
    usuario: actividad.usuario ? toUsuarioDto(actividad.usuario) : null,
  };
}

function getMonthRangeFromText(value) {
  const text = cleanText(value);

  if (!/^\d{4}-\d{2}$/.test(text)) return null;

  const [yearText, monthText] = text.split('-');
  return getMonthRange(Number(monthText), Number(yearText));
}

function getSingleDayRange(value) {
  const date = parseLocalDate(value);

  if (!date) return null;

  return {
    start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0),
    end: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0),
  };
}

function isVentaPendiente(venta) {
  const estado = cleanText(venta.estado);
  return estado !== 'PAGADO' && estado !== 'BAJA';
}

function compareByFechaCierreAsc(a, b) {
  const timeA = new Date(a.fechaCierre).getTime();
  const timeB = new Date(b.fechaCierre).getTime();

  if (timeA !== timeB) return timeA - timeB;
  return a.id - b.id;
}


async function upsertClienteFromVenta(body, clienteId = null) {
  const clienteData = buildClienteData(body);

  if (clienteId) {
    return prisma.cliente.update({
      where: { id: clienteId },
      data: clienteData,
    });
  }

  const existente = await findClienteByTelefono(clienteData.telefono);

  if (existente) {
    return prisma.cliente.update({
      where: { id: existente.id },
      data: clienteData,
    });
  }

  return prisma.cliente.create({
    data: clienteData,
  });
}

function buildVentaData(body) {
  const fechaInicio = parseLocalDate(body.fechaInicio || body.fecha_inicio);
  const fechaCierre = parseLocalDate(body.fechaCierre || body.fecha_cierre);
  const fechaPago =
    body.fechaPago || body.fecha_pago
      ? parseLocalDate(body.fechaPago || body.fecha_pago)
      : null;

  const monto = round2(Number(body.monto ?? body.montoCliente ?? body.monto_cliente));
  const descuento = round2(Number(body.descuento || 0));
  const estado = toDbEstado(body.estado || 'Pendiente');
  const tiposRaw = body.tipoDispositivo || body.tipo_dispositivo;

  const tipos = Array.isArray(tiposRaw)
    ? tiposRaw.map((v) => cleanText(v)).filter(Boolean)
    : String(tiposRaw || '')
        .split(',')
        .map((v) => cleanText(v))
        .filter(Boolean);

  const tipoDispositivo = tipos.join(', ');
  const cantidadDispositivos = Number(
    body.cantidadDispositivos || body.cantidad_dispositivos
  );
  const observacion = cleanText(body.observacion);

  if (!fechaInicio) throw new Error('fechaInicio es obligatoria.');
  if (!fechaCierre) throw new Error('fechaCierre es obligatoria.');

  if (fechaCierre.getTime() < fechaInicio.getTime()) {
    throw new Error('La fecha de cierre no puede ser menor que la fecha de inicio.');
  }

  if (!monto || monto <= 0) {
    throw new Error('El monto debe ser mayor a 0.');
  }

  if (descuento < 0) {
    throw new Error('El descuento no puede ser negativo.');
  }

  if (descuento > monto) {
    throw new Error('El descuento no puede ser mayor que el monto.');
  }

  if (!tipoDispositivo) {
    throw new Error('tipoDispositivo es obligatorio.');
  }

  if (!cantidadDispositivos || cantidadDispositivos <= 0) {
    throw new Error('cantidadDispositivos debe ser mayor a 0.');
  }

  if (!ESTADOS.includes(estado)) {
    throw new Error('Estado inválido.');
  }

  if (estado === 'PAGADO' && !fechaPago) {
    throw new Error('fechaPago es obligatoria cuando el estado es PAGADO.');
  }

  return {
    fechaInicio,
    fechaCierre,
    fechaPago,
    monto,
    descuento,
    estado,
    tipoDispositivo,
    cantidadDispositivos,
    observacion: observacion || null,
  };
}

function getVentaPeriodoWhere(clienteId, fechaInicio, fechaCierre) {
  return {
    clienteId_fechaInicio_fechaCierre: {
      clienteId,
      fechaInicio,
      fechaCierre,
    },
  };
}

function getFriendlyErrorMessage(error, fallback = 'Ocurrió un error.') {
  if (!error) return fallback;

  if (error.code === 'P2002') {
    const target = Array.isArray(error.meta?.target)
      ? error.meta.target.join(', ')
      : String(error.meta?.target || '');

    if (target.includes('correo')) {
      return 'Ya existe una cuenta con ese correo.';
    }

    if (target.includes('clienteId') && target.includes('fechaInicio') && target.includes('fechaCierre')) {
      return 'Ya existe una venta para ese cliente en ese período.';
    }

    return 'Ya existe un registro duplicado.';
  }

  if (error.code === 'P2025') {
    return 'No se encontró el registro solicitado.';
  }

  if (error.code === 'P2003') {
    return 'No se puede completar la operación por una relación de datos.';
  }

  if (error.message) {
    return error.message;
  }

  return fallback;
}

async function findClienteByTelefono(telefono, excludeId = null) {
  const telefonoNormalizado = normalizeClientPhone(telefono);

  if (!telefonoNormalizado) return null;

  const clientes = await prisma.cliente.findMany({
    select: {
      id: true,
      telefono: true,
    },
  });

  return (
    clientes.find((cliente) => {
      if (excludeId && cliente.id === excludeId) return false;
      return normalizeClientPhone(cliente.telefono) === telefonoNormalizado;
    }) || null
  );
}

const SAFE_VENTA_INCLUDE = {
  cliente: true,
  cuentaAcceso: {
    select: {
      id: true,
      correo: true,
      capacidad: true,
      activa: true,
      observacion: true,
      createdAt: true,
      updatedAt: true,
    },
  },
};

async function getConfigMap() {
  const rows = await prisma.configuracionSistema.findMany();
  const map = {};

  for (const row of rows) {
    map[row.clave] = row.valor || '';
  }

  return map;
}

async function setConfigValue(clave, valor) {
  await prisma.configuracionSistema.upsert({
    where: { clave },
    update: { valor: valor == null ? '' : String(valor) },
    create: { clave, valor: valor == null ? '' : String(valor) },
  });
}

async function getWhatsAppSettings() {
  const cfg = await getConfigMap();

  return {
    enabled: String(cfg.WA_ENABLED || process.env.WA_ENABLED || 'false').toLowerCase() === 'true',
    graphVersion: cfg.WA_GRAPH_VERSION || process.env.WA_GRAPH_VERSION || 'v23.0',
    phoneNumberId: cfg.WA_PHONE_NUMBER_ID || process.env.WA_PHONE_NUMBER_ID || '',
    accessToken: cfg.WA_ACCESS_TOKEN || process.env.WA_ACCESS_TOKEN || '',
    templateName: cfg.WA_TEMPLATE_NAME || process.env.WA_TEMPLATE_NAME || 'gpt_plus_vence_hoy',
    langCode: cfg.WA_LANG_CODE || process.env.WA_LANG_CODE || 'es_PE',
  };
}

async function hasSistemaUsers() {
  const total = await prisma.usuarioSistema.count();
  return total > 0;
}

async function createUserSession(usuario) {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = getSessionExpiryDate();

  await prisma.sesionSistema.create({
    data: {
      usuarioId: usuario.id,
      tokenHash,
      expiresAt,
    },
  });

  return {
    token,
    expiresAt: toIsoDateTime(expiresAt),
  };
}

async function deleteUserSessionByToken(token) {
  if (!cleanText(token)) return;

  await prisma.sesionSistema.deleteMany({
    where: {
      tokenHash: hashToken(token),
    },
  });
}

async function deleteUserSessionsByUserId(usuarioId, keepToken = null) {
  if (!usuarioId) return 0;

  const where = {
    usuarioId,
    ...(keepToken ? { NOT: { tokenHash: hashToken(keepToken) } } : {}),
  };

  const result = await prisma.sesionSistema.deleteMany({ where });
  return result.count || 0;
}

async function getAuthUserFromRequest(req) {
  const authHeader = cleanText(req.headers.authorization);
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null;

  const token = cleanText(authHeader.slice(7));
  if (!token) return null;

  const session = await prisma.sesionSistema.findUnique({
    where: {
      tokenHash: hashToken(token),
    },
    include: {
      usuario: true,
    },
  });

  if (!session) return null;

  if (!session.usuario || !session.usuario.activo) {
    await deleteUserSessionByToken(token);
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await deleteUserSessionByToken(token);
    return null;
  }

  return {
    token,
    session,
    usuario: session.usuario,
  };
}

async function requireAuth(req, res, next) {
  try {
    const auth = await getAuthUserFromRequest(req);

    if (!auth) {
      return res.status(401).json({ error: 'Debes iniciar sesión.' });
    }

    req.authToken = auth.token;
    req.authSession = auth.session;
    req.authUser = auth.usuario;
    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(...roles) {
  const acceptedRoles = roles.map((item) => cleanText(item)).filter(Boolean);

  return async (req, res, next) => {
    await requireAuth(req, res, async (authError) => {
      if (authError) return next(authError);
      if (!acceptedRoles.length) return next();

      const role = cleanText(req.authUser?.rol);
      if (!acceptedRoles.includes(role)) {
        return res.status(403).json({ error: 'No tienes permisos para esta acción.' });
      }

      next();
    });
  };
}

async function buildAuthPayload(usuario) {
  const session = await createUserSession(usuario);

  return {
    token: session.token,
    expiresAt: session.expiresAt,
    user: toUsuarioDto(usuario),
  };
}

async function getActiveSessionCount(usuarioId) {
  return prisma.sesionSistema.count({
    where: {
      usuarioId,
      expiresAt: {
        gt: new Date(),
      },
    },
  });
}

async function buildPagosResumen(limit = 5) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);

  const [pagos, ventasPendientes] = await Promise.all([
    prisma.pago.findMany({
      include: {
        venta: {
          include: {
            cliente: true,
          },
        },
      },
      orderBy: [{ fechaPago: 'desc' }, { id: 'desc' }],
    }),
    prisma.venta.findMany({
      where: {
        estado: {
          in: ['PENDIENTE', 'MENSAJE_ENVIADO'],
        },
      },
      include: {
        cliente: true,
      },
    }),
  ]);

  const topDeudoresMap = {};
  let deudaPendienteTotal = 0;

  for (const venta of ventasPendientes) {
    const clienteId = venta.clienteId;
    const montoNeto = getVentaMontoNeto(venta);
    deudaPendienteTotal += montoNeto;

    if (!topDeudoresMap[clienteId]) {
      topDeudoresMap[clienteId] = {
        clienteId,
        clienteNombre: venta.cliente?.nombre || 'Cliente',
        telefono: venta.cliente?.telefono || null,
        deudaPendiente: 0,
        ventasPendientes: 0,
        ultimoCierre: null,
      };
    }

    topDeudoresMap[clienteId].deudaPendiente += montoNeto;
    topDeudoresMap[clienteId].ventasPendientes += 1;

    const cierreIso = toIsoDateTime(venta.fechaCierre);
    if (
      cierreIso &&
      (!topDeudoresMap[clienteId].ultimoCierre ||
        new Date(cierreIso).getTime() > new Date(topDeudoresMap[clienteId].ultimoCierre).getTime())
    ) {
      topDeudoresMap[clienteId].ultimoCierre = cierreIso;
    }
  }

  const totalCobrado = pagos.reduce((sum, pago) => sum + moneyNumber(pago.monto), 0);
  const cobradoMesActual = pagos
    .filter((pago) => new Date(pago.fechaPago) >= monthStart && new Date(pago.fechaPago) < nextMonthStart)
    .reduce((sum, pago) => sum + moneyNumber(pago.monto), 0);
  const pagosHoy = pagos
    .filter((pago) => new Date(pago.fechaPago) >= todayStart && new Date(pago.fechaPago) < tomorrowStart)
    .reduce((sum, pago) => sum + moneyNumber(pago.monto), 0);
  const totalPagos = pagos.length;

  const topDeudores = Object.values(topDeudoresMap)
    .map((item) => ({
      ...item,
      deudaPendiente: round2(item.deudaPendiente),
    }))
    .sort((a, b) => b.deudaPendiente - a.deudaPendiente || a.clienteNombre.localeCompare(b.clienteNombre))
    .slice(0, Math.max(1, Number(limit) || 5));

  return {
    totalPagos,
    totalCobrado: round2(totalCobrado),
    cobradoMesActual: round2(cobradoMesActual),
    pagosHoy: round2(pagosHoy),
    deudaPendienteTotal: round2(deudaPendienteTotal),
    clientesConDeuda: Object.keys(topDeudoresMap).length,
    ticketPromedio: totalPagos ? round2(totalCobrado / totalPagos) : 0,
    topDeudores,
  };
}

async function registrarActividad({ usuarioId = null, accion, entidad, entidadId = null, descripcion = null }) {
  try {
    await prisma.actividadSistema.create({
      data: {
        usuarioId: usuarioId || null,
        accion: cleanText(accion || 'SIN_ACCION'),
        entidad: cleanText(entidad || 'SISTEMA'),
        entidadId: entidadId || null,
        descripcion: cleanText(descripcion) || null,
      },
    });
  } catch (error) {
    console.error('No se pudo registrar actividad del sistema:', error);
  }
}

async function ensurePagoRegistroParaVenta({ venta, usuarioId, observacion = null }) {
  if (!venta || cleanText(venta.estado) !== 'PAGADO' || !venta.fechaPago) return;

  const totalPagos = await prisma.pago.count({
    where: {
      ventaId: venta.id,
    },
  });

  if (totalPagos > 0) return;

  const monto = round2(Number(venta.montoPagado ?? venta.monto ?? 0));
  if (!monto || monto <= 0) return;

  await prisma.pago.create({
    data: {
      ventaId: venta.id,
      usuarioId: usuarioId || null,
      monto,
      fechaPago: venta.fechaPago,
      mesesPagados: 1,
      observacion: observacion || 'Pago registrado al guardar la venta',
    },
  });
}

function validateWhatsAppSettings(cfg) {
  if (!cfg) return 'No se pudo leer la configuración de WhatsApp.';

  if (!cleanText(cfg.phoneNumberId)) {
    return 'Falta configurar WA_PHONE_NUMBER_ID.';
  }

  if (!cleanText(cfg.accessToken)) {
    return 'Falta configurar WA_ACCESS_TOKEN.';
  }

  if (!cleanText(cfg.templateName)) {
    return 'Falta configurar WA_TEMPLATE_NAME.';
  }

  if (!cleanText(cfg.graphVersion)) {
    return 'Falta configurar WA_GRAPH_VERSION.';
  }

  if (!cleanText(cfg.langCode)) {
    return 'Falta configurar WA_LANG_CODE.';
  }

  return null;
}

async function isWhatsAppEnabled() {
  const cfg = await getWhatsAppSettings();
  return cfg.enabled;
}

async function sendWhatsAppPayload(payload) {
  const cfg = await getWhatsAppSettings();

  const graphVersion = cleanText(cfg.graphVersion || 'v23.0');
  const phoneNumberId = cleanText(cfg.phoneNumberId);
  const accessToken = cleanText(cfg.accessToken);

  if (!phoneNumberId) throw new Error('Falta WA_PHONE_NUMBER_ID');
  if (!accessToken) throw new Error('Falta WA_ACCESS_TOKEN');

  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.message || 'Error enviando WhatsApp');
  }

  return data;
}

async function sendWhatsAppHelloWorld({ toDigits }) {
  return sendWhatsAppPayload({
    messaging_product: 'whatsapp',
    to: toDigits,
    type: 'template',
    template: {
      name: 'hello_world',
      language: { code: 'en_US' },
    },
  });
}

async function sendWhatsAppTemplate({ toDigits, cliente, fechaCierre, monto }) {
  const cfg = await getWhatsAppSettings();

  const templateName = cleanText(cfg.templateName);
  const langCode = cleanText(cfg.langCode || 'es_PE');

  if (!templateName) throw new Error('Falta WA_TEMPLATE_NAME');

  const payload = {
    messaging_product: 'whatsapp',
    to: toDigits,
    type: 'template',
    template: {
      name: templateName,
      language: { code: langCode },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: String(cliente || '') },
            { type: 'text', text: String(fechaCierre || '') },
            { type: 'text', text: String(monto || '') },
          ],
        },
      ],
    },
  };

  return sendWhatsAppPayload(payload);
}

async function registrarHistorialBaja({
  ventaAntes,
  ventaDespues,
  detalle = 'Cliente enviado a baja',
}) {
  if (!ventaAntes || !ventaDespues) return;

  const antes = cleanText(ventaAntes.estado);
  const despues = cleanText(ventaDespues.estado);

  if (antes === 'BAJA') return;
  if (despues !== 'BAJA') return;

  const cliente = await prisma.cliente.findUnique({
    where: { id: ventaDespues.clienteId },
  });

  await prisma.historialBaja.create({
    data: {
      ventaId: ventaDespues.id,
      clienteId: ventaDespues.clienteId,
      clienteNombre: cliente?.nombre || '',
      telefono: cliente?.telefono || null,
      detalle,
    },
  });
}

async function getAccountUsageMap(excludeVentaId = null) {
  const where = {
    cuentaAccesoId: { not: null },
    estado: { not: 'BAJA' },
  };

  if (excludeVentaId) {
    where.id = { not: excludeVentaId };
  }

  const ventas = await prisma.venta.findMany({
    where,
    include: {
      cliente: true,
      cuentaAcceso: true,
    },
    orderBy: { id: 'asc' },
  });

  const raw = {};

  for (const venta of ventas) {
    if (!venta.cuentaAccesoId) continue;

    if (!raw[venta.cuentaAccesoId]) {
      raw[venta.cuentaAccesoId] = new Set();
    }

    raw[venta.cuentaAccesoId].add(venta.clienteId);
  }

  const result = {};
  Object.keys(raw).forEach((id) => {
    result[id] = raw[id].size;
  });

  return result;
}

async function listAccountsWithUsage() {
  const cuentas = await prisma.cuentaAcceso.findMany({
    select: {
      id: true,
      correo: true,
      capacidad: true,
      activa: true,
      observacion: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { id: 'desc' },
  });

  const usageMap = await getAccountUsageMap();

  return cuentas.map((cuenta) =>
    toCuentaAccesoDto({
      ...cuenta,
      used: usageMap[cuenta.id] || 0,
    })
  );
}

function getMonthRange(month, year) {
  const safeMonth = Math.min(12, Math.max(1, Number(month)));
  const safeYear = Math.max(2000, Number(year));

  const start = new Date(safeYear, safeMonth - 1, 1, 0, 0, 0, 0);
  const end = new Date(safeYear, safeMonth, 1, 0, 0, 0, 0);

  return { start, end };
}

function parseDashboardScope(query) {
  const monthRaw = cleanText(query.month);
  const yearRaw = cleanText(query.year);
  const dateFromRaw = cleanText(query.dateFrom);
  const dateToRaw = cleanText(query.dateTo);

  const dateFrom = parseLocalDate(dateFromRaw);
  const dateTo = parseLocalDate(dateToRaw);

  if (dateFrom || dateTo) {
    const start = dateFrom
      ? new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate(), 0, 0, 0, 0)
      : null;
    const end = dateTo
      ? new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate() + 1, 0, 0, 0, 0)
      : null;

    return {
      month: null,
      year: null,
      isGlobal: false,
      mode: 'range',
      start,
      end,
      dateFrom: start ? toIsoDateTime(start) : null,
      dateTo: end ? toIsoDateTime(new Date(end.getTime() - 1000)) : null,
    };
  }

  if (!monthRaw && !yearRaw) {
    return {
      month: null,
      year: null,
      isGlobal: true,
      mode: 'global',
      start: null,
      end: null,
      dateFrom: null,
      dateTo: null,
    };
  }

  const now = new Date();
  const month = Number(monthRaw) || now.getMonth() + 1;
  const year = Number(yearRaw) || now.getFullYear();

  return {
    month: Math.min(12, Math.max(1, month)),
    year: Math.max(2000, year),
    isGlobal: false,
    mode: 'month',
    start: null,
    end: null,
    dateFrom: null,
    dateTo: null,
  };
}

function buildVentasWhereFromQuery(query) {
  const where = {};
  const and = [];
  const search = cleanText(query.search);
  const estadoRaw = cleanText(query.estado);
  const correo = normalizeEmail(query.correo);
  const legacyMonth = cleanText(query.month);
  const legacyYear = cleanText(query.year);
  const mesCierre =
    cleanText(query.mesCierre) ||
    (legacyMonth && legacyYear
      ? `${legacyYear}-${String(legacyMonth).padStart(2, '0')}`
      : '');
  const fechaCierre = cleanText(query.fechaCierre);

  const monthRange = getMonthRangeFromText(mesCierre);
  if (monthRange) {
    and.push({
      fechaCierre: {
        gte: monthRange.start,
        lt: monthRange.end,
      },
    });
  }

  const dayRange = getSingleDayRange(fechaCierre);
  if (dayRange) {
    and.push({
      fechaCierre: {
        gte: dayRange.start,
        lt: dayRange.end,
      },
    });
  }

  if (estadoRaw) {
    const estado = toDbEstado(estadoRaw);
    if (ESTADOS.includes(estado)) {
      and.push({ estado });
    }
  }

  if (correo) {
    and.push({
      cuentaAcceso: {
        is: {
          correo: {
            equals: correo,
            mode: 'insensitive',
          },
        },
      },
    });
  }

  if (search) {
    and.push({
      OR: [
        {
          cliente: {
            is: {
              nombre: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
        {
          cliente: {
            is: {
              telefono: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
        {
          cliente: {
            is: {
              carpeta: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
        {
          cuentaAcceso: {
            is: {
              correo: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
        {
          tipoDispositivo: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          observacion: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ],
    });
  }

  if (and.length) {
    where.AND = and;
  }

  return where;
}

function buildDashboardMetrics({ ventas, cuentas, totalClientes, scope }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let pagadas = 0;
  let pendientes = 0;
  let mensajesEnviados = 0;
  let bajas = 0;
  let vencenHoy = 0;
  let vencidos = 0;
  let montoTotal = 0;
  let descuentoTotal = 0;
  let totalIngresos = 0;

  const porCorreoMap = {};

  for (const cuenta of cuentas) {
    porCorreoMap[cuenta.correo] = {
      correo: cuenta.correo,
      activa: !!cuenta.activa,
      clientes: 0,
      pagados: 0,
      pendientes: 0,
      mensajesEnviados: 0,
      ingresos: 0,
      costoChatGPT: cuenta.activa ? COSTO_CHATGPT_POR_CUENTA : 0,
      neto: 0,
    };
  }

  for (const venta of ventas) {
    const estado = cleanText(venta.estado);
    const monto = moneyNumber(venta.monto);
    const descuento = moneyNumber(venta.descuento);
    const montoNeto = getVentaMontoNeto(venta);
    const correo = cleanText(venta.cuentaAcceso?.correo);

    montoTotal += monto;
    descuentoTotal += descuento;

    if (estado === 'PAGADO') {
      pagadas++;
      totalIngresos += montoNeto;
    } else if (estado === 'PENDIENTE') {
      pendientes++;
    } else if (estado === 'MENSAJE_ENVIADO') {
      mensajesEnviados++;
    } else if (estado === 'BAJA') {
      bajas++;
    }

    const cierre = venta.fechaCierre ? new Date(venta.fechaCierre) : null;
    if (cierre) {
      cierre.setHours(0, 0, 0, 0);

      if (isVentaPendiente(venta)) {
        if (cierre.getTime() === today.getTime()) {
          vencenHoy++;
        } else if (cierre.getTime() < today.getTime()) {
          vencidos++;
        }
      }
    }

    if (correo) {
      if (!porCorreoMap[correo]) {
        porCorreoMap[correo] = {
          correo,
          activa: false,
          clientes: 0,
          pagados: 0,
          pendientes: 0,
          mensajesEnviados: 0,
          ingresos: 0,
          costoChatGPT: 0,
          neto: 0,
        };
      }

      if (estado !== 'BAJA') {
        porCorreoMap[correo].clientes++;
      }

      if (estado === 'PAGADO') {
        porCorreoMap[correo].pagados++;
        porCorreoMap[correo].ingresos += montoNeto;
      } else if (estado === 'PENDIENTE') {
        porCorreoMap[correo].pendientes++;
      } else if (estado === 'MENSAJE_ENVIADO') {
        porCorreoMap[correo].mensajesEnviados++;
      }
    }
  }

  const totalCuentas = cuentas.length;
  const cuentasActivas = cuentas.filter((cuenta) => cuenta.activa).length;
  const costoChatGPT = cuentasActivas * COSTO_CHATGPT_POR_CUENTA;
  const netoOperativo = totalIngresos - costoChatGPT;
  const netoEstimado = montoTotal - descuentoTotal;

  const dueTodayRows = ventas
    .filter((venta) => {
      if (!isVentaPendiente(venta)) return false;

      const cierre = new Date(venta.fechaCierre);
      cierre.setHours(0, 0, 0, 0);

      return cierre.getTime() === today.getTime();
    })
    .sort(compareByFechaCierreAsc)
    .map((venta, index) => toVentaDto(venta, index + 1));

  const overdueRows = ventas
    .filter((venta) => {
      if (!isVentaPendiente(venta)) return false;

      const cierre = new Date(venta.fechaCierre);
      cierre.setHours(0, 0, 0, 0);

      return cierre.getTime() < today.getTime();
    })
    .sort(compareByFechaCierreAsc)
    .map((venta, index) => toVentaDto(venta, index + 1));

  const porCorreo = Object.values(porCorreoMap)
    .map((item) => ({
      ...item,
      ingresos: round2(item.ingresos),
      neto: round2(item.ingresos - item.costoChatGPT),
    }))
    .sort((a, b) => a.correo.localeCompare(b.correo));

  return {
    scope: {
      month: scope.month,
      year: scope.year,
      isGlobal: scope.isGlobal,
      mode: scope.mode,
      dateFrom: scope.dateFrom,
      dateTo: scope.dateTo,
    },
    metricas: {
      totalClientes,
      totalVentas: ventas.length,
      totalCuentas,
      cuentasActivas,
      pagadas,
      pendientes,
      mensajesEnviados,
      bajas,
      vencenHoy,
      vencidos,
      montoTotal: round2(montoTotal),
      descuentoTotal: round2(descuentoTotal),
      netoEstimado: round2(netoEstimado),
    },
    rentabilidad: {
      totalIngresos: round2(totalIngresos),
      costoChatGPT: round2(costoChatGPT),
      netoOperativo: round2(netoOperativo),
      porCorreo,
    },
    dueTodayRows,
    overdueRows,
  };
}

function parsePagination(query) {
  const rawPage = Number(query.page) || 1;
  const rawPageSize = Number(query.pageSize) || 20;

  const page = Math.max(1, rawPage);
  const pageSize = Math.min(100, Math.max(1, rawPageSize));

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

async function buildDashboardData(scope) {
  const ventasWhere = {};

  if (scope.mode === 'range') {
    const fechaCierre = {};

    if (scope.start) {
      fechaCierre.gte = scope.start;
    }

    if (scope.end) {
      fechaCierre.lt = scope.end;
    }

    ventasWhere.fechaCierre = fechaCierre;
  } else if (!scope.isGlobal) {
    const { start, end } = getMonthRange(scope.month, scope.year);
    ventasWhere.fechaCierre = {
      gte: start,
      lt: end,
    };
  }

  const [ventas, cuentas, totalClientesGlobal] = await Promise.all([
    prisma.venta.findMany({
      where: ventasWhere,
      include: SAFE_VENTA_INCLUDE,
      orderBy: [
        { fechaCierre: 'asc' },
        { id: 'asc' },
      ],
    }),
    prisma.cuentaAcceso.findMany({
      orderBy: { correo: 'asc' },
    }),
    prisma.cliente.count(),
  ]);

  const totalClientes = scope.isGlobal
    ? totalClientesGlobal
    : new Set(ventas.map((venta) => venta.clienteId)).size;

  return buildDashboardMetrics({
    ventas,
    cuentas,
    totalClientes,
    scope,
  });
}

function pickBestAvailableAccount(cuentas, usageMap) {
  const disponibles = cuentas
    .filter((c) => c.activa)
    .filter((c) => (usageMap[c.id] || 0) < c.capacidad)
    .sort((a, b) => {
      const ua = usageMap[a.id] || 0;
      const ub = usageMap[b.id] || 0;

      if (ua !== ub) return ua - ub;
      return a.correo.localeCompare(b.correo);
    });

  return disponibles[0] || null;
}

async function resolveAssignedAccount({
  assignmentMode,
  cuentaAccesoId,
  currentVentaId = null,
  previousAccountId = null,
}) {
  const cuentas = await prisma.cuentaAcceso.findMany({
    orderBy: { id: 'desc' },
  });

  const usageMap = await getAccountUsageMap(currentVentaId);

  if (assignmentMode === 'manual') {
    const selectedId = Number(cuentaAccesoId);
    if (!selectedId) {
      throw new Error('Selecciona una cuenta manual.');
    }

    const cuenta = cuentas.find((c) => c.id === selectedId);

    if (!cuenta || !cuenta.activa) {
      throw new Error('La cuenta manual no está disponible.');
    }

    const used = usageMap[cuenta.id] || 0;
    if (used >= cuenta.capacidad) {
      throw new Error('La cuenta manual ya alcanzó su capacidad.');
    }

    return cuenta.id;
  }

  if (previousAccountId) {
    const prev = cuentas.find((c) => c.id === previousAccountId);

    if (prev && prev.activa) {
      const used = usageMap[prev.id] || 0;
      if (used < prev.capacidad) {
        return prev.id;
      }
    }
  }

  const best = pickBestAvailableAccount(cuentas, usageMap);

  if (!best) {
    throw new Error('No hay cuentas activas disponibles para asignación automática.');
  }

  return best.id;
}

async function releaseOrReassignVentasFromDeletedAccount(accountId) {
  await prisma.venta.updateMany({
    where: {
      cuentaAccesoId: accountId,
      estado: 'BAJA',
    },
    data: {
      cuentaAccesoId: null,
    },
  });

  const ventasActivas = await prisma.venta.findMany({
    where: {
      cuentaAccesoId: accountId,
      estado: { not: 'BAJA' },
    },
    orderBy: { id: 'asc' },
  });

  if (!ventasActivas.length) return;

  const cuentasDisponibles = await prisma.cuentaAcceso.findMany({
    where: {
      activa: true,
      id: { not: accountId },
    },
    orderBy: { id: 'desc' },
  });

  if (!cuentasDisponibles.length) {
    throw new Error(
      'No hay otra cuenta activa disponible para reasignar las ventas.'
    );
  }

  for (const venta of ventasActivas) {
    const usageMap = await getAccountUsageMap(venta.id);
    const best = pickBestAvailableAccount(cuentasDisponibles, usageMap);

    if (!best) {
      throw new Error(
        'No hay capacidad suficiente en otras cuentas activas para reasignar las ventas.'
      );
    }

    await prisma.venta.update({
      where: { id: venta.id },
      data: {
        cuentaAccesoId: best.id,
      },
    });
  }
}

async function upsertVentaPagadaEnPeriodo({
  ventaBase,
  monthOffset,
  fechaPago,
  montoMensual,
}) {
  const fechaInicio = addMonthsPreserveDay(ventaBase.fechaInicio, monthOffset);
  const fechaCierre = addMonthsPreserveDay(ventaBase.fechaCierre, monthOffset);

  return prisma.venta.upsert({
    where: getVentaPeriodoWhere(ventaBase.clienteId, fechaInicio, fechaCierre),
    update: {
      cuentaAccesoId: ventaBase.cuentaAccesoId || null,
      fechaPago,
      monto: montoMensual,
      montoPagado: montoMensual,
      descuento: ventaBase.descuento,
      estado: 'PAGADO',
      tipoDispositivo: ventaBase.tipoDispositivo,
      cantidadDispositivos: ventaBase.cantidadDispositivos,
      observacion: ventaBase.observacion || null,
    },
    create: {
      clienteId: ventaBase.clienteId,
      cuentaAccesoId: ventaBase.cuentaAccesoId || null,
      fechaInicio,
      fechaCierre,
      fechaPago,
      monto: montoMensual,
      montoPagado: montoMensual,
      descuento: ventaBase.descuento,
      estado: 'PAGADO',
      tipoDispositivo: ventaBase.tipoDispositivo,
      cantidadDispositivos: ventaBase.cantidadDispositivos,
      observacion: ventaBase.observacion || null,
    },
  });
}

async function ensureVentaPendienteSiguiente({
  ventaBase,
  monthOffset,
  montoMensual,
}) {
  const fechaInicio = addMonthsPreserveDay(ventaBase.fechaInicio, monthOffset);
  const fechaCierre = addMonthsPreserveDay(ventaBase.fechaCierre, monthOffset);

  const where = getVentaPeriodoWhere(ventaBase.clienteId, fechaInicio, fechaCierre);
  const existente = await prisma.venta.findUnique({ where });

  if (existente) return existente;

  return prisma.venta.create({
    data: {
      clienteId: ventaBase.clienteId,
      cuentaAccesoId: ventaBase.cuentaAccesoId || null,
      fechaInicio,
      fechaCierre,
      fechaPago: null,
      monto: montoMensual,
      descuento: ventaBase.descuento,
      montoPagado: null,
      estado: 'PENDIENTE',
      tipoDispositivo: ventaBase.tipoDispositivo,
      cantidadDispositivos: ventaBase.cantidadDispositivos,
      observacion: ventaBase.observacion || null,
    },
  });
}

app.get('/', (req, res) => {
  res.json({ ok: true, proyecto: 'SistemaVentasGPT' });
});

app.get('/health', async (req, res) => {
  try {
    const setupRequired = !(await hasSistemaUsers());
    res.json({
      ok: true,
      dbOk: true,
      setupRequired,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);
    res.json({
      ok: false,
      dbOk: false,
      setupRequired: null,
      serverTime: new Date().toISOString(),
      error: getFriendlyErrorMessage(error, 'No se pudo verificar el estado del backend.'),
    });
  }
});

app.get('/auth/status', async (req, res) => {
  try {
    res.json({
      setupRequired: !(await hasSistemaUsers()),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al verificar el estado de autenticación.' });
  }
});

app.post('/auth/bootstrap', async (req, res) => {
  try {
    if (await hasSistemaUsers()) {
      return res.status(400).json({ error: 'La cuenta inicial ya fue creada.' });
    }

    const nombre = cleanText(req.body.nombre);
    const correo = normalizeEmail(req.body.correo);
    const password = cleanText(req.body.password);

    if (!nombre || !correo || !password) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios.' });
    }

    const usuario = await prisma.usuarioSistema.create({
      data: {
        nombre,
        correo,
        passwordHash: await bcrypt.hash(password, 10),
        rol: 'ADMIN',
        activo: true,
      },
    });

    await registrarActividad({
      usuarioId: usuario.id,
      accion: 'BOOTSTRAP_ADMIN',
      entidad: 'USUARIO_SISTEMA',
      entidadId: usuario.id,
      descripcion: `Administrador inicial creado: ${usuario.correo}`,
    });

    await registrarActividad({
      usuarioId: usuario.id,
      accion: 'AUTO_LOGIN',
      entidad: 'SESION',
      descripcion: `Inicio de sesión automático tras configuración: ${usuario.correo}`,
    });

    res.json(await buildAuthPayload(usuario));
  } catch (error) {
    console.error(error);
    res.status(400).json({
      error: getFriendlyErrorMessage(error, 'Error al crear el usuario administrador inicial.'),
    });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const correo = normalizeEmail(req.body.correo);
    const password = cleanText(req.body.password);
    const attemptKey = getLoginAttemptKey(req, correo);
    const blockedMs = getLoginThrottleMs(attemptKey);

    if (blockedMs > 0) {
      return res.status(429).json({
        error: `Demasiados intentos de inicio de sesión. Intenta nuevamente en ${Math.ceil(blockedMs / 60000)} minuto(s).`,
      });
    }

    if (!correo || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
    }

    const usuario = await prisma.usuarioSistema.findUnique({
      where: { correo },
    });

    if (!usuario || !usuario.activo) {
      registerFailedLoginAttempt(attemptKey);
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const passwordOk = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordOk) {
      registerFailedLoginAttempt(attemptKey);
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    clearLoginAttempts(attemptKey);

    await registrarActividad({
      usuarioId: usuario.id,
      accion: 'LOGIN',
      entidad: 'SESION',
      descripcion: `Inicio de sesión: ${usuario.correo}`,
    });

    res.json(await buildAuthPayload(usuario));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
});

app.get('/auth/me', requireAuth, async (req, res) => {
  res.json({
    user: toUsuarioDto(req.authUser),
  });
});

app.post('/auth/logout', requireAuth, async (req, res) => {
  try {
    await registrarActividad({
      usuarioId: req.authUser?.id,
      accion: 'LOGOUT',
      entidad: 'SESION',
      descripcion: `Cierre de sesión: ${req.authUser?.correo || '-'}`,
    });
    await deleteUserSessionByToken(req.authToken);
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cerrar sesión.' });
  }
});

app.get('/auth/security', requireAuth, async (req, res) => {
  try {
    const activeSessions = await getActiveSessionCount(req.authUser.id);

    res.json({
      activeSessions,
      currentSessionExpiresAt: toIsoDateTime(req.authSession?.expiresAt),
      sessionDurationDays: SESSION_DURATION_DAYS,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar la seguridad de la cuenta.' });
  }
});

app.post('/auth/change-password', requireAuth, async (req, res) => {
  try {
    const currentPassword = cleanText(req.body.currentPassword);
    const newPassword = cleanText(req.body.newPassword);
    const logoutOthers = req.body.logoutOthers !== false;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Debes ingresar la contraseña actual y la nueva.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }

    const passwordOk = await bcrypt.compare(currentPassword, req.authUser.passwordHash);
    if (!passwordOk) {
      return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'La nueva contraseña debe ser diferente a la actual.' });
    }

    await prisma.usuarioSistema.update({
      where: { id: req.authUser.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 10),
      },
    });

    const closedSessions = logoutOthers
      ? await deleteUserSessionsByUserId(req.authUser.id, req.authToken)
      : 0;

    await registrarActividad({
      usuarioId: req.authUser.id,
      accion: 'CAMBIAR_PASSWORD',
      entidad: 'USUARIO_SISTEMA',
      entidadId: req.authUser.id,
      descripcion: `Contraseña actualizada. Otras sesiones cerradas: ${closedSessions}`,
    });

    res.json({
      ok: true,
      closedSessions,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cambiar la contraseña.' });
  }
});

app.post('/auth/logout-all', requireAuth, async (req, res) => {
  try {
    const closedSessions = await deleteUserSessionsByUserId(req.authUser.id, req.authToken);

    await registrarActividad({
      usuarioId: req.authUser.id,
      accion: 'LOGOUT_ALL',
      entidad: 'SESION',
      descripcion: `Se cerraron ${closedSessions} sesión(es) adicionales.`,
    });

    res.json({
      ok: true,
      closedSessions,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cerrar las demás sesiones.' });
  }
});

app.get('/usuarios', requireRole('ADMIN'), async (req, res) => {
  try {
    const usuarios = await prisma.usuarioSistema.findMany({
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    });

    res.json(usuarios.map(toUsuarioDto));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar usuarios.' });
  }
});

app.post('/usuarios', requireRole('ADMIN'), async (req, res) => {
  try {
    const nombre = cleanText(req.body.nombre);
    const correo = normalizeEmail(req.body.correo);
    const password = cleanText(req.body.password);
    const rol = normalizeUserRole(req.body.rol);
    const activo = parseBoolean(req.body.activo ?? true);

    if (!nombre || !correo || !password) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios.' });
    }

    const usuario = await prisma.usuarioSistema.create({
      data: {
        nombre,
        correo,
        passwordHash: await bcrypt.hash(password, 10),
        rol,
        activo,
      },
    });

    await registrarActividad({
      usuarioId: req.authUser?.id,
      accion: 'CREAR',
      entidad: 'USUARIO_SISTEMA',
      entidadId: usuario.id,
      descripcion: `Usuario creado: ${usuario.correo} (${usuario.rol})`,
    });

    res.json(toUsuarioDto(usuario));
  } catch (error) {
    console.error(error);
    res.status(400).json({
      error: getFriendlyErrorMessage(error, 'Error al crear usuario.'),
    });
  }
});

app.put('/usuarios/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    const actual = await prisma.usuarioSistema.findUnique({
      where: { id },
    });

    if (!actual) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const nombre = cleanText(req.body.nombre || actual.nombre);
    const correo = normalizeEmail(req.body.correo || actual.correo);
    const password = cleanText(req.body.password);
    const rol = normalizeUserRole(req.body.rol || actual.rol);
    const activo =
      req.body.activo == null ? !!actual.activo : parseBoolean(req.body.activo);

    if (!nombre || !correo) {
      return res.status(400).json({ error: 'Nombre y correo son obligatorios.' });
    }

    const data = {
      nombre,
      correo,
      rol,
      activo,
      passwordHash: password ? await bcrypt.hash(password, 10) : actual.passwordHash,
    };

    const usuario = await prisma.usuarioSistema.update({
      where: { id },
      data,
    });

    await registrarActividad({
      usuarioId: req.authUser?.id,
      accion: 'ACTUALIZAR',
      entidad: 'USUARIO_SISTEMA',
      entidadId: usuario.id,
      descripcion: `Usuario actualizado: ${usuario.correo} (${usuario.rol})`,
    });

    res.json(toUsuarioDto(usuario));
  } catch (error) {
    console.error(error);
    res.status(400).json({
      error: getFriendlyErrorMessage(error, 'Error al actualizar usuario.'),
    });
  }
});

app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const scope = parseDashboardScope(req.query);
    const data = await buildDashboardData(scope);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cargar dashboard.' });
  }
});

/* =========================
   CONFIGURACIÓN
========================= */

app.get('/config/whatsapp', requireRole('ADMIN'), async (req, res) => {
  try {
    const cfg = await getWhatsAppSettings();

    res.json({
      enabled: cfg.enabled,
      graphVersion: cfg.graphVersion,
      phoneNumberId: cfg.phoneNumberId,
      templateName: cfg.templateName,
      langCode: cfg.langCode,
      hasToken: !!cfg.accessToken,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cargar configuración de WhatsApp.' });
  }
});

app.put('/config/whatsapp', requireRole('ADMIN'), async (req, res) => {
  try {
    await setConfigValue('WA_GRAPH_VERSION', cleanText(req.body.graphVersion || 'v23.0'));
    await setConfigValue('WA_PHONE_NUMBER_ID', cleanText(req.body.phoneNumberId || ''));
    await setConfigValue(
      'WA_TEMPLATE_NAME',
      cleanText(req.body.templateName || 'gpt_plus_vence_hoy')
    );
    await setConfigValue('WA_LANG_CODE', cleanText(req.body.langCode || 'es_PE'));

    if (cleanText(req.body.accessToken)) {
      await setConfigValue('WA_ACCESS_TOKEN', cleanText(req.body.accessToken));
    }

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al guardar configuración de WhatsApp.' });
  }
});

app.put('/config/whatsapp/enabled', requireRole('ADMIN'), async (req, res) => {
  try {
    await setConfigValue('WA_ENABLED', req.body.enabled ? 'true' : 'false');
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cambiar estado de WhatsApp.' });
  }
});

/* =========================
   HISTORIAL DE BAJA
========================= */

app.get('/historial-bajas', requireAuth, async (req, res) => {
  try {
    const rows = await prisma.historialBaja.findMany({
      orderBy: { fechaBaja: 'desc' },
    });

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar historial de baja.' });
  }
});

/* =========================
   CLIENTES
========================= */

app.get('/clientes', requireAuth, async (req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({
      include: {
        ventas: {
          select: {
            estado: true,
            monto: true,
            descuento: true,
            fechaCierre: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    res.json(clientes.map(toClienteDto));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar clientes.' });
  }
});

app.post('/clientes', requireAuth, async (req, res) => {
  try {
    const clienteData = buildClienteData(req.body);

    const existente = await findClienteByTelefono(clienteData.telefono);

    if (existente) {
      return res.status(400).json({
        error: 'Ya existe un cliente con ese teléfono.',
      });
    }

    const cliente = await prisma.cliente.create({
      data: clienteData,
    });

    await registrarActividad({
      usuarioId: req.authUser?.id,
      accion: 'CREAR',
      entidad: 'CLIENTE',
      entidadId: cliente.id,
      descripcion: `Cliente creado: ${cliente.nombre}`,
    });

    res.json(toClienteDto(cliente));
    } catch (error) {
      console.error(error);
      res.status(400).json({
        error: getFriendlyErrorMessage(error, 'Error al crear cliente.'),
      });
    }
});


app.put('/clientes/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    const clienteData = buildClienteData(req.body);

    const existente = await findClienteByTelefono(clienteData.telefono, id);

    if (existente) {
      return res.status(400).json({
        error: 'Ya existe otro cliente con ese teléfono.',
      });
    }

    const cliente = await prisma.cliente.update({
      where: { id },
      data: clienteData,
    });

    await registrarActividad({
      usuarioId: req.authUser?.id,
      accion: 'ACTUALIZAR',
      entidad: 'CLIENTE',
      entidadId: cliente.id,
      descripcion: `Cliente actualizado: ${cliente.nombre}`,
    });

    res.json(toClienteDto(cliente));
    } catch (error) {
      console.error(error);
      res.status(400).json({
        error: getFriendlyErrorMessage(error, 'Error al actualizar cliente.'),
      });
    }
});


app.delete('/clientes/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    const cliente = await prisma.cliente.findUnique({
      where: { id },
    });

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }

    await prisma.$transaction([
      prisma.venta.deleteMany({ where: { clienteId: id } }),
      prisma.cliente.delete({ where: { id } }),
    ]);

    await registrarActividad({
      usuarioId: req.authUser?.id,
      accion: 'ELIMINAR',
      entidad: 'CLIENTE',
      entidadId: id,
      descripcion: `Cliente eliminado: ${cliente.nombre}`,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar cliente.' });
  }
});

/* =========================
   CUENTAS
========================= */

app.get('/cuentas', requireAuth, async (req, res) => {
  try {
    const cuentas = await listAccountsWithUsage();
    res.json(cuentas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar cuentas.' });
  }
});

app.post('/cuentas', requireRole('ADMIN'), async (req, res) => {
  try {
    const correo = normalizeEmail(req.body.correo);
    const password = cleanText(req.body.password);
    const capacidad = Math.max(1, Number(req.body.capacidad) || 1);
    const activa = parseBoolean(req.body.activa);
    const observacion = cleanText(req.body.observacion);

    if (!correo) {
      return res.status(400).json({ error: 'El correo es obligatorio.' });
    }

    if (!password) {
      return res.status(400).json({ error: 'La contraseña es obligatoria.' });
    }

    const existente = await prisma.cuentaAcceso.findFirst({
      where: { correo },
    });

    if (existente) {
      return res.status(400).json({
        error: 'Ya existe una cuenta con ese correo.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const cuentaCreada = await prisma.cuentaAcceso.create({
      data: {
        correo,
        password: passwordHash,
        capacidad,
        activa,
        observacion: observacion || null,
      },
    });

    await registrarActividad({
      usuarioId: req.authUser?.id,
      accion: 'CREAR',
      entidad: 'CUENTA',
      entidadId: cuentaCreada.id,
      descripcion: `Cuenta creada: ${cuentaCreada.correo}`,
    });

    res.json({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(400).json({
        error: getFriendlyErrorMessage(error, 'Error al crear cuenta.'),
      });
    }
});

app.put('/cuentas/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const correo = normalizeEmail(req.body.correo);
    const password = cleanText(req.body.password);
    const capacidad = Math.max(1, Number(req.body.capacidad) || 1);
    const activa = parseBoolean(req.body.activa);
    const observacion = cleanText(req.body.observacion);

    if (!id) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    if (!correo) {
      return res.status(400).json({ error: 'El correo es obligatorio.' });
    }

    const actual = await prisma.cuentaAcceso.findUnique({
      where: { id },
    });

    if (!actual) {
      return res.status(404).json({ error: 'Cuenta no encontrada.' });
    }

    const existente = await prisma.cuentaAcceso.findFirst({
      where: {
        correo,
        NOT: { id },
      },
    });

    if (existente) {
      return res.status(400).json({
        error: 'Ya existe otra cuenta con ese correo.',
      });
    }

    const passwordHash = password
      ? await bcrypt.hash(password, 10)
      : actual.password;

    const cuentaActualizada = await prisma.cuentaAcceso.update({
      where: { id },
      data: {
        correo,
        password: passwordHash,
        capacidad,
        activa,
        observacion: observacion || null,
      },
    });

    await registrarActividad({
      usuarioId: req.authUser?.id,
      accion: 'ACTUALIZAR',
      entidad: 'CUENTA',
      entidadId: cuentaActualizada.id,
      descripcion: `Cuenta actualizada: ${cuentaActualizada.correo}`,
    });

    res.json({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(400).json({
        error: getFriendlyErrorMessage(error, 'Error al actualizar cuenta.'),
      });
    }
});

app.delete('/cuentas/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    const cuenta = await prisma.cuentaAcceso.findUnique({
      where: { id },
    });

    if (!cuenta) {
      return res.status(404).json({ error: 'Cuenta no encontrada.' });
    }

    await releaseOrReassignVentasFromDeletedAccount(id);

    await prisma.cuentaAcceso.delete({
      where: { id },
    });

    await registrarActividad({
      usuarioId: req.authUser?.id,
      accion: 'ELIMINAR',
      entidad: 'CUENTA',
      entidadId: id,
      descripcion: `Cuenta eliminada: ${cuenta.correo}`,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(400).json({
      error: error.message || 'Error al eliminar cuenta.',
    });
  }
});

/* =========================
   VENTAS
========================= */

app.get('/ventas', requireAuth, async (req, res) => {
  try {
    const where = buildVentasWhereFromQuery(req.query);
    const { page, pageSize, skip, take } = parsePagination(req.query);

    const [ventas, total] = await Promise.all([
      prisma.venta.findMany({
        where,
        include: SAFE_VENTA_INCLUDE,
        orderBy: [
          { fechaInicio: 'desc' },
          { id: 'desc' },
        ],
        skip,
        take,
      }),
      prisma.venta.count({ where }),
    ]);

    res.json({
      items: ventas.map((venta, index) => toVentaDto(venta, skip + index + 1)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: getFriendlyErrorMessage(error, 'Error al listar ventas.'),
    });
  }
});

app.post('/ventas', requireAuth, async (req, res) => {
  try {
    const baseData = buildVentaData(req.body);
    const assignmentMode = cleanText(req.body.assignmentMode || 'auto');

    const cliente = await upsertClienteFromVenta(req.body);

    const ventaExistente = await prisma.venta.findUnique({
      where: getVentaPeriodoWhere(
        cliente.id,
        baseData.fechaInicio,
        baseData.fechaCierre
      ),
        include: SAFE_VENTA_INCLUDE,
    });

    if (ventaExistente) {
      return res.status(400).json({
        error: 'Ya existe una venta para este cliente en ese mismo período.',
      });
    }

    const cuentaAccesoId = await resolveAssignedAccount({
      assignmentMode,
      cuentaAccesoId: req.body.cuentaAccesoId,
    });

    const venta = await prisma.venta.create({
      data: {
        ...baseData,
        clienteId: cliente.id,
        cuentaAccesoId,
      },
      include: SAFE_VENTA_INCLUDE,
    });

    await ensurePagoRegistroParaVenta({
      venta,
      usuarioId: req.authUser?.id,
    });

    await registrarActividad({
      usuarioId: req.authUser?.id,
      accion: 'CREAR',
      entidad: 'VENTA',
      entidadId: venta.id,
      descripcion: `Venta creada para ${venta.cliente?.nombre || 'cliente'} (${venta.estado})`,
    });

    res.json(toVentaDto(venta));
    } catch (error) {
      console.error(error);
      res.status(400).json({
        error: getFriendlyErrorMessage(error, 'Error al crear venta.'),
      });
    }
});

app.put('/ventas/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    const actual = await prisma.venta.findUnique({
      where: { id },
    });

    if (!actual) {
      return res.status(404).json({ error: 'Venta no encontrada.' });
    }

    await upsertClienteFromVenta(req.body, actual.clienteId);

    const baseData = buildVentaData(req.body);
    const assignmentMode = cleanText(req.body.assignmentMode || 'auto');

    const cuentaAccesoId = await resolveAssignedAccount({
      assignmentMode,
      cuentaAccesoId: req.body.cuentaAccesoId,
      currentVentaId: id,
      previousAccountId: actual.cuentaAccesoId,
    });

    const venta = await prisma.venta.update({
      where: { id },
      data: {
        ...baseData,
        cuentaAccesoId,
      },
        include: SAFE_VENTA_INCLUDE,
    });

    await registrarHistorialBaja({
      ventaAntes: actual,
      ventaDespues: venta,
    });

    await ensurePagoRegistroParaVenta({
      venta,
      usuarioId: req.authUser?.id,
    });

    await registrarActividad({
      usuarioId: req.authUser?.id,
      accion: 'ACTUALIZAR',
      entidad: 'VENTA',
      entidadId: venta.id,
      descripcion: `Venta actualizada para ${venta.cliente?.nombre || 'cliente'} (${venta.estado})`,
    });

    res.json(toVentaDto(venta));
    } catch (error) {
      console.error(error);
      res.status(400).json({
        error: getFriendlyErrorMessage(error, 'Error al actualizar venta.'),
      });
    }
});

app.post('/ventas/:id/pagar', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const fechaPago = parseLocalDate(req.body.fechaPago);
    const mesesPagados = Math.min(2, Math.max(1, Number(req.body.mesesPagados) || 1));
    const montoPagado = round2(Number(req.body.montoPagado || 0));

    if (!id) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    if (!fechaPago) {
      return res.status(400).json({ error: 'La fecha de pago es obligatoria.' });
    }

    if (!montoPagado || montoPagado <= 0) {
      return res.status(400).json({ error: 'El monto pagado es obligatorio.' });
    }

    const actual = await prisma.venta.findUnique({
      where: { id },
      include: SAFE_VENTA_INCLUDE,
    });

    if (!actual) {
      return res.status(404).json({ error: 'Venta no encontrada.' });
    }

    const montoMensual = round2(Number(actual.cliente?.monto || actual.monto || 0));

    if (!montoMensual || montoMensual <= 0) {
      return res.status(400).json({
        error: 'El cliente no tiene un monto fijo válido para registrar el pago.',
      });
    }

    const venta = await prisma.$transaction(async (tx) => {
      const ventaActualizada = await tx.venta.update({
        where: { id },
        data: {
          estado: 'PAGADO',
          fechaPago,
          monto: montoMensual,
          montoPagado,
        },
        include: SAFE_VENTA_INCLUDE,
      });

      await tx.pago.create({
        data: {
          ventaId: id,
          usuarioId: req.authUser?.id || null,
          monto: montoPagado,
          fechaPago,
          mesesPagados,
          observacion:
            mesesPagados > 1
              ? `Pago manual de ${mesesPagados} meses`
              : 'Pago manual de 1 mes',
        },
      });

      return ventaActualizada;
    });

    for (let offset = 1; offset < mesesPagados; offset += 1) {
      await upsertVentaPagadaEnPeriodo({
        ventaBase: actual,
        monthOffset: offset,
        fechaPago,
        montoMensual,
      });
    }

    await ensureVentaPendienteSiguiente({
      ventaBase: actual,
      monthOffset: mesesPagados,
      montoMensual,
    });

    await registrarActividad({
      usuarioId: req.authUser?.id,
      accion: 'PAGO',
      entidad: 'VENTA',
      entidadId: venta.id,
      descripcion: `Pago registrado para ${actual.cliente?.nombre || 'cliente'} por ${montoPagado.toFixed(2)}`,
    });

    res.json(toVentaDto(venta));
    } catch (error) {
      console.error(error);
      res.status(400).json({
        error: getFriendlyErrorMessage(error, 'Error al registrar pago.'),
      });
    }
});

app.delete('/ventas/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    const venta = await prisma.venta.findUnique({
      where: { id },
      include: SAFE_VENTA_INCLUDE,
    });

    if (!venta) {
      return res.status(404).json({ error: 'Venta no encontrada.' });
    }

    await prisma.venta.delete({
      where: { id },
    });

    await registrarActividad({
      usuarioId: req.authUser?.id,
      accion: 'ELIMINAR',
      entidad: 'VENTA',
      entidadId: id,
      descripcion: `Venta eliminada de ${venta.cliente?.nombre || 'cliente'}`,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar venta.' });
  }
});

app.get('/pagos', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

    const pagos = await prisma.pago.findMany({
      take: limit,
      orderBy: [{ fechaPago: 'desc' }, { id: 'desc' }],
      include: {
        venta: {
          include: SAFE_VENTA_INCLUDE,
        },
        usuario: true,
      },
    });

    res.json(pagos.map(toPagoDto));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar pagos.' });
  }
});

app.get('/pagos/resumen', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(20, Math.max(3, Number(req.query.limit) || 5));
    res.json(await buildPagosResumen(limit));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cargar el resumen de pagos.' });
  }
});

app.get('/actividad', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

    const rows = await prisma.actividadSistema.findMany({
      take: limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        usuario: true,
      },
    });

    res.json(rows.map(toActividadDto));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar actividad del sistema.' });
  }
});

app.post('/whatsapp/test', requireRole('ADMIN'), async (req, res) => {
  try {
    const toDigits = normalizePhoneDigits(req.body.to);
    const mode = cleanText(req.body.mode || 'configured');
    const cliente = cleanText(req.body.cliente || 'Cliente de prueba');
    const fechaCierre = cleanText(req.body.fechaCierre || formatDateForMessage(new Date()));
    const monto = cleanText(req.body.monto || '0.00');
    const waConfig = await getWhatsAppSettings();

    if (!toDigits) {
      return res.status(400).json({ error: 'Ingresa un número de destino válido.' });
    }

    const result =
      mode === 'hello_world'
        ? await sendWhatsAppHelloWorld({ toDigits })
        : await sendWhatsAppTemplate({ toDigits, cliente, fechaCierre, monto });

    await prisma.whatsAppLog.create({
      data: {
        clienteNombre: cliente,
        telefono: toDigits,
        fechaObjetivo: new Date(),
        estado: 'PRUEBA',
        detalle:
          mode === 'hello_world'
            ? 'Prueba hello_world enviada correctamente'
            : 'Prueba con plantilla configurada enviada correctamente',
        },
      });

    await registrarActividad({
      usuarioId: req.authUser?.id,
      accion: 'WHATSAPP_PRUEBA',
      entidad: 'WHATSAPP',
      descripcion:
        mode === 'hello_world'
          ? `Prueba hello_world enviada a ${toDigits}`
          : `Prueba de plantilla enviada a ${toDigits}`,
    });

    res.json({
      ok: true,
      mode,
      to: toDigits,
      templateName: mode === 'hello_world' ? 'hello_world' : waConfig.templateName,
      langCode: mode === 'hello_world' ? 'en_US' : waConfig.langCode,
      phoneNumberId: waConfig.phoneNumberId,
      messageId: result?.messages?.[0]?.id || null,
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({
      error: getFriendlyErrorMessage(error, 'Error enviando la prueba de WhatsApp.'),
    });
  }
});

app.post('/whatsapp/send-due-today', requireRole('ADMIN'), async (req, res) => {
  try {
    const waEnabled = await isWhatsAppEnabled();

    if (!waEnabled) {
      return res.json({
        ok: true,
        sent: 0,
        skipped: 0,
        errors: 0,
        message: 'WhatsApp está desactivado.',
      });
    }

    const waConfig = await getWhatsAppSettings();
    const waConfigError = validateWhatsAppSettings(waConfig);

    if (waConfigError) {
      return res.status(400).json({
        error: waConfigError,
      });
    }

    const ventas = await prisma.venta.findMany({
      where: {
        estado: 'PENDIENTE',
      },
      include: {
        cliente: true,
      },
      orderBy: { id: 'asc' },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const venta of ventas) {
      const cierre = new Date(venta.fechaCierre);
      cierre.setHours(0, 0, 0, 0);

      if (cierre.getTime() !== today.getTime()) {
        skipped++;
        continue;
      }

      const clienteNombre = cleanText(venta.cliente?.nombre);
      const telefonoOriginal = cleanText(venta.cliente?.telefono);
      const phoneDigits = normalizePhoneDigits(telefonoOriginal);
      const montoTexto = Number(venta.monto || 0).toFixed(2);

      if (!clienteNombre) {
        errors++;
        await prisma.whatsAppLog.create({
          data: {
            ventaId: venta.id,
            clienteNombre: null,
            telefono: telefonoOriginal || null,
            fechaObjetivo: venta.fechaCierre,
            estado: 'ERROR',
            detalle: 'Cliente sin nombre válido',
          },
        });
        continue;
      }

      if (!phoneDigits) {
        errors++;
        await prisma.whatsAppLog.create({
          data: {
            ventaId: venta.id,
            clienteNombre: clienteNombre || null,
            telefono: telefonoOriginal || null,
            fechaObjetivo: venta.fechaCierre,
            estado: 'ERROR',
            detalle: 'Teléfono inválido',
          },
        });
        continue;
      }

      try {
        await sendWhatsAppTemplate({
          toDigits: phoneDigits,
          cliente: clienteNombre,
          fechaCierre: formatDateForMessage(venta.fechaCierre),
          monto: montoTexto,
        });

        await prisma.venta.update({
          where: { id: venta.id },
          data: {
            estado: 'MENSAJE_ENVIADO',
          },
        });

        await prisma.whatsAppLog.create({
          data: {
            ventaId: venta.id,
            clienteNombre: clienteNombre || null,
            telefono: telefonoOriginal || null,
            fechaObjetivo: venta.fechaCierre,
            estado: 'MENSAJE_ENVIADO',
            detalle: 'Envío exitoso',
          },
        });

        sent++;
      } catch (error) {
        errors++;
        await prisma.whatsAppLog.create({
          data: {
            ventaId: venta.id,
            clienteNombre: clienteNombre || null,
            telefono: telefonoOriginal || null,
            fechaObjetivo: venta.fechaCierre,
            estado: 'ERROR',
            detalle: String(error.message || error),
          },
        });
      }
    }

    await registrarActividad({
      usuarioId: req.authUser?.id,
      accion: 'WHATSAPP_COBROS_HOY',
      entidad: 'WHATSAPP',
      descripcion: `Cobros ejecutados. Enviados: ${sent}, omitidos: ${skipped}, errores: ${errors}`,
    });

    res.json({ ok: true, sent, skipped, errors });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: getFriendlyErrorMessage(error, 'Error enviando WhatsApp.'),
    });
  }
});

app.get('/whatsapp/logs', requireAuth, async (req, res) => {
  try {
    const rows = await prisma.whatsAppLog.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar logs de WhatsApp.' });
  }
});

app.delete('/maintenance/clear-history', requireRole('ADMIN'), async (req, res) => {
  try {
    await prisma.$transaction([
      prisma.historialBaja.deleteMany({}),
      prisma.whatsAppLog.deleteMany({}),
      prisma.actividadSistema.deleteMany({}),
    ]);

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al limpiar historial.' });
  }
});

const PORT = Number(process.env.PORT) || 3001;

app.get('/dashboard/resumen', requireAuth, async (req, res) => {
  try {
    const scope = parseDashboardScope(req.query);
    const data = await buildDashboardData(scope);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cargar dashboard.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
