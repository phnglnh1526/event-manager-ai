# Event Manager AI v1.0.0

Release đầu tiên hoàn chỉnh cho phạm vi đồ án học phần.

## Nội dung chính

- Authentication bằng JWT, bcrypt và backend RBAC cho bốn role.
- Event, Speaker và Schedule/Session Management.
- Registration lifecycle, Ticket tự động và protected QR.
- Staff Check-in bằng camera scanner hoặc manual ticket code.
- Feedback, Statistics/Analytics và Announcement.
- AI Feedback Summary và AI Announcement Draft ở Mock/OpenAI Mode.
- Attendee, Staff và Management workspaces.
- Docker Compose setup, regression/E2E tests và Documentation Pack.

## Cách chạy

Xem [README.md](README.md) và [docs/SETUP.md](docs/SETUP.md).

## Phạm vi và giới hạn

- Đây là academic project scope, không tuyên bố production-grade tuyệt đối.
- Chưa có payment, Event–Staff assignment, email delivery hoặc seat booking.
- Authentication hiện dùng access token, chưa có refresh-token/revocation flow.
- Schema được khởi tạo bằng SQLAlchemy `create_all()`, chưa có migration system như Alembic.
- OpenAI Mode phụ thuộc API key, model access và external connectivity; Mock Mode dùng cho local test/demo.
- AI output chỉ mang tính hỗ trợ; Announcement draft cần user review và thao tác save/publish riêng.

## Release verification

- Docker no-cache build: PASS.
- Frontend `npm ci` và production build: PASS.
- Production npm audit: 0 vulnerabilities.
- Regression/E2E scripts Step 16, 18, 19, 29, 30, 31: PASS.
- API, database, Swagger và OpenAPI health: PASS.
- Database schema: 9 expected tables; persistence after restart/down-up: PASS.

Chi tiết release checklist tại [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md).
