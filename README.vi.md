# P2P Chat (React + TypeScript + Cloudflare)

[Read English version](./README.md)

Dự án là ứng dụng chat 2 người dùng qua WebRTC, dùng Cloudflare Durable Object làm signaling server.

## Những gì đã refactor

- Frontend chuyển từ JavaScript thuần sang **React + TypeScript**.
- Giao diện chuyển từ CSS/Tailwind pha trộn sang **SCSS theo chuẩn BEM**.
- Thiết kế lại giao diện **responsive** cho desktop, tablet, mobile.
- Người dùng có thể nhập **tên hiển thị trước khi vào phòng**; để trống sẽ dùng tên mặc định.
- Gom biến nhạy cảm về **một file duy nhất `/.env`**.
- Thêm **`/.env.example`** (tiếng Anh) với hướng dẫn lấy thông tin Cloudflare.
- Thêm **`.gitignore`** ở mức project.
- Thêm tài liệu song ngữ (`README.md`, `README.vi.md`).

## Cấu trúc dự án

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

## Yêu cầu cài đặt

Cần cài trước:

- Node.js 20+ (khuyến nghị LTS)
- npm 10+
- Tài khoản Cloudflare
- Wrangler CLI (được cài qua dependencies của project)

## Thiết lập

### 1. Cấu hình secrets

1. Copy `.env.example` thành `.env` ở thư mục gốc.
2. Điền các giá trị bắt buộc trong `.env`.
3. Không commit file `.env`.

### 2. Cài dependencies

```bash
cd signaling-server
npm install

cd ../client
npm install
```

### 3. Chạy local (2 terminal)

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

Mở URL Vite được in ra ở terminal B.

## Hành vi tên hiển thị

- Trường nhập: `Display Name (optional)`.
- Nếu để trống, ứng dụng dùng `VITE_DEFAULT_DISPLAY_NAME` (mặc định là `Guest`).

## Deploy lên Cloudflare

### 1. Deploy signaling worker

```bash
cd signaling-server
npm run deploy
```

Sau khi deploy xong, copy Worker URL và cập nhật:

- `.env` -> `VITE_SIGNALING_SERVER_URL` (cho local)
- Environment Variables của Cloudflare Pages -> `VITE_SIGNALING_SERVER_URL` (cho production frontend)

### 2. Deploy frontend (Cloudflare Pages)

#### Cách A: Cloudflare Dashboard (kết nối Git)

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `client`
- Thêm Environment Variables trong Pages project:
  - `VITE_SIGNALING_SERVER_URL`
  - `VITE_DEFAULT_DISPLAY_NAME`
  - `VITE_STUN_URL`
  - `VITE_TURN_URLS`
  - `VITE_TURN_USERNAME`
  - `VITE_TURN_CREDENTIAL`

#### Cách B: Wrangler Pages CLI

```bash
cd client
npm run build
npx wrangler pages deploy dist --project-name <ten-pages-project>
```

Nếu deploy bằng CI hoặc môi trường không tương tác, export thêm:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

## Checklist secret Cloudflare

| Biến | Dùng cho | Lấy từ đâu |
|---|---|---|
| `VITE_SIGNALING_SERVER_URL` | React client | Kết quả `wrangler deploy` của signaling worker |
| `VITE_TURN_USERNAME` | React client | TURN credentials trong Cloudflare Realtime |
| `VITE_TURN_CREDENTIAL` | React client | TURN credentials trong Cloudflare Realtime |
| `CLOUDFLARE_ACCOUNT_ID` | CI / CLI deploy | Trang thông tin account Cloudflare |
| `CLOUDFLARE_API_TOKEN` | CI / CLI deploy | Trang API Tokens của Cloudflare |

Các link hướng dẫn đã có trong `.env.example`:

- Tìm account ID: <https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/>
- Tạo API token: <https://developers.cloudflare.com/fundamentals/api/get-started/create-token/>
- Tài liệu TURN: <https://developers.cloudflare.com/realtime/turn/>

## Lưu ý

- TURN credentials là thông tin nhạy cảm, chỉ nên để trong `.env` hoặc biến môi trường của Cloudflare.
- Với production, nên cân nhắc sinh TURN credential ngắn hạn ở server thay vì dùng biến tĩnh trong frontend.
