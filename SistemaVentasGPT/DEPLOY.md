# Publicar SistemaVentasGPT en un solo proyecto de Vercel

La aplicación usa:

- un proyecto de Vercel para el frontend React y la API Express;
- Supabase como base de datos PostgreSQL;
- rutas de API bajo `/api`, en el mismo dominio del frontend.

## 1. Preparar Supabase

Usa la URL **Transaction pooler** de Supabase, puerto `6543`, como
`DATABASE_URL`.

Para una base nueva, aplica las migraciones una vez desde `backend`:

```powershell
$env:DATABASE_URL="postgresql://..."
npm install
npm run prisma:migrate
```

## 2. Configurar el proyecto de Vercel

Importa el repositorio y configura:

```text
Root Directory: SistemaVentasGPT/frontend
Framework Preset: Vite
```

Vercel habilita por defecto el acceso a archivos externos al Root Directory en
proyectos modernos. El archivo `frontend/vercel.json` instala las dependencias
de `frontend` y `backend`, compila Vite y publica la función
`frontend/api/index.js`.

No hace falta crear un segundo proyecto para el backend.

## 3. Variables de entorno

Agrega estas variables para **Production** y **Preview**:

```text
VITE_API_URL=/api
DATABASE_URL=<Transaction pooler de Supabase>
DATABASE_POOL_MAX=2
CORS_ORIGINS=https://TU-PROYECTO.vercel.app
PUBLIC_BACKEND_URL=https://TU-PROYECTO.vercel.app/api
CRON_SECRET=<secreto aleatorio de 32 caracteres o más>
WA_WEBHOOK_URL=https://TU-PROYECTO.vercel.app/api/webhooks/whatsapp
WA_ENABLED=true
WA_AUTO_SEND_ENABLED=true
AUTO_BACKUP_ENABLED=true
AUTO_BACKUP_TARGET_HOUR=3
AUTO_BACKUP_KEEP=7
```

Copia también las variables `WA_*` adicionales que utilices. Nunca subas los
archivos `.env` a GitHub.

## 4. WhatsApp y tareas automáticas

En Meta WhatsApp configura como URL de devolución:

```text
https://TU-PROYECTO.vercel.app/api/webhooks/whatsapp
```

Usa el mismo token de verificación guardado en la configuración del sistema.

El proyecto registra dos tareas compatibles con Vercel Hobby:

- respaldo diario a las `09:00 UTC` (`04:00` de Lima);
- recordatorios diarios a las `13:00 UTC` (`08:00` de Lima).

## 5. Verificación

Antes de retirar cualquier proyecto anterior:

1. abre `https://TU-PROYECTO.vercel.app/api/health`;
2. confirma `ok: true` y `dbOk: true`;
3. inicia sesión desde el mismo dominio;
4. crea un cliente de prueba;
5. prueba el webhook y un mensaje de WhatsApp;
6. confirma los cron jobs en Vercel.

Solo después de estas comprobaciones elimina el proyecto de backend separado.
