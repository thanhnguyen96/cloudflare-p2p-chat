# P2P Chat

[Đọc bản tiếng Việt](./README.vi.md)

WebRTC 1-1 chat app with Cloudflare Durable Object signaling and short-lived TURN credentials.

## Stack

- Frontend: React + TypeScript + Vite
- Signaling: Cloudflare Worker + Durable Object
- TURN: Cloudflare Realtime TURN API (credentials issued by backend)

## Quick Start (Local)

1. Install dependencies.

```bash
cd signaling-server
npm install

cd ../client
npm install
```

2. Configure frontend env.

```bash
cp .env.example .env
```

Required in `.env`:

- `VITE_SIGNALING_SERVER_URL`
- `VITE_DEFAULT_DISPLAY_NAME` (optional, default `Guest`)

3. Configure signaling worker env.

```bash
cd signaling-server
cp .dev.vars.example .dev.vars
```

Required in `signaling-server/.dev.vars`:

- `TURN_KEY_ID`
- `TURN_API_TOKEN`
- `TURN_CREDENTIAL_TTL_SECONDS=3600`
- `TURN_ALLOWED_ORIGINS=http://localhost:5173,https://p2p-chat-awp.pages.dev`

4. Run local dev (2 terminals).

Terminal A:

```bash
cd signaling-server
npm run dev
```

Terminal B:

```bash
cd client
npm run dev
```

## TURN Flow

- Frontend calls `GET /api/turn-credentials` before WebRTC connection.
- Worker generates TURN credentials with TTL (default `3600s`).
- Frontend refreshes credentials before expiry.
- Worker only serves this endpoint when `Origin` is in `TURN_ALLOWED_ORIGINS`.

## Deploy

### Signaling Worker

```bash
cd signaling-server
npm run deploy
```

### Frontend (Cloudflare Pages)

From `client`:

```bash
npm run deploy
```

Scripts:

- `npm run deploy`: build + deploy to Pages production branch (`production`)
- `npm run deploy:preview`: build + deploy preview

## Environment Files

- `/.env`: frontend Vite variables only (`VITE_*`)
- `/signaling-server/.dev.vars`: worker local variables only (`TURN_*`)

Do not put worker secrets in `.env`.

## CI / Non-Interactive Deploy

Export these in shell/CI (not in `.env`):

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

## Common Issues

- `403` on `/api/turn-credentials`
  Cause: request `Origin` is not in `TURN_ALLOWED_ORIGINS`.
- `500` with `Missing TURN_KEY_ID or TURN_API_TOKEN`
  Cause: worker secrets are not set in production.
- Production UI not updated after deploy
  Cause: deployed to preview branch instead of `production`, or browser cache.

## References

- TURN docs: <https://developers.cloudflare.com/realtime/turn/>
- Find account ID: <https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/>
- Create API token: <https://developers.cloudflare.com/fundamentals/api/get-started/create-token/>
