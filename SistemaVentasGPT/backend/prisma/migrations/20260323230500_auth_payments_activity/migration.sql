-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'OPERADOR');

-- CreateTable
CREATE TABLE "UsuarioSistema" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'OPERADOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsuarioSistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SesionSistema" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SesionSistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" SERIAL NOT NULL,
    "ventaId" INTEGER NOT NULL,
    "usuarioId" INTEGER,
    "monto" DECIMAL(10,2) NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL,
    "mesesPagados" INTEGER NOT NULL DEFAULT 1,
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActividadSistema" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" INTEGER,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActividadSistema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioSistema_correo_key" ON "UsuarioSistema"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "SesionSistema_tokenHash_key" ON "SesionSistema"("tokenHash");

-- CreateIndex
CREATE INDEX "SesionSistema_usuarioId_idx" ON "SesionSistema"("usuarioId");

-- CreateIndex
CREATE INDEX "SesionSistema_expiresAt_idx" ON "SesionSistema"("expiresAt");

-- CreateIndex
CREATE INDEX "Pago_ventaId_idx" ON "Pago"("ventaId");

-- CreateIndex
CREATE INDEX "Pago_usuarioId_idx" ON "Pago"("usuarioId");

-- CreateIndex
CREATE INDEX "Pago_fechaPago_idx" ON "Pago"("fechaPago");

-- CreateIndex
CREATE INDEX "ActividadSistema_usuarioId_idx" ON "ActividadSistema"("usuarioId");

-- CreateIndex
CREATE INDEX "ActividadSistema_entidad_idx" ON "ActividadSistema"("entidad");

-- CreateIndex
CREATE INDEX "ActividadSistema_accion_idx" ON "ActividadSistema"("accion");

-- CreateIndex
CREATE INDEX "ActividadSistema_createdAt_idx" ON "ActividadSistema"("createdAt");

-- AddForeignKey
ALTER TABLE "SesionSistema" ADD CONSTRAINT "SesionSistema_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "UsuarioSistema"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "UsuarioSistema"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActividadSistema" ADD CONSTRAINT "ActividadSistema_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "UsuarioSistema"("id") ON DELETE SET NULL ON UPDATE CASCADE;
