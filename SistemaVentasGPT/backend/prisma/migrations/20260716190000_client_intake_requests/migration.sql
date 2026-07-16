-- CreateEnum
CREATE TYPE "EstadoSolicitudCliente" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "SolicitudCliente" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "carpeta" TEXT NOT NULL DEFAULT '',
    "observacion" TEXT,
    "tipoDispositivo" TEXT NOT NULL,
    "cantidadDispositivos" INTEGER NOT NULL DEFAULT 1,
    "pagoRegistrado" BOOLEAN NOT NULL DEFAULT false,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaCierre" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoSolicitudCliente" NOT NULL DEFAULT 'PENDIENTE',
    "motivoRechazo" TEXT,
    "clienteId" INTEGER,
    "ventaId" INTEGER,
    "revisadoPorId" INTEGER,
    "revisadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitudCliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitudCliente_estado_createdAt_idx" ON "SolicitudCliente"("estado", "createdAt");

-- CreateIndex
CREATE INDEX "SolicitudCliente_telefono_idx" ON "SolicitudCliente"("telefono");
