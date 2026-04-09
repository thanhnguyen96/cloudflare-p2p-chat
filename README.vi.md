# P2P Chat

[Read English version](./README.md)

Ứng dụng chat 1-1 dùng WebRTC, signaling bằng Cloudflare Durable Object, TURN credential ngắn hạn cấp từ backend.

## Stack

- Frontend: React + TypeScript + Vite
- Signaling: Cloudflare Worker + Durable Object
- TURN: Cloudflare Realtime TURN API (backend cấp credential)

## Chạy Local Nhanh

1. Cài dependencies.

```bash
cd signaling-server
npm install

cd ../client
npm install
```

2. Cấu hình env frontend.

```bash
cp .env.example .env
```

Biến cần có trong `.env`:

- `VITE_SIGNALING_SERVER_URL`
- `VITE_DEFAULT_DISPLAY_NAME` (tuỳ chọn, mặc định `Guest`)

3. Cấu hình env signaling worker.

```bash
cd signaling-server
cp .dev.vars.example .dev.vars
```

Biến cần có trong `signaling-server/.dev.vars`:

- `TURN_KEY_ID`
- `TURN_API_TOKEN`
- `TURN_CREDENTIAL_TTL_SECONDS=3600`
- `TURN_ALLOWED_ORIGINS=http://localhost:5173,https://p2p-chat-awp.pages.dev`

4. Chạy local (2 terminal).

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

## Luồng TURN

- Frontend gọi `GET /api/turn-credentials` trước khi kết nối WebRTC.
- Worker sinh TURN credential với TTL (mặc định `3600s`).
- Frontend tự refresh credential trước khi hết hạn.
- Worker chỉ trả endpoint này nếu `Origin` nằm trong `TURN_ALLOWED_ORIGINS`.

## Deploy

### Signaling Worker

```bash
cd signaling-server
npm run deploy
```

### Frontend (Cloudflare Pages)

Trong thư mục `client`:

```bash
npm run deploy
```

Scripts:

- `npm run deploy`: build + deploy production branch (`production`)
- `npm run deploy:preview`: build + deploy preview

## Vai Trò File Env

- `/.env`: chỉ cho frontend (`VITE_*`)
- `/signaling-server/.dev.vars`: chỉ cho worker local (`TURN_*`)

Không đặt worker secrets trong `.env`.

## Deploy CI / Non-Interactive

Export trong shell/CI (không đặt trong `.env`):

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

## Lỗi Thường Gặp

- `403` ở `/api/turn-credentials`
  Nguyên nhân: `Origin` request không nằm trong `TURN_ALLOWED_ORIGINS`.
- `500` với `Missing TURN_KEY_ID or TURN_API_TOKEN`
  Nguyên nhân: chưa set secrets cho worker production.
- Deploy xong nhưng UI production chưa đổi
  Nguyên nhân: deploy nhầm preview branch hoặc bị cache trình duyệt.

## Tài Liệu

- TURN docs: <https://developers.cloudflare.com/realtime/turn/>
- Tìm account ID: <https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/>
- Tạo API token: <https://developers.cloudflare.com/fundamentals/api/get-started/create-token/>
