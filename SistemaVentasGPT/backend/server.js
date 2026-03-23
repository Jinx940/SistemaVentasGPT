const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

app.use(cors());
app.use(express.json());

const ESTADOS = ['PENDIENTE', 'PAGADO', 'MENSAJE_ENVIADO', 'BAJA'];
const COSTO_CHATGPT_POR_CUENTA = 90;
const COSTO_POR_CORREO = COSTO_CHATGPT_POR_CUENTA;

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

function buildClienteData(body) {
  const nombre = cleanText(body.nombre || body.cliente);
  const telefono = cleanText(body.telefono);
  const carpeta = cleanText(body.carpeta);
  const observacion = cleanText(body.observacion || body.observacionCliente || '');
  const monto = round2(Number(body.monto ?? body.montoCliente ?? body.monto_cliente));

  if (!nombre) {
    throw new Error('El nombre es obligatorio.');
  }

  if (!telefono) {
    throw new Error('El teléfono es obligatorio.');
  }

  if (!monto || monto <= 0) {
    throw new Error('El monto del cliente debe ser mayor a 0.');
  }

  return {
    nombre,
    telefono,
    monto,
    carpeta: carpeta || '',
    observacion: observacion || null,
  };
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

function formatVentaForUi(venta, no = 0) {
  const monto = moneyNumber(venta.monto);
  const descuento = moneyNumber(venta.descuento);

  return {
    id: venta.id,
    no,
    cliente: venta.cliente?.nombre || '',
    telefono: venta.cliente?.telefono || '',
    fechaInicioISO: toISODateUi(venta.fechaInicio),
    fechaInicioText: formatDateUi(venta.fechaInicio),
    fechaCierreISO: toISODateUi(venta.fechaCierre),
    fechaCierreText: formatDateUi(venta.fechaCierre),
    fechaPagoISO: toISODateUi(venta.fechaPago),
    fechaPagoText: formatDateUi(venta.fechaPago),
    monto,
    descuento,
    montoNeto: Math.max(0, monto - descuento),
    montoPagado: moneyNumber(venta.montoPagado),
    estado: toUiEstado(venta.estado),
    tipoDispositivo: splitTipos(venta.tipoDispositivo),
    cantidadDispositivos: venta.cantidadDispositivos || 0,
    carpeta: venta.cliente?.carpeta || '',
    observacion: venta.observacion || venta.cliente?.observacion || '',
    cuentaId: venta.cuentaAcceso?.id || '',
    cuentaCorreo: venta.cuentaAcceso?.correo || '',
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

  const getValue = (key, fallback = '') =>
    cleanText(cfg[key] || process.env[key] || fallback);

  const enabledRaw = getValue('WA_ENABLED', 'false').toLowerCase();

  return {
    enabled: enabledRaw === 'true',
    graphVersion: getValue('WA_GRAPH_VERSION', 'v23.0'),
    phoneNumberId: getValue('WA_PHONE_NUMBER_ID', ''),
    accessToken: getValue('WA_ACCESS_TOKEN', ''),
    templateName: getValue('WA_TEMPLATE_NAME', 'gpt_plus_vence_hoy'),
    langCode: getValue('WA_LANG_CODE', 'es_PE'),
  };
}

async function isWhatsAppEnabled() {
  const cfg = await getWhatsAppSettings();
  return cfg.enabled;
}

async function sendWhatsAppTemplate({ toDigits, cliente, fechaCierre, monto }) {
  const cfg = await getWhatsAppSettings();

  const graphVersion = cleanText(cfg.graphVersion || 'v23.0');
  const phoneNumberId = cleanText(cfg.phoneNumberId);
  const accessToken = cleanText(cfg.accessToken);
  const templateName = cleanText(cfg.templateName);
  const langCode = cleanText(cfg.langCode || 'es_PE');

  if (!phoneNumberId) throw new Error('Falta WA_PHONE_NUMBER_ID');
  if (!accessToken) throw new Error('Falta WA_ACCESS_TOKEN');
  if (!templateName) throw new Error('Falta WA_TEMPLATE_NAME');

  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;

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

async function upsertClienteFromVenta(body, clienteId = null) {
  const clienteData = buildClienteData(body);

  if (clienteId) {
    return prisma.cliente.update({
      where: { id: clienteId },
      data: clienteData,
    });
  }

  const bodyClienteId = Number(body.clienteId || body.cliente_id || 0);

  if (bodyClienteId) {
    return prisma.cliente.update({
      where: { id: bodyClienteId },
      data: clienteData,
    });
  }

  const telefono = cleanText(clienteData.telefono);

  const clienteExistente = await prisma.cliente.findFirst({
    where: { telefono },
    orderBy: { id: 'desc' },
  });

  if (clienteExistente) {
    return prisma.cliente.update({
      where: { id: clienteExistente.id },
      data: clienteData,
    });
  }

  return prisma.cliente.create({
    data: clienteData,
  });
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
    orderBy: { id: 'desc' },
  });

  const usageMap = await getAccountUsageMap();

  return cuentas.map((cuenta) => ({
    ...cuenta,
    used: usageMap[cuenta.id] || 0,
  }));
}

function getMonthRange(month, year) {
  const safeMonth = Math.min(12, Math.max(1, Number(month)));
  const safeYear = Math.max(2000, Number(year));

  const start = new Date(safeYear, safeMonth - 1, 1, 0, 0, 0, 0);
  const end = new Date(safeYear, safeMonth, 1, 0, 0, 0, 0);

  return { start, end };
}

function parseDashboardMonthYear(query) {
  const now = new Date();

  const month = Number(query.month) || now.getMonth() + 1;
  const year = Number(query.year) || now.getFullYear();

  return {
    month: Math.min(12, Math.max(1, month)),
    year: Math.max(2000, year),
  };
}

async function buildDashboardData({ month, year }) {
  const { start, end } = getMonthRange(month, year);

  const [ventas, cuentas] = await Promise.all([
    prisma.venta.findMany({
      where: {
        fechaInicio: {
          gte: start,
          lt: end,
        },
      },
      include: {
        cliente: true,
        cuentaAcceso: true,
      },
      orderBy: { id: 'desc' },
    }),
    prisma.cuentaAcceso.findMany({
      orderBy: { correo: 'asc' },
    }),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalClientes = 0;
  let pagados = 0;
  let pendientes = 0;
  let mensajesEnviados = 0;
  let vencenHoy = 0;
  let vencidos = 0;
  let bajas = 0;
  let pendientesHoy = 0;
  let mensajesHoy = 0;
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
    const montoNeto = getVentaMontoNeto(venta);
    const correo = cleanText(venta.cuentaAcceso?.correo);

    if (estado !== 'BAJA') {
      totalClientes++;
    } else {
      bajas++;
    }

    if (estado === 'PAGADO') {
      pagados++;
      totalIngresos += montoNeto;
    } else if (estado === 'PENDIENTE') {
      pendientes++;
    } else if (estado === 'MENSAJE_ENVIADO') {
      mensajesEnviados++;
    }

    const cierre = venta.fechaCierre ? new Date(venta.fechaCierre) : null;
    if (cierre) {
      cierre.setHours(0, 0, 0, 0);

      if (estado !== 'PAGADO' && estado !== 'BAJA') {
        if (cierre.getTime() === today.getTime()) {
          vencenHoy++;

          if (estado === 'PENDIENTE') pendientesHoy++;
          if (estado === 'MENSAJE_ENVIADO') mensajesHoy++;
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

  const totalCorreos = cuentas.filter((c) => c.activa).length;
  const costoChatGPT = totalCorreos * COSTO_CHATGPT_POR_CUENTA;
  const neto = totalIngresos - costoChatGPT;

  const porCorreo = Object.values(porCorreoMap)
    .map((item) => ({
      ...item,
      ingresos: round2(item.ingresos),
      neto: round2(item.ingresos - item.costoChatGPT),
    }))
    .sort((a, b) => a.correo.localeCompare(b.correo));

  return {
    month,
    year,
    totalClientes,
    totalCorreos,
    pagados,
    pendientes,
    mensajesEnviados,
    vencenHoy,
    vencidos,
    bajas,
    pendientesHoy,
    mensajesHoy,
    totalIngresos: round2(totalIngresos),
    costoChatGPT: round2(costoChatGPT),
    neto: round2(neto),
    porCorreo,
  };
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

app.get('/dashboard', async (req, res) => {
  try {
    const { month, year } = parseDashboardMonthYear(req.query);
    const data = await buildDashboardData({ month, year });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cargar dashboard.' });
  }
});

/* =========================
   CONFIGURACIÓN
========================= */

app.get('/config/whatsapp', async (req, res) => {
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

app.put('/config/whatsapp', async (req, res) => {
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

app.put('/config/whatsapp/enabled', async (req, res) => {
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

app.get('/historial-bajas', async (req, res) => {
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

app.get('/clientes', async (req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({
      orderBy: { id: 'desc' },
    });

    res.json(clientes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar clientes.' });
  }
});

app.post('/clientes', async (req, res) => {
  try {
    const clienteData = buildClienteData(req.body);

    const cliente = await prisma.cliente.create({
      data: clienteData,
    });

    res.json(cliente);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || 'Error al crear cliente.' });
  }
});

app.put('/clientes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    const clienteData = buildClienteData(req.body);

    const cliente = await prisma.cliente.update({
      where: { id },
      data: clienteData,
    });

    res.json(cliente);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || 'Error al actualizar cliente.' });
  }
});

app.delete('/clientes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    await prisma.$transaction([
      prisma.venta.deleteMany({ where: { clienteId: id } }),
      prisma.cliente.delete({ where: { id } }),
    ]);

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar cliente.' });
  }
});

/* =========================
   CUENTAS
========================= */

app.get('/cuentas', async (req, res) => {
  try {
    const cuentas = await listAccountsWithUsage();
    res.json(cuentas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar cuentas.' });
  }
});

app.post('/cuentas', async (req, res) => {
  try {
    const correo = cleanText(req.body.correo);
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

    await prisma.cuentaAcceso.create({
      data: {
        correo,
        password,
        capacidad,
        activa,
        observacion: observacion || null,
      },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear cuenta.' });
  }
});

app.put('/cuentas/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const correo = cleanText(req.body.correo);
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

    await prisma.cuentaAcceso.update({
      where: { id },
      data: {
        correo,
        password: password || actual.password,
        capacidad,
        activa,
        observacion: observacion || null,
      },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar cuenta.' });
  }
});

app.delete('/cuentas/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    const linked = await prisma.venta.count({
      where: { cuentaAccesoId: id },
    });

    if (linked > 0) {
      return res.status(400).json({
        error: 'No puedes eliminar esta cuenta porque ya tiene ventas asociadas.',
      });
    }

    await prisma.cuentaAcceso.delete({
      where: { id },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar cuenta.' });
  }
});

/* =========================
   VENTAS
========================= */

app.get('/ventas', async (req, res) => {
  try {
    const ventas = await prisma.venta.findMany({
      include: {
        cliente: true,
        cuentaAcceso: true,
      },
      orderBy: { id: 'desc' },
    });

    res.json(ventas.map((venta, index) => formatVentaForUi(venta, index + 1)));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar ventas.' });
  }
});

app.post('/ventas', async (req, res) => {
  try {
    const baseData = buildVentaData(req.body);
    const assignmentMode = cleanText(req.body.assignmentMode || 'auto');

    const cliente = await upsertClienteFromVenta(req.body);

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
      include: {
        cliente: true,
        cuentaAcceso: true,
      },
    });

    res.json(formatVentaForUi(venta));
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || 'Error al crear venta.' });
  }
});

app.put('/ventas/:id', async (req, res) => {
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
      include: {
        cliente: true,
        cuentaAcceso: true,
      },
    });

    await registrarHistorialBaja({
      ventaAntes: actual,
      ventaDespues: venta,
    });

    res.json(formatVentaForUi(venta));
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || 'Error al actualizar venta.' });
  }
});

app.post('/ventas/:id/pagar', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const fechaPago = parseLocalDate(req.body.fechaPago);
    const mesesPagados = Math.min(2, Math.max(1, Number(req.body.mesesPagados) || 1));

    if (!id) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    if (!fechaPago) {
      return res.status(400).json({ error: 'La fecha de pago es obligatoria.' });
    }

    const actual = await prisma.venta.findUnique({
      where: { id },
      include: {
        cliente: true,
        cuentaAcceso: true,
      },
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

    const venta = await prisma.venta.update({
      where: { id },
      data: {
        estado: 'PAGADO',
        fechaPago,
        monto: montoMensual,
        montoPagado: montoMensual,
      },
      include: {
        cliente: true,
        cuentaAcceso: true,
      },
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

    res.json({
      ok: true,
      venta: formatVentaForUi(venta),
      mesesPagados,
      montoMensual,
      totalPagado: round2(montoMensual * mesesPagados),
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || 'Error al registrar pago.' });
  }
});

app.delete('/ventas/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    await prisma.venta.delete({
      where: { id },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar venta.' });
  }
});

app.post('/whatsapp/send-due-today', async (req, res) => {
  try {
    if (!(await isWhatsAppEnabled())) {
      return res.json({
        ok: true,
        sent: 0,
        skipped: 0,
        errors: 0,
        message: 'WhatsApp está desactivado.',
      });
    }

    const ventas = await prisma.venta.findMany({
      where: {
        estado: 'PENDIENTE',
      },
      include: {
        cliente: true,
      },
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

      const phoneDigits = normalizePhoneDigits(venta.cliente?.telefono);
      if (!phoneDigits) {
        errors++;
        await prisma.whatsAppLog.create({
          data: {
            ventaId: venta.id,
            clienteNombre: venta.cliente?.nombre || null,
            telefono: venta.cliente?.telefono || null,
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
          cliente: venta.cliente?.nombre || '',
          fechaCierre: formatDateForMessage(venta.fechaCierre),
          monto: Number(venta.monto || 0).toFixed(2),
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
            clienteNombre: venta.cliente?.nombre || null,
            telefono: venta.cliente?.telefono || null,
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
            clienteNombre: venta.cliente?.nombre || null,
            telefono: venta.cliente?.telefono || null,
            fechaObjetivo: venta.fechaCierre,
            estado: 'ERROR',
            detalle: String(error.message || error),
          },
        });
      }
    }

    res.json({ ok: true, sent, skipped, errors });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error enviando WhatsApp.' });
  }
});

app.get('/whatsapp/logs', async (req, res) => {
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

app.delete('/maintenance/clear-history', async (req, res) => {
  try {
    await prisma.$transaction([
      prisma.historialBaja.deleteMany({}),
      prisma.whatsAppLog.deleteMany({}),
    ]);

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al limpiar historial.' });
  }
});

const PORT = 3001;

app.get('/dashboard/resumen', async (req, res) => {
  try {
    const { month, year } = parseDashboardMonthYear(req.query);
    const data = await buildDashboardData({ month, year });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cargar dashboard.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
