# P2P Chat (React + TypeScript + Cloudflare)

[Đọc bản tiếng Việt](./README.vi.md)

This project is a two-peer WebRTC chat application with a Cloudflare Durable Object signaling server.

## What was refactored

- Frontend moved from plain JavaScript to **React + TypeScript**.
- Styling moved from CSS/Tailwind mix to **SCSS with BEM naming**.
- Responsive UI was redesigned for desktop, tablet, and mobile.
- Users can set a **display name before joining**; if empty, a default name is used.
- Sensitive values were centralized into one file: **`/.env`**.
- Added **`/.env.example`** with English instructions for getting Cloudflare values.
- Added project-level **`.gitignore`**.
- Added bilingual setup/deploy docs (`README.md`, `README.vi.md`).

## Project structure

```text
.
|- .env.example
|- client/
|  |- src/
|  |  |- App.tsx
|  |  |- config/appConfig.ts
|  |  |- styles/main.scss
|  |  |- main.tsx
|  |- package.json
|  |- vite.config.ts
|- signaling-server/
|  |- src/worker.ts
|  |- wrangler.toml
|  |- package.json
```

## Prerequisites

Install these before setup:

- Node.js 20+ (LTS recommended)
- npm 10+
- Cloudflare account
- Wrangler CLI (installed via project dependencies)

## Setup

### 1. Configure secrets

1. Copy `.env.example` to `.env` at repository root.
2. Fill all required values in `.env`.
3. Do not commit `.env`.

### 2. Install dependencies

```bash
cd signaling-server
npm install

cd ../client
npm install
```

### 3. Run locally (2 terminals)

Terminal A (signaling server):

```bash
cd signaling-server
npm run dev
```

Terminal B (React app):

```bash
cd client
npm run dev
```

Open the Vite URL shown in terminal B.

## Display name behavior

- Field: `Display Name (optional)`.
- If user leaves it empty, the app uses `VITE_DEFAULT_DISPLAY_NAME` (default `Guest`).

## Deploy to Cloudflare

### 1. Deploy signaling worker

```bash
cd signaling-server
npm run deploy
```

After deploy, copy the final Worker URL and set it in:

- `.env` -> `VITE_SIGNALING_SERVER_URL` (for local)
- Cloudflare Pages env var `VITE_SIGNALING_SERVER_URL` (for production frontend)

### 2. Deploy frontend (Cloudflare Pages)

### Option A: Cloudflare Dashboard (Git integration)

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `client`
- Add Environment Variables in Pages project settings:
  - `VITE_SIGNALING_SERVER_URL`
  - `VITE_DEFAULT_DISPLAY_NAME`
  - `VITE_STUN_URL`
  - `VITE_TURN_URLS`
  - `VITE_TURN_USERNAME`
  - `VITE_TURN_CREDENTIAL`

### Option B: Wrangler Pages CLI

```bash
cd client
npm run build
npx wrangler pages deploy dist --project-name <your-pages-project-name>
```

If your pipeline is non-interactive, export:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

## Cloudflare secret checklist

| Variable | Used by | Where to get it |
|---|---|---|
| `VITE_SIGNALING_SERVER_URL` | React client | Output of `wrangler deploy` for signaling worker |
| `VITE_TURN_USERNAME` | React client | Cloudflare Realtime TURN credentials |
| `VITE_TURN_CREDENTIAL` | React client | Cloudflare Realtime TURN credentials |
| `CLOUDFLARE_ACCOUNT_ID` | CI / CLI deploy | Cloudflare account overview |
| `CLOUDFLARE_API_TOKEN` | CI / CLI deploy | Cloudflare API Tokens page |

Guides referenced in `.env.example`:

- Find account ID: <https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/>
- Create API token: <https://developers.cloudflare.com/fundamentals/api/get-started/create-token/>
- TURN docs entry: <https://developers.cloudflare.com/realtime/turn/>

## Notes

- TURN credentials are sensitive. Keep them only in `.env` / Cloudflare environment variables.
- For production, consider generating short-lived TURN credentials server-side instead of static frontend env values.
