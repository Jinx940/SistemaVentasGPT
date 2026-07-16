# Publicar SistemaVentasGPT en Vercel y Supabase

El repositorio se despliega como dos proyectos de Vercel:

- `backend`: API Express ejecutada como una Vercel Function.
- `frontend`: aplicacion React/Vite estatica.
- Supabase: base de datos PostgreSQL compartida por el backend.

## 1. Preparar Supabase

Usa la URL **Transaction pooler** de Supabase, puerto `6543`, como `DATABASE_URL`.
El formato es:

```text
postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
```

Para una base nueva, aplica las migraciones una vez desde `backend`:

```powershell
$env:DATABASE_URL="postgresql://..."
npm install
npm run prisma:migrate
```

## 2. Subir el repositorio a GitHub

Vercel puede crear dos proyectos desde el mismo repositorio. Si todavia no esta publicado:

```powershell
git init
git add .
git commit -m "Preparar despliegue en Vercel y Supabase"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

Los archivos `.env` estan ignorados y no deben subirse.

## 3. Crear el backend en Vercel

1. En Vercel selecciona **Add New > Project**.
2. Importa el repositorio.
3. Define **Root Directory** como `backend`.
4. Vercel detectara Express; no configures Output Directory.
5. Agrega estas variables de entorno:

```text
DATABASE_URL=<Transaction pooler de Supabase>
DATABASE_POOL_MAX=2
CORS_ORIGINS=*
CRON_SECRET=<secreto aleatorio de 16 caracteres o mas>
WA_AUTO_SEND_ENABLED=true
AUTO_BACKUP_ENABLED=true
AUTO_BACKUP_TARGET_HOUR=3
AUTO_BACKUP_KEEP=7
```

Copia tambien las variables `WA_*` que utilices. Durante el primer despliegue se
puede usar `CORS_ORIGINS=*`; reemplazalo por la URL exacta del frontend al terminar.

El archivo `backend/vercel.json` registra dos tareas compatibles con Vercel Hobby:

- Respaldo diario a las `09:00 UTC` (`04:00` de Lima).
- Recordatorios diarios a las `13:00 UTC` (`08:00` de Lima).

Vercel Hobby permite cada cron solamente una vez al dia. Para ejecutar recordatorios
cada 15 minutos se necesita Vercel Pro u otro programador externo.

## 4. Crear el frontend en Vercel

1. Crea otro proyecto desde el mismo repositorio.
2. Define **Root Directory** como `frontend`.
3. Vercel detectara Vite; el resultado de compilacion es `dist`.
4. Agrega:

```text
VITE_API_URL=https://TU-BACKEND.vercel.app
```

5. Despliega el frontend.

## 5. Cerrar la configuracion entre proyectos

En las variables del backend cambia:

```text
CORS_ORIGINS=https://TU-FRONTEND.vercel.app
PUBLIC_BACKEND_URL=https://TU-BACKEND.vercel.app
WA_WEBHOOK_URL=https://TU-BACKEND.vercel.app/webhooks/whatsapp
```

Guarda y vuelve a desplegar el backend. En Meta WhatsApp configura el mismo valor de
`WA_WEBHOOK_URL` como webhook de produccion.

## 6. Verificar antes de retirar Render y Neon

1. Abre `https://TU-BACKEND.vercel.app/health` y confirma `ok: true` y `dbOk: true`.
2. Inicia sesion desde el frontend.
3. Crea un cliente de prueba y confirma que aparece en Supabase.
4. Prueba el webhook y, si corresponde, un mensaje de WhatsApp.
5. Revisa **Settings > Cron Jobs** en el proyecto backend de Vercel.

Solo despues de estas comprobaciones elimina los servicios de Render y la base antigua
de Neon. Rota cualquier credencial que haya sido expuesta durante la migracion.
