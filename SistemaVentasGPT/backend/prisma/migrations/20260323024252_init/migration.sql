-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('PAGADO', 'PENDIENTE', 'MENSAJE_ENVIADO', 'BAJA');

-- CreateTable
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "carpeta" TEXT NOT NULL,
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuentaAcceso" (
    "id" SERIAL NOT NULL,
    "correo" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "capacidad" INTEGER NOT NULL DEFAULT 20,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuentaAcceso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistorialBaja" (
    "id" SERIAL NOT NULL,
    "ventaId" INTEGER,
    "clienteId" INTEGER NOT NULL,
    "clienteNombre" TEXT NOT NULL,
    "telefono" TEXT,
    "detalle" TEXT,
    "fechaBaja" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialBaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppLog" (
    "id" SERIAL NOT NULL,
    "ventaId" INTEGER,
    "clienteNombre" TEXT,
    "telefono" TEXT,
    "fechaObjetivo" TIMESTAMP(3),
    "estado" TEXT,
    "detalle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venta" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "cuentaAccesoId" INTEGER,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaCierre" TIMESTAMP(3) NOT NULL,
    "fechaPago" TIMESTAMP(3),
    "monto" DECIMAL(10,2) NOT NULL,
    "descuento" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "montoPagado" DECIMAL(10,2),
    "estado" "EstadoVenta" NOT NULL DEFAULT 'PENDIENTE',
    "tipoDispositivo" TEXT NOT NULL,
    "cantidadDispositivos" INTEGER NOT NULL,
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionSistema" (
    "clave" TEXT NOT NULL,
    "valor" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionSistema_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE INDEX "Cliente_nombre_idx" ON "Cliente"("nombre");

-- CreateIndex
CREATE INDEX "Cliente_telefono_idx" ON "Cliente"("telefono");

-- CreateIndex
CREATE UNIQUE INDEX "CuentaAcceso_correo_key" ON "CuentaAcceso"("correo");

-- CreateIndex
CREATE INDEX "Venta_fechaInicio_idx" ON "Venta"("fechaInicio");

-- CreateIndex
CREATE INDEX "Venta_fechaCierre_idx" ON "Venta"("fechaCierre");

-- CreateIndex
CREATE INDEX "Venta_estado_idx" ON "Venta"("estado");

-- CreateIndex
CREATE INDEX "Venta_cuentaAccesoId_idx" ON "Venta"("cuentaAccesoId");

-- CreateIndex
CREATE INDEX "Venta_clienteId_estado_idx" ON "Venta"("clienteId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "Venta_clienteId_fechaInicio_fechaCierre_key" ON "Venta"("clienteId", "fechaInicio", "fechaCierre");

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_cuentaAccesoId_fkey" FOREIGN KEY ("cuentaAccesoId") REFERENCES "CuentaAcceso"("id") ON DELETE SET NULL ON UPDATE CASCADE;
