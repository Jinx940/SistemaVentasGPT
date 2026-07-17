ALTER TABLE "Cliente"
ADD COLUMN "portalCodigoHash" TEXT,
ADD COLUMN "portalActivo" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "DispositivoCliente" (
  "id" SERIAL NOT NULL,
  "clienteId" INTEGER NOT NULL,
  "identificador" TEXT NOT NULL,
  "nombre" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DispositivoCliente_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SesionCliente" (
  "id" SERIAL NOT NULL,
  "clienteId" INTEGER NOT NULL,
  "dispositivoId" INTEGER NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SesionCliente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DispositivoCliente_clienteId_identificador_key" ON "DispositivoCliente"("clienteId", "identificador");
CREATE INDEX "DispositivoCliente_clienteId_activo_idx" ON "DispositivoCliente"("clienteId", "activo");
CREATE INDEX "DispositivoCliente_lastSeenAt_idx" ON "DispositivoCliente"("lastSeenAt");
CREATE UNIQUE INDEX "SesionCliente_tokenHash_key" ON "SesionCliente"("tokenHash");
CREATE INDEX "SesionCliente_clienteId_idx" ON "SesionCliente"("clienteId");
CREATE INDEX "SesionCliente_dispositivoId_idx" ON "SesionCliente"("dispositivoId");
CREATE INDEX "SesionCliente_expiresAt_idx" ON "SesionCliente"("expiresAt");

ALTER TABLE "DispositivoCliente" ADD CONSTRAINT "DispositivoCliente_clienteId_fkey"
FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SesionCliente" ADD CONSTRAINT "SesionCliente_clienteId_fkey"
FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SesionCliente" ADD CONSTRAINT "SesionCliente_dispositivoId_fkey"
FOREIGN KEY ("dispositivoId") REFERENCES "DispositivoCliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
