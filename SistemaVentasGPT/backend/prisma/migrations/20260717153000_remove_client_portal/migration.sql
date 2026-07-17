DROP TABLE IF EXISTS "SesionCliente";
DROP TABLE IF EXISTS "DispositivoCliente";

ALTER TABLE "Cliente"
DROP COLUMN IF EXISTS "portalCodigoHash",
DROP COLUMN IF EXISTS "portalActivo";
