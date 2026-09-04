# Demo Guide

Mục tiêu: trình bày một business flow liên tục trong khoảng **4–7 phút**, không cần click toàn bộ feature.

## 1. Precheck trước buổi trình bày

```text
docker compose up -d --build
docker compose ps
```

Xác nhận:

- `db`, `backend`, `frontend` đều healthy.
- Frontend mở tại http://localhost:5173.
- API và database health đều trả `status: ok`.
- Biết rõ mode AI đang dùng; nên dùng `AI_MODE=mock` để demo local ổn định.
- Có một Event demo `PUBLISHED`, account đủ role và một Ticket `ACTIVE` chưa check-in.
- Camera được cấp quyền hoặc đã chuẩn bị manual ticket code fallback.
- Đã logout các session cũ và đóng thông tin nhạy cảm trên màn hình.

## 2. Chuẩn bị demo accounts

Repository có utility `backend/scripts/seed_demo.py`. Utility này dùng các email disposable dưới domain `@event-demo.com`, nhưng **không chứa password**. Người demo tự đặt một password tạm thời tối thiểu 8 ký tự qua environment.

```powershell
docker cp backend/scripts/seed_demo.py event-manager-backend:/app/seed_demo.py
docker compose exec -T -e PYTHONPATH=/app -e DEMO_PASSWORD="<temporary-demo-password>" backend python seed_demo.py
```

Các account được code xác minh:

| Role | Email | Ghi chú |
|---|---|---|
| `ADMIN` | `admin@event-demo.com` | Quản lý Demo Event |
| `STAFF` | `staff@event-demo.com` | Check-in workflow |
| `ATTENDEE` | `attendee7@event-demo.com` | Có active, unchecked Ticket ban đầu |

Seed còn tạo `attendee1`–`attendee8`; attendee 1–6 đã check-in, attendee 8 có registration cancelled/Ticket `VOID`. Seed là idempotent đối với Demo Event và refresh password của các demo account hiện có.

> Password cố ý không được ghi trong tài liệu. Chỉ dùng password demo tạm thời, không dùng personal password và không trình chiếu `.env`, JWT, database credentials hoặc ticket code không cần thiết.

## 3. Main demo flow

### A. ADMIN — 60–90 giây

1. Login bằng account `ADMIN`.
2. Mở **Analytics** để giới thiệu dashboard theo Event.
3. Mở **Events** và chọn `EVENT MANAGER AI — Demo Conference 2026`.
4. Lần lượt chỉ nhanh:
   - Overview và Event status/capacity.
   - Speakers.
   - Schedule với Session nằm trong thời gian Event.
   - Registrations.
5. Nhấn mạnh `ADMIN` xem mọi Event; `ORGANIZER` chỉ Event mình sở hữu.

### B. ATTENDEE — 45–60 giây

1. Logout và login `attendee7@event-demo.com`.
2. Mở **Events** và chỉ Event `PUBLISHED`.
3. Nếu dùng dữ liệu khác chưa đăng ký: nhấn Register; với seed mặc định attendee7 đã `REGISTERED`.
4. Mở **My Registrations**, rồi **My Tickets**.
5. Mở QR của Ticket `ACTIVE` và giải thích QR tải qua protected endpoint, payload là `ticket_code`.

### C. STAFF CHECK-IN — 45–60 giây

1. Login `staff@event-demo.com`.
2. Chọn đúng Demo Event trong Staff Check-in Workspace.
3. Quét QR bằng camera.
4. Nếu camera không sẵn sàng, nhập ticket code thủ công.
5. Cho xem thông báo check-in thành công. Ticket vẫn `ACTIVE`; CheckIn record là attendance source.

### D. FEEDBACK — 30–45 giây

1. Login lại attendee7.
2. Mở **Feedback**.
3. Gửi rating và comment cho Demo Event vừa check-in.
4. Giải thích Feedback chỉ khả dụng sau Registration + Ticket + CheckIn hợp lệ.

### E. ANALYTICS VÀ AI — 60–90 giây

1. Login lại `ADMIN`.
2. Refresh **Analytics** và chỉ các nhóm metric:
   - Capacity/registrations.
   - Attendance.
   - Feedback rating/distribution.
3. Generate **AI Feedback Summary**.
4. Nếu dùng mock, nói rõ: “Ứng dụng đang chạy AI Mock Mode để demo ổn định.”
5. Mở **Announcements**, chọn Demo Event và Generate AI Draft.
6. Nhấn mạnh AI chỉ điền title/content; người dùng review rồi tự Save Draft hoặc Publish.
7. Mở **Ask AI** của đúng Demo Event và hỏi lần lượt:
   1. `Thời gian bắt đầu sự kiện là bao giờ?`
   2. `Sự kiện được tổ chức ở đâu?`
   3. `Có những diễn giả nào?`
   4. `Lịch trình sự kiện gồm những gì?`
8. Xác nhận badge hiển thị đúng **Mock Mode** hoặc **OpenAI Mode**. Khi đổi Event, hội thoại cũ phải được xóa.

Demo script ngắn:

> Hệ thống của nhóm có ba chức năng AI. Thứ nhất là sinh nội dung thông báo. Thứ hai là tóm tắt phản hồi. Thứ ba là chatbot hỏi đáp về sự kiện. Chatbot lấy dữ liệu sự kiện, diễn giả và lịch trình từ hệ thống, sau đó chỉ dùng các dữ liệu này để trả lời câu hỏi của người dùng.

## 4. Fallbacks

| Vấn đề | Fallback trong demo |
|---|---|
| Camera không mở | Dùng manual ticket code trong Staff Workspace |
| OpenAI/network không sẵn sàng | Dùng `AI_MODE=mock`, recreate backend và nói rõ là Mock Mode |
| Browser giữ session/state cũ | Logout/login; nếu cần reload tab |
| Service lỗi | `docker compose ps`, sau đó `docker compose logs <service>` |
| Ticket đã check-in | Seed lại password không reset CheckIn; dùng một attendee/Ticket chưa check-in hoặc chuẩn bị data trước |
| Demo Event không có dữ liệu | Chạy seed utility trước buổi trình bày |

## 5. Những điều không nên làm khi trình bày

- Không gọi Mock Mode là OpenAI thật.
- Không hiển thị password, API key, JWT, `.env` hoặc MySQL credentials.
- Không claim payment, email, seat booking, Event–Staff assignment, vector database, RAG platform hoặc long-term chat memory.
- Không mất thời gian CRUD mọi record; ưu tiên một luồng xuyên suốt từ Event đến Analytics/AI.

## 6. Checklist cuối

- [ ] Docker services healthy.
- [ ] Đúng AI mode.
- [ ] Demo accounts login được bằng password tạm thời đã chuẩn bị.
- [ ] Event `PUBLISHED` và đúng selected Event ở mọi workspace.
- [ ] Chatbot hiển thị đúng Event context, đúng AI mode và bốn câu hỏi gợi ý.
- [ ] Active unchecked Ticket có sẵn.
- [ ] Camera permission hoặc manual fallback.
- [ ] Không có secret trên màn hình.
