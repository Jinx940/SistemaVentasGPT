# SistemaVentasGPT

Sistema de cobranza con:

- frontend en React + Vite
- backend en Express + Prisma
- base de datos PostgreSQL
- soporte para pagos, morosos, actividad, usuarios y WhatsApp

## Estructura

- [`backend`](./backend)
- [`frontend`](./frontend)
- [`DEPLOY.md`](./DEPLOY.md)

## Inicio rápido local

### Backend

```powershell
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm start
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

## Variables de entorno

Usa estos archivos como base:

- [`backend/.env.example`](./backend/.env.example)
- [`frontend/.env.example`](./frontend/.env.example)

## Deploy

La guía completa para publicar el sistema está en:

- [`DEPLOY.md`](./DEPLOY.md)
