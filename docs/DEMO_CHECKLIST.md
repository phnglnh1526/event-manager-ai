# Demo Checklist và Defense Cheat Sheet

## A. Checklist 24 giờ trước bảo vệ

- [ ] Chốt người nói từng slide và điền tên thật vào phân công.
- [ ] Mỗi thành viên luyện bản 7 phút và 15 câu MUST KNOW.
- [ ] Xác minh laptop, sạc, adapter/màn hình và chuột.
- [ ] Docker Desktop/Engine chạy ổn định.
- [ ] Chạy `docker compose up -d --build` trước, không rebuild sát giờ nếu không cần.
- [ ] `docker compose ps`: `db`, `backend`, `frontend` đều healthy.
- [ ] Frontend mở được tại http://localhost:5173.
- [ ] API health và DB health trả HTTP 200.
- [ ] Demo Event `EVENT MANAGER AI — Demo Conference 2026` tồn tại và `PUBLISHED`.
- [ ] Demo accounts login được bằng password tạm thời do nhóm chuẩn bị.
- [ ] Có một Ticket `ACTIVE` chưa CheckIn cho live demo.
- [ ] Có một Ticket đã CheckIn nếu muốn demo duplicate 409.
- [ ] Có attendee đủ điều kiện Feedback.
- [ ] Analytics có registration, attendance và Feedback data.
- [ ] Chọn `AI_MODE=mock` hoặc `openai`; biết rõ mode để nói đúng.
- [ ] Nếu OpenAI Mode: kiểm tra trước, không hiển thị key.
- [ ] Test QR authenticated image.
- [ ] Test camera permission trên đúng browser/localhost.
- [ ] Chuẩn bị manual ticket code trong clipboard an toàn, không đưa vào slide/repository.
- [ ] Tắt notification, chat, email popup và app không liên quan.
- [ ] Đóng `.env`, terminal có secrets và database client.
- [ ] Mở sẵn slide và frontend; Swagger chỉ mở khi cần trả lời kỹ thuật.
- [ ] Có bản local/offline của docs; không phụ thuộc Internet.
- [ ] Không có thao tác reset DB hoặc live coding trong kịch bản chính.

## B. Checklist 10 phút trước trình bày

```text
docker compose ps
```

- [ ] Cả ba services healthy.
- [ ] Frontend tab đang ở Login, không giữ role/session sai.
- [ ] Browser zoom và projector đọc được.
- [ ] Demo account sequence đã thống nhất: Admin → Attendee → Staff → Attendee → Admin.
- [ ] Đúng selected Event ở mọi workspace.
- [ ] Ticket live chưa bị người khác check-in.
- [ ] Manual code đã copy.
- [ ] Camera đã được cấp quyền hoặc quyết định dùng manual ngay từ đầu.
- [ ] AI output có đủ Feedback data.
- [ ] Đồng hồ bấm giờ sẵn sàng; người nhắc thời gian đã được phân công.

## C. Demo master sequence

| Bước | Role | Action | Câu nói chính | Expected |
|---:|---|---|---|---|
| 1 | `ADMIN` | Login, mở Demo Event | “Admin quản lý toàn bộ Event context.” | Event/Speaker/Schedule hiển thị |
| 2 | `ATTENDEE` | Register hoặc xem active registration | “Chỉ Event PUBLISHED cho đăng ký.” | `REGISTERED` |
| 3 | `ATTENDEE` | Mở Ticket/QR | “Ticket sinh tự động; QR chỉ có ticket code.” | Ticket `ACTIVE`, QR PNG |
| 4 | `STAFF` | Chọn Event, scan/manual | “Camera và manual dùng cùng API.” | Check-in success |
| 5 | `ATTENDEE` | Submit Feedback | “Chỉ attendee đã CheckIn được Feedback.” | Feedback created |
| 6 | `ADMIN` | Refresh Analytics | “Metrics lấy từ dữ liệu nghiệp vụ thật.” | Attendance/rating cập nhật |
| 7 | `ADMIN` | AI Summary | “Đây là Mock/OpenAI Mode đúng cấu hình.” | Structured insight |
| 8 | `ADMIN` | AI Announcement Draft | “AI chỉ tạo draft; user review/publish.” | Draft chưa tự lưu |

## D. Demo rút gọn 4–5 phút

1. Admin: Demo Event + Schedule.
2. Attendee: Registration + Ticket QR.
3. Staff: manual CheckIn nếu camera chậm.
4. Attendee: Feedback.
5. Admin: Analytics + một AI feature.

Nếu gần hết giờ, bỏ AI Announcement Draft trước; không bỏ CheckIn vì đó là mắt xích chính.

## E. Ba cấp fallback

### Plan A — Full live demo

- Camera QR.
- Core lifecycle đầy đủ.
- AI theo mode đã test.

### Plan B — Stable local demo

- Manual ticket code thay camera.
- `AI_MODE=mock` thay external OpenAI.
- Core application vẫn chạy hoàn toàn local bằng Docker.

Câu nói khi camera lỗi:

> Em chuyển sang phương án nhập mã vé thủ công, vì QR scanner và manual input sử dụng cùng CheckIn endpoint và cùng business rules.

Câu nói khi OpenAI không sẵn sàng:

> AI được thiết kế có Mock Mode để demo và test không phụ thuộc dịch vụ ngoài. Em xin nói rõ kết quả này là mock deterministic, không phải OpenAI thật.

### Plan C — Fatal Docker/browser issue

- Không rebuild hoặc sửa source trước lớp.
- Mở Documentation Pack, Architecture/ERD và Demo Guide local.
- Giải thích flow bằng whiteboard và kết quả verification đã chuẩn bị.
- Chỉ dùng screenshot thật đã có từ hệ thống nếu nhóm đã chuẩn bị; không tạo fake success screenshot.

## F. Xử lý sự cố nhanh

| Sự cố | Phản ứng trong 10–20 giây |
|---|---|
| Camera permission | Chuyển manual code ngay |
| Duplicate Ticket | Giải thích 409/unique constraint như negative demo |
| OpenAI/network | Dùng Mock Mode đã cấu hình; không troubleshoot Internet |
| Login fail | Chuyển account đã verify; không reset DB live |
| Browser state cũ | Logout/login hoặc reload đúng tab |
| Container vừa restart | `docker compose ps`; chờ healthy, không rebuild |
| Cosmetic UI bug | Bỏ qua và tiếp tục business flow |
| Sai selected Event | Dừng, chọn đúng Event context rồi mới tiếp tục |

## G. One-page defense cheat sheet

### Key numbers

- **4 roles:** `ADMIN`, `ORGANIZER`, `STAFF`, `ATTENDEE`.
- **9 tables:** users, events, speakers, schedules, registrations, tickets, checkins, feedbacks, announcements.
- **2 AI features:** Feedback Summary, Announcement Draft.
- **4 Event statuses:** `DRAFT`, `PUBLISHED`, `CANCELLED`, `COMPLETED`.
- **2 Registration statuses:** `REGISTERED`, `CANCELLED`.
- **2 Ticket statuses:** `ACTIVE`, `VOID`.
- **2 Announcement statuses:** `DRAFT`, `PUBLISHED`.

### Architecture

```text
Browser → React/Vite → REST + JWT → FastAPI → SQLAlchemy → MySQL 8
                                      ↓
                                Mock / OpenAI
```

### Main flow

```text
Event → Registration → Ticket/QR → CheckIn → Feedback → Analytics → AI Summary
```

### Rules phải nhớ

- Admin: mọi Event; Organizer: own Event; Staff: CheckIn; Attendee: own lifecycle.
- AI không phải actor, không quyết định nghiệp vụ và không auto-publish.
- Speaker không phải User; Schedule = Session trong scope.
- Session phải nằm trong Event time; parallel Session được phép.
- Cancel giữ Registration, Ticket → `VOID`; re-register tái sử dụng và Ticket → `ACTIVE`.
- Ticket vẫn `ACTIVE` sau CheckIn; CheckIn record là attendance source.
- QR chỉ chứa ticket code; backend luôn validate lại.
- Feedback cần Registration + Ticket + CheckIn và Event status phù hợp.
- Organizer ownership và RBAC nằm backend.
- Attendance rate = checked-in / registered × 100%; denominator 0 trả 0.

### Security phải nhớ

- bcrypt password hashing.
- JWT access token; frontend `sessionStorage`; backend reload User DB.
- Role DB là source of truth; ownership backend.
- OpenAI key chỉ backend environment.
- Không claim production-grade tuyệt đối.

### 5 câu nguy hiểm

1. **AI là actor?** Không, là supporting service.
2. **Ticket ACTIVE sau CheckIn là bug?** Không, attendance ở CheckIn.
3. **Speaker sao không là User?** Không cần login/authentication.
4. **Re-register có Ticket mới?** Không nếu Ticket tồn tại; tái sử dụng.
5. **Ẩn button có bảo vệ Organizer?** Không; backend ownership mới bảo vệ.

### Khi không biết

> Phần đó hiện chưa nằm trong phạm vi đồ án. Nếu mở rộng, nhóm sẽ xác định yêu cầu và đánh giá trade-off trước khi chọn giải pháp; hiện tại nhóm không muốn khẳng định một capability chưa triển khai.

## H. Team handoff

Điền trước bảo vệ, không invent đóng góp:

| Người | Contribution thực tế | Slide | Demo role | Backup question area |
|---|---|---|---|---|
| `<Member 1>` | `<điền theo commit/công việc thật>` | 1–5 | Admin | Architecture/RBAC |
| `<Member 2>` | `<điền theo commit/công việc thật>` | 6–7 | Staff | DB/lifecycle/security |
| `<Member 3>` | `<điền theo commit/công việc thật>` | 8–10 | Attendee/AI | Frontend/AI/demo |

Nếu được hỏi “Nhóm làm việc chung code thế nào?”, chỉ mô tả branch/commit/pull request nếu nhóm thực sự đã dùng quy trình đó. Repository hiện tại không có commit history được xác minh trong workspace này, nên tài liệu không đưa ra claim cụ thể.

## I. Điều không để trên màn hình

- `.env` hoặc environment inspector.
- Password demo/personal.
- `OPENAI_API_KEY`, JWT secret hoặc active JWT.
- Database credentials/root console.
- Ticket code ngoài ticket dùng cho demo.
- Chat/email/notification cá nhân.
- Source code đang chỉnh sửa.
