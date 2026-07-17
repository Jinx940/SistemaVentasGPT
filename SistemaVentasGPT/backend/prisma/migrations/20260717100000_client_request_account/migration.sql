-- Preserve the access account selected by the client until the request is approved.
ALTER TABLE "SolicitudCliente"
ADD COLUMN "cuentaAccesoId" INTEGER;

CREATE INDEX "SolicitudCliente_cuentaAccesoId_idx"
ON "SolicitudCliente"("cuentaAccesoId");

ALTER TABLE "SolicitudCliente"
ADD CONSTRAINT "SolicitudCliente_cuentaAccesoId_fkey"
FOREIGN KEY ("cuentaAccesoId") REFERENCES "CuentaAcceso"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

