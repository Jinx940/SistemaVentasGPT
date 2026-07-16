# Frontend de SistemaVentasGPT

Aplicacion React/Vite preparada para Vercel.

## Desarrollo local

```powershell
npm install
npm run dev
```

Configura `VITE_API_URL` usando `.env.example` como referencia. En desarrollo,
si no defines la variable, el frontend usa `http://localhost:3001`.

## Produccion

En Vercel usa `SistemaVentasGPT/frontend` como Root Directory. Este mismo
proyecto publica el frontend y carga la API Express desde `../backend`.

Define:

```text
VITE_API_URL=/api
```

Consulta [`../DEPLOY.md`](../DEPLOY.md) para el despliegue completo.
