# Bappi Stores Kano

Inventory and sales management for **Bappi Stores** in Kano, Nigeria. Track products, record cash and credit sales, manage customer debts, and export reports — with amounts in **Naira (₦)**.

## Stack

- **Client:** React, Vite, Tailwind CSS, React Router, Zustand, Recharts
- **Server:** Express, MongoDB (Mongoose), JWT auth

## Requirements (any OS)

- **[Node.js 20+](https://nodejs.org/)** (LTS) — Windows, macOS, and Linux
- **MongoDB** optional — if it is not installed or not running, the API uses an **in-memory** database (data resets when the server stops)

## Quick start (Windows, macOS, Linux)

```bash
# From the project folder
npm run setup          # creates server/.env and client/.env if missing
npm run install:all    # installs root + client + server dependencies
npm run seed           # admin user + sample data
npm run dev            # API + Vite dev UI
```

- **Dev UI:** http://localhost:5173  
- **API:** http://localhost:5001/api  
- **Login:** `admin@bappi.com` / `admin123`

### Production-style (single app URL)

Builds the UI and serves it from the API (good for shop PCs or a small server):

```bash
npm run setup
npm run install:all
npm run seed
npm run start
```

Open **http://localhost:5001** (same port as `PORT` in `server/.env`).

Set `VITE_API_URL=/api` in `client/.env` before `npm run start` so the built UI talks to the same host.

In **development**, the browser uses **`/api`** on the Vite dev server, which **proxies** to the API (`DEV_PROXY_TARGET` in `client/.env`, default `http://127.0.0.1:5001`).

If MongoDB is not running locally, the server falls back to an in-memory database.

### Windows notes

Use **PowerShell** or **Command Prompt** in the project folder. If `npm` is not recognized, reinstall Node.js and tick **“Add to PATH”**.

Copy env files manually if needed:

```powershell
copy server\.env.example server\.env
copy client\.env.example client\.env
```

### macOS port 5000

On macOS, **AirPlay Receiver** often uses port **5000**. Keep **`PORT=5001`** in `server/.env` (default in `.env.example`).

### Port already in use (`EADDRINUSE`)

Change **`PORT`** in `server/.env` (e.g. `5001`) and match **`DEV_PROXY_TARGET`** in `client/.env` for dev.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run setup` | Create `.env` files from examples (all platforms) |
| `npm run install:all` | Install dependencies (root, client, server) |
| `npm run dev` | Start client and server |
| `npm run start` | Build UI + run API (serves app on `PORT`) |
| `npm run dev:client` | Frontend only |
| `npm run dev:server` | API only |
| `npm run build` | Production build (client) |
| `npm run seed` | Create admin user and sample data |

## Features

- **Dashboard** — stock value, sales, debts, low-stock alerts, sales chart
- **Products** — add, edit, delete, restock, search
- **Customers** — manage buyers for credit sales
- **Sales** — cash or credit; auto stock deduction
- **Debts** — track and record payments on credit sales
- **Reports** — export CSV (authenticated download)

## Project structure

```
client/src/
  components/   Layout, Protected, PageHeader
  pages/        Dashboard, Products, Customers, Sales, Debts, Reports, Login
  utils/        format.js (₦ formatting)
server/src/
  models.js, routes.js, seed.js
```
