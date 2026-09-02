# Troubleshooting

## Docker không chạy

**Triệu chứng:** `docker compose` không kết nối daemon hoặc containers không xuất hiện.

```text
docker info
docker compose ps
```

Khởi động Docker Desktop/Docker Engine. Trên Windows, xác nhận Docker Desktop đang dùng Linux containers.

## Port 5173, 8000 hoặc 3306 bị chiếm

**Triệu chứng:** bind error khi `docker compose up`.

Windows PowerShell:

```powershell
Get-NetTCPConnection -LocalPort 5173,8000,3306 -ErrorAction SilentlyContinue
```

Linux/macOS:

```bash
lsof -i :5173
lsof -i :8000
lsof -i :3306
```

Dừng process/container đang chiếm port. Không cần đổi source nếu chỉ là conflict local tạm thời.

## Database không healthy

```text
docker compose ps
docker compose logs db
```

Kiểm tra root `.env` có đủ `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`. Nếu volume đã được khởi tạo bằng credentials cũ rồi `.env` bị đổi, MySQL không tự đổi account trong volume cũ. Ưu tiên dùng lại credentials tương ứng; chỉ xóa volume ở môi trường disposable và sau khi chấp nhận mất dữ liệu.

## Backend không kết nối được database

```text
docker compose logs backend
curl http://localhost:8000/api/health/database
```

Trong Compose, `MYSQL_HOST` phải là `db`, không phải `localhost`. `localhost` bên trong backend container trỏ về chính container backend.

Ngay sau một full restart có thể thấy một connection error thoáng qua nếu backend thử kết nối trong lúc MySQL khởi động; kiểm tra trạng thái hiện tại và health endpoint thay vì chỉ dựa vào một dòng log cũ.

## PyMySQL/MySQL 8 RSA error

MySQL 8 có thể dùng `caching_sha2_password`. Project đã pin `PyMySQL[rsa]`; hãy rebuild backend để bảo đảm dependency được cài:

```text
docker compose build --no-cache backend
docker compose up -d backend
```

Không cần downgrade MySQL.

## Backend không khởi động vì JWT config

`JWT_SECRET_KEY` không được rỗng, `JWT_ALGORITHM` phải là `HS256`, và `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` phải lớn hơn 0. Sửa root `.env`, rồi recreate backend:

```text
docker compose up -d --build backend
```

## Frontend không gọi được API

Kiểm tra:

1. http://localhost:8000/api/health trả 200.
2. `VITE_API_URL` là `http://localhost:8000` trong Compose.
3. Browser Network tab không báo CORS hoặc connection refused.
4. Frontend/backend containers đều healthy.

```text
docker compose logs frontend
docker compose logs backend
```

Vite đọc environment khi process khởi động; recreate frontend sau khi đổi URL.

## HTTP 401

Token thiếu, hết hạn hoặc không hợp lệ. Logout rồi login lại. Không chỉnh JWT thủ công và không paste token vào tài liệu/log screenshot.

## HTTP 403

403 thường là role, ownership, account inactive hoặc Feedback eligibility — không phải mọi 403 đều là login failure. Kiểm tra:

- Đúng role cho workflow.
- Organizer đang chọn Event của mình.
- Attendee đã check-in trước khi Feedback.

## HTTP 409

409 thể hiện lifecycle conflict, ví dụ Event chưa publish, Event full, registration/ticket inactive, duplicate registration/feedback/check-in hoặc cố cancel sau check-in. Đọc `detail` response trước khi coi là bug.

## QR image không tải

QR endpoint được bảo vệ và chỉ trả PNG khi own Ticket `ACTIVE` cùng Registration `REGISTERED`. Frontend phải gửi Bearer JWT, nhận Blob rồi tạo Object URL. Nếu UI hiện tại không tải được:

- Logout/login để refresh token.
- Kiểm tra Network response của `/api/tickets/me/{ticket_id}/qr`.
- Xác nhận Ticket chưa `VOID` và Registration chưa cancel.

Không mở protected QR endpoint trực tiếp trong tab không có Authorization header để kiểm thử UI flow.

## Camera không mở hoặc không scan

- Cấp camera permission cho browser.
- Đóng ứng dụng/tab khác đang giữ camera.
- Dùng `localhost` hoặc HTTPS. HTTP qua LAN IP thường không phải secure context.
- Chọn đúng Event trước khi scan.
- Dùng manual ticket code fallback nếu camera không khả dụng.

Camera và manual entry gọi cùng backend check-in rule.

## AI Mock Mode không hoạt động

Kiểm tra root `.env`:

```dotenv
AI_MODE=mock
```

Recreate backend và xem log:

```text
docker compose up -d --build backend
docker compose logs backend
```

Mock Mode không cần external API key. AI Feedback Summary vẫn cần written Feedback; nếu không có dữ liệu, API trả conflict theo thiết kế.

## OpenAI Mode lỗi 502/503

Kiểm tra:

- `AI_MODE=openai`.
- `OPENAI_API_KEY` tồn tại trong environment backend.
- `OPENAI_MODEL` được cấu hình.
- Máy có external connectivity và account/API project có quyền dùng model.

```text
docker compose up -d --build backend
docker compose logs backend
```

Không paste API key vào terminal output chia sẻ, issue, tài liệu hoặc screenshot. `503` thường là cấu hình thiếu; `502` là upstream hoặc structured response không hợp lệ.

## Session time validation fail

Schedule/Session phải có end sau start và nằm hoàn toàn trong `Event.start_time` đến `Event.end_time`. Kiểm tra selected Event ở đầu Schedule panel trước khi nhập thời gian. Các Session song song được phép; lỗi không phải do overlap.

## Feedback không khả dụng

Attendee cần:

1. Registration đang `REGISTERED`.
2. Ticket tương ứng.
3. CheckIn record.
4. Event `PUBLISHED` hoặc `COMPLETED`.

Nếu thiếu CheckIn, backend cố ý trả 403. Một User chỉ có một Feedback cho mỗi Event.

## Không thể cancel registration

- Nếu không có active registration, API trả 404.
- Nếu Ticket đã check-in, cancel bị từ chối 409 theo business rule.
- Nếu cancel thành công, registration thành `CANCELLED` và Ticket thành `VOID`.
- Register again tái sử dụng registration/Ticket và đưa Ticket về `ACTIVE`.

## Dữ liệu mất sau thao tác Docker

`docker compose down` giữ named volume. `docker compose down -v` xóa `mysql_data` và dữ liệu không thể khôi phục từ Docker volume đó. Không dùng `-v` nếu muốn giữ database.

## Clean rebuild

Chỉ dùng khi cache image/dependency nghi ngờ bị stale:

```text
docker compose build --no-cache
docker compose up -d
docker compose ps
```

Nếu vẫn lỗi, thu thập `docker compose ps` và log đúng service; loại bỏ secrets trước khi chia sẻ.
