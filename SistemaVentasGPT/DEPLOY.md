# Publicar SistemaVentasGPT

## Estructura

- `backend`: API Express + Prisma + PostgreSQL
- `frontend`: app React/Vite

## 1. Subir a GitHub

Desde la carpeta del proyecto:

```powershell
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

Si tu repo ya existe con historial, omite `git init` y `git remote add origin`.

## 2. Base de datos PostgreSQL

Crea una base de datos PostgreSQL administrada y guarda la `DATABASE_URL`.

## 3. Backend en Render

### Root Directory

`backend`

### Build Command

```bash
npm install && npm run prisma:migrate
```

### Start Command

```bash
npm start
```

### Variables de entorno

Usa como base el archivo `backend/.env.example`.

Obligatorias:

- `DATABASE_URL`
- `CORS_ORIGINS`

Opcionales:

- `PORT`
- `WA_ENABLED`
- `WA_GRAPH_VERSION`
- `WA_PHONE_NUMBER_ID`
- `WA_ACCESS_TOKEN`
- `WA_TEMPLATE_NAME`
- `WA_LANG_CODE`

Ejemplo:

```text
DATABASE_URL=postgresql://...
CORS_ORIGINS=https://tu-frontend.vercel.app
PORT=10000
```

## 4. Frontend en Vercel

### Root Directory

`frontend`

### Build Command

```bash
npm run build
```

### Output Directory

`dist`

### Variable de entorno

Usa como base el archivo `frontend/.env.example`.

```text
VITE_API_URL=https://tu-backend.onrender.com
```

## 5. Primer acceso

1. Abre tu frontend publicado.
2. Si no existen usuarios, el sistema te pedirá crear el administrador inicial.
3. Luego entra con ese correo y contraseña.

## 6. Verificaciones rápidas

Backend:

```text
https://tu-backend.onrender.com/health
```

Debe responder con `ok: true`.

Frontend:

- login carga
- dashboard abre
- puedes crear el admin inicial
- puedes guardar configuración

## 7. WhatsApp en producción

Cuando tu plantilla esté aprobada:

1. entra al sistema
2. abre `Configuración`
3. define:
   - `templateName`
   - `langCode`
   - `phoneNumberId`
   - `accessToken`
4. guarda
5. prueba con el botón de prueba o con cobros del día
