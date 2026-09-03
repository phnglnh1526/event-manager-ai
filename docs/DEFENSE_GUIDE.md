# Final Defense Guide

Tài liệu này là kịch bản nói và trình bày cho đồ án **Event Manager AI**. Nội dung bám theo code, OpenAPI và Documentation Pack hiện tại; không mô tả feature chưa tồn tại.

## 1. Thông điệp cốt lõi

Event Manager AI tập trung các nghiệp vụ quản lý Event, Speaker, Schedule, Registration, Ticket/QR, CheckIn, Feedback, Analytics và Announcement trong một hệ thống. Ba chức năng AI hỗ trợ tóm tắt Feedback, soạn Announcement draft và hỏi đáp theo Event context; mọi authorization và quyết định nghiệp vụ vẫn nằm ở backend.

### Tóm tắt 10 giây

> Event Manager AI là hệ thống web quản lý vòng đời sự kiện từ lập lịch, đăng ký, vé QR, check-in đến phản hồi và Analytics, đồng thời dùng AI để tổng hợp Feedback, soạn thông báo và hỏi đáp theo Event context.

### Tóm tắt 30 giây

> Đề tài của nhóm là Event Manager AI, một ứng dụng web quản lý sự kiện theo bốn role: Admin, Organizer, Staff và Attendee. Hệ thống quản lý Event, Speaker, Schedule, Registration, Ticket QR, CheckIn, Feedback, Analytics và Announcement. Ba chức năng AI là Feedback Summary, Announcement Draft và Event AI Chatbot; AI chỉ hỗ trợ nội dung/hỏi đáp theo Event context, không quyết định nghiệp vụ. Hệ thống dùng React, FastAPI, MySQL và Docker Compose.

### Tóm tắt kỹ thuật 1 phút

> Frontend là React SPA chạy bằng Vite và gọi REST API bằng Bearer JWT. Backend FastAPI chịu trách nhiệm authentication, RBAC, Event ownership, validation, business rules, SQLAlchemy access và AI integration. MySQL 8 lưu 9 bảng nghiệp vụ; Registration, Ticket và CheckIn được tách để thể hiện lifecycle và attendance rõ ràng. Docker Compose đóng gói ba service database, backend và frontend. AI chạy ở backend theo `AI_MODE=mock` hoặc `AI_MODE=openai`; browser không nhận OpenAI key. Backend tải current User từ database ở protected request, nên role trong database mới là nguồn phân quyền chính.

## 2. Kịch bản mở đầu 30–45 giây

> Kính chào thầy cô. Nhóm em xin trình bày đề tài Event Manager AI — hệ thống quản lý sự kiện tích hợp AI. Trong một sự kiện, thông tin về lịch trình, người tham dự, vé, check-in và phản hồi thường nằm ở nhiều nơi, khiến việc theo dõi trở nên rời rạc. Nhóm xây dựng một hệ thống tập trung các nghiệp vụ này trong cùng một luồng, từ lúc tạo Event đến khi tổng hợp kết quả. AI hỗ trợ ba chức năng: đọc Feedback, soạn Announcement và hỏi đáp theo Event context; AI không thay thế người quản lý hay business rules.

## 3. Kịch bản 5 phút

### 0:00–0:35 — Vấn đề và mục tiêu

> Event Manager AI giải quyết việc quản lý dữ liệu sự kiện bị phân tán và khó theo dõi xuyên suốt. Mục tiêu là quản lý vòng đời Event, Speaker và Schedule; hỗ trợ attendee đăng ký và nhận Ticket QR; hỗ trợ Staff check-in; sau đó thu Feedback, tính Analytics và dùng AI hỗ trợ tổng hợp nội dung.

### 0:35–1:05 — Scope và roles

> Hệ thống có bốn role. Admin quản lý mọi Event; Organizer chỉ quản lý Event mình sở hữu; Staff chỉ vận hành check-in; Attendee xem Event đã publish, đăng ký, xem Ticket, Feedback và Announcement. Nhóm chủ động không đưa payment, bán vé, seating, email campaign hay CRM vào scope để tập trung làm đúng core lifecycle.

### 1:05–1:40 — Kiến trúc

> Kiến trúc gồm React frontend, FastAPI backend và MySQL 8. Frontend gọi REST API kèm JWT. Backend xử lý authentication, authorization, business rules, database và AI. Docker Compose tạo cùng môi trường cho cả nhóm. Khi dùng OpenAI, chỉ backend gọi API; key không đi xuống browser.

### 1:40–2:15 — Dữ liệu và lifecycle

> Database có 9 bảng. Quan hệ quan trọng nhất là User và Event tạo Registration; Registration sinh một Ticket; Ticket có tối đa một CheckIn; User đã check-in mới được Feedback. Cancel không xóa Registration mà đổi sang `CANCELLED`, Ticket thành `VOID`; đăng ký lại tái sử dụng row và Ticket cũ. Điều này giữ lịch sử và giúp thống kê chính xác.

### 2:15–4:25 — Demo rút gọn

> Đầu tiên, với vai trò Admin, em chọn Demo Event và cho thấy Speaker cùng Schedule đã được quản lý theo đúng Event. Tiếp theo, Attendee xem Event `PUBLISHED`, đăng ký và nhận Ticket QR tự động. Staff chọn đúng Event rồi quét QR; nếu camera không sẵn sàng, nhập ticket code thủ công vì cả hai cách dùng cùng CheckIn API. Sau CheckIn, Attendee gửi Feedback. Cuối cùng, Admin xem số đăng ký, attendance, rating distribution và gọi AI Feedback Summary. Ở Announcement, AI chỉ điền title và content; người dùng vẫn phải review rồi Save Draft hoặc Publish.

### 4:25–5:00 — Kết luận

> Nhóm đã hoàn thành core lifecycle từ Event đến Analytics, với RBAC cho bốn role, Docker cho môi trường chạy thống nhất và ba AI feature. Announcement Draft vẫn có human-in-the-loop; chatbot chỉ trả lời theo Event context. Nếu mở rộng, nhóm ưu tiên Event–Staff assignment, email notification, refresh-token authentication, database migration và reporting nâng cao. Em xin cảm ơn thầy cô và sẵn sàng trả lời câu hỏi.

## 4. Kịch bản khuyến nghị 7 phút

### 0:00–0:40 — Giới thiệu

Dùng nguyên đoạn mở đầu ở phần 2.

### 0:40–1:20 — Vấn đề, mục tiêu, scope

> Nhóm tập trung vào năm vấn đề: dữ liệu Event và Schedule dễ phân tán; khó biết ai đang đăng ký và đã check-in; Feedback nhiều khó đọc; soạn thông báo mất thời gian; và người quản lý cần dashboard tổng hợp. Vì vậy hệ thống bao phủ Event, Speaker, Schedule, Registration, Ticket QR, CheckIn, Feedback, Analytics và Announcement. Payment, seat booking, email campaign và advanced CRM được loại khỏi phạm vi có chủ đích để kiểm soát độ phức tạp của đồ án.

### 1:20–2:05 — Actors và authorization

> Admin có quyền rộng trên mọi Event. Organizer có gần cùng nghiệp vụ quản lý nhưng chỉ trên Event do mình sở hữu; ownership được kiểm tra ở backend. Staff chỉ có Check-in Workspace cho Event `PUBLISHED`, không có Event CRUD. Attendee có portal riêng để browse Event, đăng ký, hủy hoặc đăng ký lại, xem Ticket QR, gửi Feedback sau CheckIn và đọc Announcement. AI không phải actor vì nó không chủ động bắt đầu workflow; nó là service nội bộ được user gọi qua backend.

### 2:05–2:50 — Kiến trúc và security

> Browser chạy React SPA. Mọi dữ liệu đi qua FastAPI REST API; JWT được frontend giữ trong `sessionStorage` và gửi qua Authorization header. Backend xác minh token rồi tải User từ database, nên không chỉ tin role claim cũ trong token. Password được hash bằng bcrypt, role và ownership được bảo vệ ở backend. SQLAlchemy làm việc với MySQL. Ba service được Docker Compose kết nối; trong mạng Compose, backend gọi database bằng hostname `db`.

### 2:50–3:35 — Database và lifecycle

> Database có 9 bảng: users, events, speakers, schedules, registrations, tickets, checkins, feedbacks và announcements. Speaker không phải User vì Speaker là dữ liệu nội dung và không cần login. Schedule trong model tương ứng với Session trên UI. Registration–Ticket và Ticket–CheckIn đều là quan hệ một-một theo unique constraint. Cancel là soft lifecycle: Registration thành `CANCELLED`, Ticket thành `VOID`; re-register đưa chúng trở lại active mà không tạo bản ghi trùng.

### 3:35–5:50 — Demo master flow

**ADMIN:**

> Với Admin, em chọn Demo Event. Hệ thống hiển thị đúng context của Event trước khi quản lý Speaker hoặc Schedule. Session phải nằm trong thời gian Event; đây là validation ở cả frontend và backend.

**ATTENDEE:**

> Với Attendee, chỉ Event `PUBLISHED` được hiển thị. Khi đăng ký, backend kiểm tra capacity trong transaction và tạo Ticket `ACTIVE` tự động. QR chỉ chứa ticket code, không chứa email hoặc thông tin cá nhân.

**STAFF:**

> Staff chọn Event rồi scan QR. Scanner decode ticket code và gọi CheckIn API. Backend xác minh Event, Registration, Ticket và duplicate. Ticket vẫn `ACTIVE`; attendance được lưu bằng CheckIn record để hai khái niệm không bị trộn lẫn.

**FEEDBACK, ANALYTICS, AI:**

> Sau CheckIn, Attendee mới có thể Feedback. Admin refresh Analytics để xem capacity, registration, attendance và rating. AI Feedback Summary nhận aggregate cùng rating/comment cần thiết và trả summary, strengths, issues, suggestions. AI Announcement Draft nhận purpose, key points, tone và Event context, nhưng không tự save hoặc publish. Event AI Chatbot chỉ dùng Event, Speaker và Schedule đã được cấp quyền để trả lời. Trong demo ổn định, nhóm dùng Mock Mode và nói rõ đây không phải OpenAI thật.

### 5:50–6:30 — Testing và reliability

> Hệ thống đã có smoke/regression scripts cho role, ownership, lifecycle, AI error handling và E2E flow từ Event đến Statistics. Docker health kiểm tra database, backend và frontend. Các conflict như duplicate CheckIn trả 409; dữ liệu cross-event trả 404 để hạn chế information leakage.

### 6:30–7:00 — Kết luận

> Kết quả là một hệ thống quy mô vừa nhưng có luồng nghiệp vụ hoàn chỉnh, phân quyền rõ, dữ liệu quan hệ nhất quán và AI được đặt đúng vai trò hỗ trợ. Hướng phát triển là Event–Staff assignment, notifications, refresh token, migration system và richer reporting. Nhóm em xin cảm ơn thầy cô.

## 5. Kịch bản 8–10 phút

Dùng kịch bản 7 phút và mở rộng ba đoạn sau:

### Mở rộng kiến trúc — thêm 45 giây

> Việc tách frontend và backend giúp mỗi phần có trách nhiệm rõ: React tập trung vào workspace, state và tương tác; FastAPI giữ toàn bộ authorization và business logic. OpenAPI/Swagger giúp kiểm tra contract. Đây là modular monolith với frontend tách riêng, phù hợp scope vừa và dễ debug hơn microservices.

### Mở rộng database — thêm 60 giây

> Database dùng FK và unique constraint để bảo vệ integrity. `registration(event_id,user_id)` ngăn đăng ký trùng; `ticket.registration_id` unique bảo đảm một Ticket cho một Registration; `checkin.ticket_id` unique ngăn attendance trùng; `feedback(event_id,user_id)` unique giới hạn một Feedback. Event delete cascade related records; Speaker delete đặt `speaker_id` của Schedule thành null để giữ lịch; Announcement creator delete cũng giữ Announcement.

### Mở rộng negative demo/testing — thêm 45–75 giây

> Có thể thử scan cùng Ticket lần hai để cho thấy backend trả conflict thay vì tạo attendance trùng. Hoặc nhập Session ngoài Event range để cho thấy validation. Chỉ chọn một negative case, sau đó quay lại luồng chính. Nhóm không claim coverage percentage vì chưa đo metric đó; kết luận dựa trên regression và E2E scripts thực tế.

Với các đoạn mở rộng, tổng thời gian khoảng 8 phút 30 giây đến 9 phút 30 giây.

## 6. Slide outline — 10 slides

### Slide 1 — Event Manager AI

**Trên slide:**

- Hệ thống quản lý sự kiện tích hợp AI.
- Tên học phần/nhóm: để nhóm tự điền.
- React · FastAPI · MySQL · Docker.

**Speaker note (20–30 giây):** dùng đoạn mở đầu, không giới thiệu dài từng thành viên.

### Slide 2 — Vấn đề và động lực

**Trên slide:**

- Dữ liệu Event/Schedule/attendee phân tán.
- Khó theo dõi registration và attendance.
- Feedback khó tổng hợp thủ công.
- Announcement cần soạn nhanh nhưng vẫn phải kiểm duyệt.

**Speaker note (30 giây):** nói đây là bài toán quy mô vừa, không phóng đại thành hệ thống enterprise.

### Slide 3 — Mục tiêu và phạm vi

**Trên slide:**

- Event → Registration → Ticket → CheckIn → Feedback → Analytics.
- Speaker, Schedule và Announcement.
- Ba AI feature hỗ trợ: Announcement Draft, Feedback Summary và Event AI Chatbot.
- Out of scope: payment, seating, email campaign, CRM.

**Speaker note (30–40 giây):** nhấn mạnh out-of-scope là quyết định kiểm soát phạm vi.

### Slide 4 — Actors và use cases

**Trên slide:**

- `ADMIN`: quản lý mọi Event và dữ liệu liên quan; Analytics, Announcement và ba AI use case.
- `ORGANIZER`: quản lý own Events, Speaker, Schedule, Registration list, Analytics, Announcement và ba AI use case.
- `STAFF`: chọn Event `PUBLISHED`, Manual/QR CheckIn và Event AI Chatbot; không có Event CRUD hoặc Analytics.
- `ATTENDEE`: xem Event `PUBLISHED`, register/cancel/re-register, Ticket/QR, Announcement, own Feedback và Event AI Chatbot.

**Speaker note (35 giây):** AI là internal component, không phải actor. Diagram chỉ có bốn actor người dùng; authorization và ownership scope được kiểm tra ở backend.

### Slide 5 — Kiến trúc

**Trên slide:**

- Browser → React → FastAPI → MySQL.
- FastAPI → Mock/OpenAI.
- REST + JWT; Docker Compose.

**Speaker note (40 giây):** giải thích separation of concerns và backend-only OpenAI key.

### Slide 6 — Database và lifecycle

**Trên slide:**

- 9 tables.
- Registration 1–1 Ticket 1–1 CheckIn.
- Soft cancel/re-register.
- FK, UNIQUE, CASCADE, SET NULL.

**Speaker note (40–45 giây):** không đọc columns; vẽ chuỗi quan hệ chính.

### Slide 7 — Business rules và security

**Trên slide:**

- Event ownership và RBAC.
- Capacity + transaction locking.
- QR chỉ chứa ticket code.
- Feedback sau CheckIn.
- bcrypt + JWT + protected resources.

**Speaker note (40 giây):** UI chỉ hỗ trợ UX; backend mới thực thi quyền.

### Slide 8 — AI integration

**Trên slide:**

- Feedback Summary.
- Announcement Draft.
- Event AI Chatbot.
- `AI_MODE=mock` / `AI_MODE=openai`.
- Structured output; human review trước khi lưu/publish draft.

**Speaker note (40 giây):** AI không quyết định login, publish, registration hay CheckIn.

### Slide 9 — Live demo

**Trên slide:**

- Admin Event/Schedule.
- Attendee Registration/Ticket.
- Staff CheckIn.
- Feedback → Analytics → AI.

**Speaker note:** “Tiếp theo, nhóm em chuyển trực tiếp sang hệ thống để chứng minh luồng nghiệp vụ xuyên suốt.” Sau câu này chuyển browser, không đọc slide.

### Slide 10 — Kết quả và hướng phát triển

**Trên slide:**

- Core lifecycle hoàn chỉnh.
- 4 roles, Docker-first, AI hỗ trợ.
- Regression/E2E verified.
- Future: Staff assignment, notification, refresh token, migrations, reporting.

**Speaker note (20–30 giây):** dùng đoạn kết, phân biệt rõ implemented và future work.

## 7. Live demo script có lời nói

### ADMIN

**NGƯỜI TRÌNH BÀY:**

> Đầu tiên em đăng nhập bằng vai trò Admin. Thay vì chỉ xem từng nút, em sẽ chứng minh Admin quản lý được toàn bộ context của một Event. Em chọn Demo Conference, xem Speaker và Schedule; Schedule panel luôn hiển thị Event hiện tại để tránh nhập Session vào sai khoảng thời gian.

**ACTION:** Login Admin → Events → chọn Demo Event → Speakers → Schedule.

**EXPECTED:** Management Workspace hiển thị đúng Event, Speaker và Session.

### ATTENDEE

**NGƯỜI TRÌNH BÀY:**

> Tiếp theo là Attendee. Portal chỉ hiển thị Event đã publish. Khi đăng ký, backend kiểm tra capacity và tự tạo Ticket. Attendee có thể xem Ticket và QR của chính mình; QR chỉ chứa ticket code.

**ACTION:** Logout → login Attendee → Events/Register nếu cần → My Registrations → My Tickets → QR.

**EXPECTED:** Registration `REGISTERED`, Ticket `ACTIVE`, QR PNG hiển thị.

### STAFF

**NGƯỜI TRÌNH BÀY:**

> Staff không chỉnh sửa Event mà chỉ thực hiện check-in. Em chọn đúng Event rồi quét QR. Nếu camera không hoạt động, em chuyển ngay sang mã vé thủ công; hai cách đều gọi cùng CheckIn endpoint và cùng business rules.

**ACTION:** Logout → login Staff → chọn Demo Event → scan QR hoặc manual code.

**EXPECTED:** Check-in successful; duplicate attempt trả conflict.

### FEEDBACK

**NGƯỜI TRÌNH BÀY:**

> Sau khi attendance đã được ghi nhận, Attendee mới được gửi Feedback. Quy tắc này giúp phản hồi đến từ người thực sự tham dự, không chỉ đăng ký.

**ACTION:** Login lại Attendee → Feedback → submit rating/comment.

**EXPECTED:** Feedback được tạo cho đúng Event.

### ANALYTICS VÀ AI

**NGƯỜI TRÌNH BÀY:**

> Quay lại Admin, Analytics đã phản ánh registration, attendance và rating. AI Feedback Summary hỗ trợ biến các comment thành summary, strengths, issues và suggestions. Trong demo này hệ thống dùng Mock Mode để ổn định, không giả là OpenAI thật. Với Announcement Draft, AI chỉ tạo title/content; người quản lý review rồi tự Save Draft hoặc Publish. Event AI Chatbot trả lời các câu hỏi về thời gian, địa điểm, diễn giả và lịch trình từ selected Event.

**ACTION:** Admin → Analytics refresh → Generate AI Summary → Announcements → Generate Draft → Event AI Chatbot → gửi một câu hỏi theo selected Event.

**EXPECTED:** Metrics cập nhật; cả ba AI response có source đúng mode; draft chưa tự lưu/publish; chatbot trả lời grounded theo Event context.

## 8. Negative demo tối đa hai case

1. **Duplicate CheckIn:** scan lại Ticket đã check-in; giải thích HTTP 409 và unique constraint.
2. **Session ngoài Event range:** nhập start/end nằm ngoài Event; giải thích frontend context và backend validation.

Không demo nhiều lỗi hơn vì làm loãng business flow.

## 9. Whiteboard preparation

### Architecture — vẽ trong 15 giây

```text
Browser → React → FastAPI → MySQL
                    ↓
              Mock / OpenAI
```

Nói: “React giữ UI state; FastAPI giữ auth, quyền và nghiệp vụ; MySQL giữ dữ liệu; AI là service hỗ trợ do backend gọi.”

### Database — vẽ trong 30 giây

```text
User ──owns──> Event ──> Speaker
                  └────> Schedule

User + Event → Registration → Ticket → CheckIn
User + Event → Feedback
Event → Announcement
```

Nhắc Registration–Ticket và Ticket–CheckIn là 1–0..1; không cần nhớ mọi column.

### Business flow — vẽ trong 10 giây

```text
Event → Register → Ticket → CheckIn → Feedback → Analytics → AI Summary
```

## 10. Phân chia nhóm ba người

Repository không có contributor history hoặc phân công được xác minh. Điền tên và đóng góp thật trước bảo vệ.

| Thành viên | Phần trình bày đề xuất | Thời lượng |
|---|---|---:|
| Member 1: `<tên>` | Mở đầu, problem/scope, actors, architecture | 2–2.5 phút |
| Member 2: `<tên>` | Database, backend rules, security, testing | 2–2.5 phút |
| Member 3: `<tên>` | Frontend workspace, AI, live demo, kết luận | 2.5–3 phút |

Câu chuyển mẫu:

- Member 1 → 2: “Tiếp theo, phần database, backend và các quy tắc đảm bảo tính nhất quán sẽ do Member 2 trình bày.”
- Member 2 → 3: “Sau phần xử lý dữ liệu, Member 3 sẽ trình bày cách các workflow được thể hiện trên giao diện, AI integration và demo trực tiếp.”
- Member 3 → kết luận: “Qua luồng vừa demo, nhóm đã chứng minh các module không hoạt động rời rạc mà nối thành một lifecycle hoàn chỉnh.”

Dù chia phần, cả ba người phải trả lời được architecture, 4 roles, quan hệ database, Registration/Ticket lifecycle, CheckIn và AI.

## 11. Những điểm tuyệt đối không nói sai

- AI không phải actor và không tự quyết định/publish.
- Mock Mode không phải OpenAI thật.
- Ticket vẫn `ACTIVE` sau CheckIn; attendance nằm ở CheckIn.
- Re-register tái sử dụng Registration và Ticket nếu đã tồn tại.
- Speaker không phải User; Schedule và Session là cùng khái niệm trong scope.
- Organizer authorization nằm ở backend, không chỉ là ẩn button frontend.
- Staff không có Event CRUD và chưa có Event–Staff assignment.
- Không có payment, email delivery, seat booking, refresh token, vector database, RAG platform hay persistent chat history.
- Không tuyên bố production-ready tuyệt đối hoặc test coverage chưa đo.
- Không trình chiếu password, API key, JWT, `.env`, DB credentials.

## 12. Kết luận 20–30 giây

> Event Manager AI đã hoàn thành core lifecycle từ quản lý Event đến Registration, Ticket QR, CheckIn, Feedback và Analytics cho bốn role. Docker giúp chạy đồng nhất, còn AI được tích hợp ở backend theo hướng hỗ trợ và có human review. Với phạm vi học phần, hệ thống ưu tiên nghiệp vụ rõ và dữ liệu nhất quán; các chức năng production nâng cao được xác định là hướng phát triển tiếp theo. Nhóm em xin cảm ơn thầy cô.

## 13. Tài liệu dùng khi luyện tập

- [Defense Q&A](DEFENSE_QA.md)
- [Demo Checklist](DEMO_CHECKLIST.md)
- [Architecture](ARCHITECTURE.md)
- [Modules](MODULES.md)
- [Demo Guide](DEMO_GUIDE.md)
