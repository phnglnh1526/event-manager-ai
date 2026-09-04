# Setup và vận hành

Tài liệu này mô tả quy trình Docker-first để một thành viên mới clone và chạy Event Manager AI mà không cần cài Node.js, Python hoặc MySQL trên host.

## Prerequisites

- Git.
- Docker Desktop trên Windows/macOS, hoặc Docker Engine trên Linux.
- Docker Compose plugin (`docker compose`).
- Browser hiện đại.

Trên Windows, Docker Desktop phải đang chạy Linux containers. Project không bắt buộc WSL.

## Clone repository

```text
git clone <repository-url>
cd event-manager-ai-v2
```

Thay `<repository-url>` bằng URL repository do nhóm cung cấp.

## Tạo environment file

Docker Compose đọc `.env` ở repository root.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Linux/macOS/Git Bash:

```bash
cp .env.example .env
```

Sau đó sửa `.env` bằng giá trị local riêng. Không commit `.env`.

| Variable | Bắt buộc | Mô tả |
|---|---:|---|
| `MYSQL_DATABASE` | Có | Tên database được MySQL tạo khi khởi động lần đầu |
| `MYSQL_USER` | Có | User ứng dụng |
| `MYSQL_PASSWORD` | Có | Password user ứng dụng |
| `MYSQL_ROOT_PASSWORD` | Có | Root password của MySQL container |
| `JWT_SECRET_KEY` | Có | Secret dài, ngẫu nhiên để ký JWT |
| `JWT_ALGORITHM` | Có | Phải là `HS256` |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | Có | Số phút hết hạn token, phải lớn hơn 0 |
| `AI_MODE` | Không | `mock` mặc định hoặc `openai` |
| `OPENAI_API_KEY` | Khi dùng OpenAI | Secret chỉ dành cho backend |
| `OPENAI_MODEL` | Khi dùng OpenAI | Tên model được backend gọi |

`backend/.env.example` và `frontend/.env.example` là tài liệu tham chiếu cho từng service. Trong Compose hiện tại, backend nhận biến từ root `.env` qua `docker-compose.yml`, `MYSQL_HOST` được cố định là `db`, và frontend nhận `VITE_API_BASE_URL=http://localhost:8000` (có fallback `VITE_API_URL` cho cài đặt cũ); không cần tạo thêm hai file `.env` con để chạy Docker.

## AI Mock Mode

Mock Mode là mặc định. Có thể thêm rõ vào root `.env`:

```dotenv
AI_MODE=mock
```

Mode này không cần OpenAI key và phù hợp demo offline/local. Kết quả phải được giới thiệu là mock, không phải kết quả OpenAI thật.

## OpenAI Mode

Thêm vào root `.env`:

```dotenv
AI_MODE=openai
OPENAI_API_KEY=<your-openai-api-key>
OPENAI_MODEL=<configured-model>
```

Sau khi đổi cấu hình, recreate backend:

```text
docker compose up -d --build backend
```

Không đưa API key vào source, tài liệu, ảnh chụp log hoặc Git history.

## Khởi động lần đầu

```text
docker compose up -d --build
docker compose ps
```

Expected: `db`, `backend`, `frontend` đều `healthy`. Backend tự chạy `Base.metadata.create_all()` và ticket backfill khi startup; không cần tự tạo database table.

## Xác minh services

Mở các URL:

- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- Swagger: http://localhost:8000/docs
- API health: http://localhost:8000/api/health
- Database health: http://localhost:8000/api/health/database

Hoặc dùng:

```text
curl http://localhost:8000/api/health
curl http://localhost:8000/api/health/database
```

Expected health payloads:

```json
{"status":"ok","service":"event-manager-api"}
```

```json
{"status":"ok","database":"connected"}
```

## Logs

```text
docker compose logs backend
docker compose logs frontend
docker compose logs db
docker compose logs -f
```

## Stop, restart và rebuild

Stop và giữ dữ liệu:

```text
docker compose down
```

Restart containers:

```text
docker compose restart
```

Khởi động lại hoặc recreate nếu cần:

```text
docker compose up -d
```

Rebuild sau khi source/dependency thay đổi:

```text
docker compose up -d --build
```

Clean build chỉ khi cần troubleshooting:

```text
docker compose build --no-cache
```

## Database persistence

Named volume `mysql_data` giữ dữ liệu khi container bị recreate và khi chạy `docker compose down`.

> Cảnh báo: `docker compose down -v` xóa volume và toàn bộ dữ liệu MySQL local. Chỉ dùng cho môi trường disposable khi thực sự muốn reset database.

## Frontend build

```text
docker compose run --rm frontend npm run build
```

## Chạy regression scripts

Backend image production không copy thư mục tests. Để chạy scripts bằng container đang hoạt động mà không cần Python trên host:

```text
docker compose cp backend/tests/. backend:/app/tests
docker compose exec -T -e PYTHONPATH=/app backend python tests/test_step16_smoke.py
docker compose exec -T -e PYTHONPATH=/app backend python tests/test_step18_smoke.py
docker compose exec -T -e PYTHONPATH=/app backend python tests/test_step19_smoke.py
docker compose exec -T -e PYTHONPATH=/app backend python tests/test_step29_smoke.py
docker compose exec -T -e PYTHONPATH=/app backend python tests/test_step30_smoke.py
docker compose exec -T -e PYTHONPATH=/app backend python tests/test_step31_e2e.py
```

Các scripts thao tác dữ liệu kiểm thử và tự cleanup. Nên chạy trên database local/dev, không chạy trên database production.

## Demo data tùy chọn

Utility `backend/scripts/seed_demo.py` tạo bộ dữ liệu demo idempotent. Password phải được truyền tạm thời qua environment, không được ghi vào repository. Xem quy trình tại [DEMO_GUIDE.md](DEMO_GUIDE.md).

## Camera QR

Browser phải được cấp quyền camera. Camera thường chỉ khả dụng trên HTTPS hoặc `localhost` secure context; khi truy cập qua HTTP bằng LAN IP, browser có thể chặn camera. Staff luôn có thể dùng manual ticket code làm fallback.

## Bước tiếp theo

Nếu service không healthy hoặc frontend không gọi được API, xem [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
