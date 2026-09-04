# Software Requirements Specification — Event Manager AI v1.1.0

## 1. Document purpose and source of truth

Tài liệu này đặc tả hệ thống Event Manager AI v1.1.0 theo implementation hiện tại. Source of truth gồm SQLAlchemy models, FastAPI routes/services, runtime MySQL schema và Final ERD. Tài liệu không đề xuất migration hoặc feature mới.

Phạm vi hệ thống gồm quản lý Event, Speaker, Schedule, Registration, Ticket/QR, CheckIn, Feedback, Statistics, Announcement và ba chức năng AI hỗ trợ.

## 2. System overview

### 2.1 Actors

Hệ thống có đúng bốn business actors:

- `ADMIN`
- `ORGANIZER`
- `STAFF`
- `ATTENDEE`

Speaker là dữ liệu nội dung thuộc Event, không phải User và không đăng nhập. AI là internal supporting service, không phải actor.

### 2.2 Runtime architecture

- React/Vite frontend cung cấp Management, Staff và Attendee workspaces.
- FastAPI backend thực thi authentication, RBAC, ownership và business rules.
- SQLAlchemy/PyMySQL truy cập MySQL 8.
- Docker Compose vận hành `frontend`, `backend` và `db` services.
- Browser chỉ gọi backend; OpenAI key không được gửi ra frontend.

### 2.3 Persistent data

Database có đúng chín bảng:

1. `users`
2. `events`
3. `speakers`
4. `schedules`
5. `registrations`
6. `tickets`
7. `checkins`
8. `feedbacks`
9. `announcements`

Không có bảng AI, FAQ, ChatMessage, Embedding hoặc persistent chat history.

### 2.4 AI capabilities

Hệ thống có ba chức năng AI:

1. AI Announcement Draft.
2. AI Feedback Summary.
3. Event AI Chatbot.

Mỗi chức năng hỗ trợ `AI_MODE=mock` và `AI_MODE=openai` qua backend.

## 3. Functional requirements

### 3.1 Authentication and authorization

| ID | Requirement |
|---|---|
| `FR-AUTH-01` | Hệ thống cho phép đăng ký account công khai và luôn gán role `ATTENDEE`. |
| `FR-AUTH-02` | Hệ thống cho phép login bằng email/password và trả JWT access token. |
| `FR-AUTH-03` | Password phải được hash bằng bcrypt; plaintext password không được lưu. |
| `FR-AUTH-04` | Protected API phải xác minh JWT, tải lại User từ database và chặn account inactive. |
| `FR-AUTH-05` | Mọi authenticated User được xem và cập nhật own full name/email; role, active status và User ID là read-only trong Profile. |
| `FR-AUTH-06` | Mọi authenticated User được đổi own password sau khi xác minh current password; password mới dùng cùng policy và bcrypt hiện hành. |
| `FR-AUTH-07` | Profile endpoint phải từ chối protected/extra fields và chỉ tác động authenticated current User. |
| `FR-USR-01` | Chỉ ADMIN được list, tạo và cập nhật tên, email, role, trạng thái User. |
| `FR-USR-02` | User response không được lộ password hash; không có hard delete hoặc password reset trong scope. |
| `FR-USR-03` | Hệ thống phải chặn Admin tự deactivate, tự hạ role và thao tác làm mất active Admin cuối cùng. |
| `FR-USR-04` | Thay đổi role/status trong database phải có hiệu lực với JWT đã cấp trước đó. |
| `FR-RBAC-01` | Backend phải thực thi role guard; frontend không phải lớp phân quyền duy nhất. |
| `FR-RBAC-02` | Organizer chỉ truy cập management data của Event do mình sở hữu. |

### 3.2 Event, Speaker and Schedule

| ID | Requirement |
|---|---|
| `FR-EVT-01` | ADMIN quản lý mọi Event; ORGANIZER quản lý own Event. |
| `FR-EVT-02` | Event hỗ trợ CRUD và statuses `DRAFT`, `PUBLISHED`, `CANCELLED`, `COMPLETED`. |
| `FR-EVT-03` | Event phải có `end_time > start_time` và capacity dương. |
| `FR-SPK-01` | ADMIN/owner ORGANIZER quản lý Speaker trong Event. |
| `FR-SPK-02` | Speaker là entity riêng, luôn thuộc một Event và không có authentication. |
| `FR-SCH-01` | ADMIN/owner ORGANIZER quản lý Schedule/Session trong Event. |
| `FR-SCH-02` | Schedule phải nằm trong Event time range khi create/update. |
| `FR-SCH-03` | Schedule có thể không có Speaker; nếu có, Speaker phải thuộc cùng Event. |
| `FR-SCH-04` | Parallel/overlapping sessions được phép. |

Implementation note: update Event hiện chỉ kiểm tra `end_time > start_time`; việc thu hẹp Event không revalidate các Schedule đã tồn tại.

### 3.3 Registration, Ticket and QR

| ID | Requirement |
|---|---|
| `FR-REG-01` | ATTENDEE chỉ đăng ký Event `PUBLISHED`. |
| `FR-REG-02` | Mỗi Event/User có tối đa một Registration. |
| `FR-REG-03` | Capacity chỉ đếm Registration `REGISTERED`. |
| `FR-REG-04` | Cancel đổi Registration sang `CANCELLED` và Ticket sang `VOID`. |
| `FR-REG-05` | Re-register tái sử dụng Registration và Ticket hiện hữu, rồi chuyển lại trạng thái active. |
| `FR-REG-06` | Registration đã CheckIn không thể cancel. |
| `FR-TKT-01` | Registration mới tự động được cấp Ticket; client không có Ticket create/update/delete API. |
| `FR-TKT-02` | Mỗi Registration có tối đa một Ticket và mỗi `ticket_code` là unique. |
| `FR-QR-01` | QR được tạo on-demand từ `ticket_code`, không lưu trực tiếp trong Registration. |
| `FR-QR-02` | QR chỉ được trả khi Registration `REGISTERED` và Ticket `ACTIVE`. |

### 3.4 CheckIn and Feedback

| ID | Requirement |
|---|---|
| `FR-CHK-01` | ADMIN, ORGANIZER và STAFF có thể thực hiện CheckIn trong scope được phép. |
| `FR-CHK-02` | CheckIn chỉ áp dụng cho Event `PUBLISHED`, active Registration và active Ticket thuộc đúng Event. |
| `FR-CHK-03` | Mỗi Ticket có tối đa một CheckIn; duplicate phải bị chặn. |
| `FR-CHK-04` | CheckIn record là attendance source; Ticket vẫn `ACTIVE` sau CheckIn. |
| `FR-FDB-01` | ATTENDEE chỉ Feedback sau khi có Registration `REGISTERED`, Ticket và CheckIn hợp lệ. |
| `FR-FDB-02` | Event phải `PUBLISHED` hoặc `COMPLETED` để nhận Feedback. |
| `FR-FDB-03` | Mỗi Event/User có tối đa một Feedback; rating từ 1 đến 5. |
| `FR-FDB-04` | ATTENDEE có thể xem/sửa/xóa Feedback của mình; ADMIN/owner ORGANIZER xem Feedback Event. |

### 3.5 Statistics and Announcements

| ID | Requirement |
|---|---|
| `FR-STA-01` | ADMIN/owner ORGANIZER xem capacity, registration, attendance và Feedback statistics. |
| `FR-STA-02` | Statistics phải phân biệt lifecycle total, `REGISTERED` và `CANCELLED`. |
| `FR-STA-03` | Feedback statistics gồm total, average và rating distribution 1–5. |
| `FR-ANN-01` | ADMIN/owner ORGANIZER CRUD Announcement trong Event. |
| `FR-ANN-02` | Announcement hỗ trợ `DRAFT` và `PUBLISHED`; publish gán `published_at`. |
| `FR-ANN-03` | ATTENDEE chỉ thấy Announcement `PUBLISHED` của Event có Registration `REGISTERED`. |
| `FR-ANN-04` | Recipient được tính động; hệ thống không có recipient table và không gửi email. |

### 3.6 AI requirements

| ID | Requirement |
|---|---|
| `FR-AI-01` | ADMIN/owner ORGANIZER tạo AI Announcement Draft từ Event, tối đa 20 Schedule và draft request. |
| `FR-AI-02` | AI Announcement Draft chỉ trả title/content, không tự save hoặc publish. |
| `FR-AI-03` | ADMIN/owner ORGANIZER tạo AI Feedback Summary từ aggregate và tối đa 100 written Feedback. |
| `FR-AI-04` | AI Feedback Summary không lưu output vào database và không gửi attendee identity/email. |
| `FR-AI-05` | Event AI Chatbot trả lời từ Event, Speaker và Schedule đã được backend authorize. |
| `FR-AI-06` | Chatbot scope: ADMIN mọi Event; ORGANIZER own Event; STAFF/ATTENDEE Event `PUBLISHED`. |
| `FR-AI-07` | Chatbot không được dùng attendee, Registration, Ticket, JWT hoặc secret làm context. |
| `FR-AI-08` | Chatbot phải xử lý missing information, out-of-scope question và prompt injection mà không hallucinate/leak prompt. |
| `FR-AI-09` | Chat endpoint là read-only/stateless và không lưu conversation. |
| `FR-AI-10` | OpenAI configuration missing trả 503; upstream/invalid output trả 502; không silent fallback sang mock. |

## 4. User requirements by role

| Capability | ADMIN | ORGANIZER | STAFF | ATTENDEE |
|---|---|---|---|---|
| Own profile/password | Own name, email, password | Own name, email, password | Own name, email, password | Own name, email, password |
| User account management | Mọi account | Không | Không | Tự đăng ký account `ATTENDEE` |
| Event management | Mọi Event | Own Event | Không | Browse `PUBLISHED` |
| Speaker/Schedule | Mọi Event | Own Event | Không | Không |
| Registration list | Mọi Event | Own Event | Không | Dữ liệu của mình |
| Ticket management list | Mọi Event | Own Event | Không | Ticket/QR của mình |
| CheckIn operation | Event được quản lý | Own Event | `PUBLISHED` Event | Không |
| CheckIn history | Mọi Event | Own Event | Không | Không |
| Feedback | Đọc mọi Event | Đọc own Event | Không | Own CRUD khi eligible |
| Statistics/Analytics | Mọi Event | Own Event | Không | Không |
| Announcement management | Mọi Event | Own Event | Không | Đọc bản visible |
| AI Announcement/Summary | Mọi Event | Own Event | Không | Không |
| Event AI Chatbot | Mọi Event | Own Event | `PUBLISHED` | `PUBLISHED` |

## 5. Business rules and lifecycle

### 5.1 Status vocabularies

- Event: `DRAFT`, `PUBLISHED`, `CANCELLED`, `COMPLETED`.
- Registration: `REGISTERED`, `CANCELLED`.
- Ticket: `ACTIVE`, `VOID`.
- Announcement: `DRAFT`, `PUBLISHED`.

Các status được kiểm soát tại application/schema layer; database lưu bằng VARCHAR và không có status CHECK constraint.

### 5.2 Registration and Ticket lifecycle

```text
Register → Registration REGISTERED + Ticket ACTIVE
Cancel   → same Registration CANCELLED + same Ticket VOID
Re-register → same Registration REGISTERED + same Ticket ACTIVE
CheckIn  → Ticket remains ACTIVE; a unique CheckIn row records attendance
```

### 5.3 Ownership and visibility

- Organizer management query luôn lọc `owner_id`.
- Cross-owner management resource được che bằng response 404.
- Staff/Attendee chatbot chỉ tải Event `PUBLISHED`.
- Announcement visibility phụ thuộc Registration status tại thời điểm query.

## 6. Data Dictionary

Quy ước: Required = `YES` khi column `NOT NULL`. `UK` là unique key/index.

### 6.1 NguoiDung — `users`

Mô tả: account xác thực và nguồn role của bốn actor.

| Field | Datatype | Required | Constraint | Meaning |
|---|---|---:|---|---|
| `id` | INTEGER | YES | PK, auto increment | User identifier |
| `full_name` | VARCHAR(255) | YES | — | Tên hiển thị |
| `email` | VARCHAR(255) | YES | UK/index | Login identity duy nhất |
| `password_hash` | VARCHAR(255) | YES | — | bcrypt password hash |
| `role` | VARCHAR(50) | YES | Default `ATTENDEE` | Authorization role |
| `is_active` | TINYINT/Boolean | YES | Default `1` | Account có được phép sử dụng |
| `created_at` | DATETIME | YES | Default `NOW()` | Thời điểm tạo |

### 6.2 SuKien — `events`

Mô tả: thông tin lõi, lifecycle, capacity và owner của Event.

| Field | Datatype | Required | Constraint | Meaning |
|---|---|---:|---|---|
| `id` | INTEGER | YES | PK, auto increment | Event identifier |
| `title` | VARCHAR(200) | YES | — | Tên Event; không unique |
| `description` | TEXT | NO | — | Mô tả Event |
| `location` | VARCHAR(255) | YES | — | Địa điểm |
| `start_time` | DATETIME | YES | — | Thời điểm bắt đầu |
| `end_time` | DATETIME | YES | — | Thời điểm kết thúc |
| `status` | VARCHAR(30) | YES | Default `DRAFT` | Event lifecycle status |
| `max_attendees` | INTEGER | YES | Default `100` | Capacity |
| `owner_id` | INTEGER | YES | FK → `users.id`, index | ADMIN/ORGANIZER sở hữu |
| `created_at` | DATETIME | YES | Default `NOW()` | Thời điểm tạo |
| `updated_at` | DATETIME | YES | Default `NOW()` | Thời điểm cập nhật |

Delete: không có `ON DELETE` trên owner FK; User owner không thể bị xóa khi Event còn tham chiếu.

### 6.3 DienGia — `speakers`

Mô tả: hồ sơ diễn giả thuộc Event; không phải User.

| Field | Datatype | Required | Constraint | Meaning |
|---|---|---:|---|---|
| `id` | INTEGER | YES | PK, auto increment | Speaker identifier |
| `event_id` | INTEGER | YES | FK → `events.id`, index | Event chứa Speaker |
| `full_name` | VARCHAR(150) | YES | — | Tên diễn giả |
| `title` | VARCHAR(150) | NO | — | Chức danh |
| `organization` | VARCHAR(200) | NO | — | Tổ chức |
| `bio` | TEXT | NO | — | Tiểu sử |
| `email` | VARCHAR(255) | NO | — | Email hồ sơ, không phải login identity |
| `created_at` | DATETIME | YES | Default `NOW()` | Thời điểm tạo |
| `updated_at` | DATETIME | YES | Default `NOW()` | Thời điểm cập nhật |

Delete: Event xóa → Speaker `CASCADE`.

### 6.4 LichTrinh — `schedules`

Mô tả: Session trong chương trình của Event.

| Field | Datatype | Required | Constraint | Meaning |
|---|---|---:|---|---|
| `id` | INTEGER | YES | PK, auto increment | Schedule identifier |
| `event_id` | INTEGER | YES | FK → `events.id`, index | Event chứa Session |
| `speaker_id` | INTEGER | NO | FK → `speakers.id`, index | Speaker optional |
| `title` | VARCHAR(200) | YES | — | Tên Session |
| `description` | TEXT | NO | — | Mô tả Session |
| `start_time` | DATETIME | YES | — | Bắt đầu Session |
| `end_time` | DATETIME | YES | — | Kết thúc Session |
| `location` | VARCHAR(255) | NO | — | Phòng/địa điểm Session |
| `created_at` | DATETIME | YES | Default `NOW()` | Thời điểm tạo |
| `updated_at` | DATETIME | YES | Default `NOW()` | Thời điểm cập nhật |

Delete: Event xóa → Schedule `CASCADE`; Speaker xóa → `speaker_id SET NULL`.

### 6.5 DangKy — `registrations`

Mô tả: liên kết lifecycle giữa attendee User và Event.

| Field | Datatype | Required | Constraint | Meaning |
|---|---|---:|---|---|
| `id` | INTEGER | YES | PK, auto increment | Registration identifier |
| `event_id` | INTEGER | YES | FK → `events.id`, index | Event được đăng ký |
| `user_id` | INTEGER | YES | FK → `users.id`, index | Attendee đăng ký |
| `status` | VARCHAR(30) | YES | Default `REGISTERED` | `REGISTERED`/`CANCELLED` |
| `created_at` | DATETIME | YES | Default `NOW()` | Lần tạo đầu tiên |
| `updated_at` | DATETIME | YES | Default `NOW()` | Lần thay đổi lifecycle |

Unique: `UNIQUE(event_id,user_id)` (`uq_registrations_event_user`).

Delete: Event hoặc User xóa → Registration `CASCADE`.

### 6.6 Ve — `tickets`

Mô tả: vé được cấp cho Registration; QR được sinh từ `ticket_code`.

| Field | Datatype | Required | Constraint | Meaning |
|---|---|---:|---|---|
| `id` | INTEGER | YES | PK, auto increment | Ticket identifier |
| `registration_id` | INTEGER | YES | FK → `registrations.id`, UK | Một Ticket tối đa cho một Registration |
| `ticket_code` | VARCHAR(64) | YES | UK | Code dùng làm QR payload/check-in |
| `status` | VARCHAR(20) | YES | Default `ACTIVE` | `ACTIVE`/`VOID` |
| `issued_at` | DATETIME | YES | Default `NOW()` | Thời điểm cấp |
| `updated_at` | DATETIME | YES | Default `NOW()` | Thời điểm cập nhật status |

Delete: Registration xóa → Ticket `CASCADE`.

### 6.7 CheckIn — `checkins`

Mô tả: attendance record được tạo từ Ticket hợp lệ.

| Field | Datatype | Required | Constraint | Meaning |
|---|---|---:|---|---|
| `id` | INTEGER | YES | PK, auto increment | CheckIn identifier |
| `ticket_id` | INTEGER | YES | FK → `tickets.id`, UK | Một CheckIn tối đa cho một Ticket |
| `checked_in_by_user_id` | INTEGER | NO | FK → `users.id`, index | User thực hiện check-in |
| `checked_in_at` | DATETIME | YES | Default `NOW()` | Thời điểm attendance |

Delete: Ticket xóa → CheckIn `CASCADE`; operator User xóa → `checked_in_by_user_id SET NULL`.

### 6.8 PhanHoi — `feedbacks`

Mô tả: đánh giá của attendee cho Event sau CheckIn.

| Field | Datatype | Required | Constraint | Meaning |
|---|---|---:|---|---|
| `id` | INTEGER | YES | PK, auto increment | Feedback identifier |
| `event_id` | INTEGER | YES | FK → `events.id`, index | Event được đánh giá |
| `user_id` | INTEGER | YES | FK → `users.id`, index | Attendee gửi Feedback |
| `rating` | INTEGER | YES | CHECK 1–5 | Điểm đánh giá |
| `comment` | TEXT | NO | — | Written Feedback |
| `created_at` | DATETIME | YES | Default `NOW()` | Thời điểm tạo |
| `updated_at` | DATETIME | YES | Default `NOW()` | Thời điểm cập nhật |

Unique: `UNIQUE(event_id,user_id)` (`uq_feedbacks_event_user`).

Delete: Event hoặc User xóa → Feedback `CASCADE`.

### 6.9 ThongBao — `announcements`

Mô tả: thông báo plain text theo Event.

| Field | Datatype | Required | Constraint | Meaning |
|---|---|---:|---|---|
| `id` | INTEGER | YES | PK, auto increment | Announcement identifier |
| `event_id` | INTEGER | YES | FK → `events.id`, index | Event chứa Announcement |
| `created_by_user_id` | INTEGER | NO | FK → `users.id`, index | Creator optional |
| `title` | VARCHAR(200) | YES | — | Tiêu đề |
| `content` | TEXT | YES | — | Nội dung |
| `status` | VARCHAR(20) | YES | Default `DRAFT` | `DRAFT`/`PUBLISHED` |
| `created_at` | DATETIME | YES | Default `NOW()` | Thời điểm tạo |
| `updated_at` | DATETIME | YES | Default `NOW()` | Thời điểm cập nhật |
| `published_at` | DATETIME | NO | — | Thời điểm publish, null khi Draft |

Delete: Event xóa → Announcement `CASCADE`; creator User xóa → `created_by_user_id SET NULL`.

## 7. AI specification

### 7.1 AI Announcement Draft

- Endpoint: `POST /api/events/{event_id}/ai/announcement-draft`.
- Actors: ADMIN và owner ORGANIZER.
- Input context: Event title/location/start/end/status; tối đa 20 Schedule title/start/end/location; purpose, key points và tone.
- Output: source, tone, title và content.
- Read-only: không tạo Announcement, không save và không publish.

### 7.2 AI Feedback Summary

- Endpoint: `POST /api/events/{event_id}/ai/feedback-summary`.
- Actors: ADMIN và owner ORGANIZER.
- Input context: Event title, Feedback count, average, rating distribution và tối đa 100 written comments; mỗi comment tối đa 1000 characters trong AI payload.
- Không gửi User object hoặc attendee email.
- Output: summary, strengths, issues và suggestions.
- Read-only: không lưu summary.

### 7.3 Event AI Chatbot

- Endpoint: `POST /api/events/{event_id}/ai/chat`.
- Context: Event fields, tối đa 50 Speakers và tối đa 100 Schedules.
- Context không chứa attendee, Registration, Ticket, CheckIn, Feedback, JWT, password hoặc secret.
- User question và Event/Speaker/Schedule content được xem là untrusted data.
- Câu trả lời phải grounded trong selected Event và không bịa thông tin thiếu.
- ADMIN truy cập mọi Event; ORGANIZER own Event; STAFF/ATTENDEE chỉ Event `PUBLISHED`.
- Endpoint không ghi database. Conversation chỉ nằm trong React state và bị xóa khi đổi Event.

### 7.4 AI boundaries

- AI là internal service, không phải business actor.
- Không có AI database table.
- Không có vector database, embedding retrieval hoặc RAG platform.
- Không có persistent/long-term chat history.
- Browser không gọi OpenAI trực tiếp.
- Mock Mode phải được hiển thị đúng là Mock, không giả là OpenAI.

## 8. Non-functional requirements

### 8.1 Security

| ID | Requirement |
|---|---|
| `NFR-SEC-01` | Password phải được bcrypt hash và không log/lưu plaintext. |
| `NFR-SEC-02` | JWT secret, database credentials và OpenAI key chỉ đến từ environment, không commit vào repository. |
| `NFR-SEC-03` | Backend phải enforce RBAC và ownership cho mọi protected workflow. |
| `NFR-SEC-04` | OpenAI key chỉ thuộc backend; AI payload phải loại PII không cần thiết. |
| `NFR-SEC-05` | Chatbot phải chống prompt injection và không reveal hidden instructions/secrets. |

Các biện pháp này phù hợp phạm vi đồ án; project không tuyên bố đã qua production security audit đầy đủ.

### 8.2 Performance and consistency

| ID | Requirement |
|---|---|
| `NFR-PERF-01` | Foreign-key lookup fields và unique business identifiers phải có index theo schema hiện tại. |
| `NFR-PERF-02` | Registration/capacity và CheckIn flows phải dùng transaction/row locking phù hợp để giảm race conditions. |
| `NFR-PERF-03` | AI context phải bị giới hạn số lượng item và timeout; không tải dữ liệu không cần thiết. |
| `NFR-PERF-04` | Database connection dùng pre-ping và connection recycle theo cấu hình hiện tại. |

Không có benchmark/SLA enterprise được cam kết.

### 8.3 Maintainability

| ID | Requirement |
|---|---|
| `NFR-MNT-01` | Frontend, API, schema, model và service concerns phải được tách module. |
| `NFR-MNT-02` | OpenAPI là reference cho request/response contract runtime. |
| `NFR-MNT-03` | Mock/OpenAI dùng chung AI configuration/error policy hiện có. |
| `NFR-MNT-04` | Regression scripts phải bảo vệ các lifecycle/RBAC quan trọng. |

Schema hiện được tạo bằng SQLAlchemy `create_all()`; project chưa có Alembic migration workflow.

### 8.4 Portability and usability

| ID | Requirement |
|---|---|
| `NFR-PORT-01` | Project phải chạy được bằng Docker Compose với frontend/backend/database services. |
| `NFR-PORT-02` | Team member có thể cấu hình local runtime từ `.env.example`; real `.env` không được commit. |
| `NFR-UI-01` | UI phải responsive cho desktop và mobile trong phạm vi layout hiện tại. |
| `NFR-UI-02` | Selected Event và AI mode phải được hiển thị rõ trong các workflow phụ thuộc Event context. |
| `NFR-UI-03` | Loading, success và error states phải có feedback rõ ràng cho user. |

## 9. Outdated design concepts

Các khái niệm sau không thuộc implementation v1.1.0 và không được dùng trong SRS/ERD hiện hành:

| Old concept | Current source of truth |
|---|---|
| `SuKienDienGia(event_id,user_id)` | Không tồn tại. `speakers` là entity riêng có `event_id`; Speaker không phải User. |
| `CauHoiThuongGap`/FAQ table | Không tồn tại. Chatbot trả lời on-demand từ Event/Speaker/Schedule. |
| `MaQR` trong `DangKy` | Không tồn tại. `tickets.ticket_code` là QR payload; QR được tạo on-demand. |
| `CheckIn → DangKy` trực tiếp | Không đúng. `checkins.ticket_id → tickets.id → registrations.id`. |
| Speaker = User | Không đúng. Speaker không có password, role hoặc login. |
| AI là actor | Không đúng. AI là internal supporting service. |
| Chatbot chưa tồn tại | Outdated. Event AI Chatbot là AI feature thứ ba ở v1.1.0. |
| AI/Embedding/ChatMessage tables | Không tồn tại; database giữ đúng 9 bảng. |

## 10. Explicitly out of scope

- Payment và revenue processing.
- Email delivery.
- Seat booking.
- Event–Staff assignment table.
- Public portal không cần authentication.
- Refresh-token/revocation workflow.
- Vector database, RAG platform và recommendation engine.
- Persistent chatbot memory.
- Tuyên bố enterprise/production-grade tuyệt đối hoặc SLA chưa được đo.

## 11. References

- [Use Case Model](USE_CASES.md)
- [UML Diagrams](UML_DIAGRAMS.md)
- [Final ERD](FINAL_ERD.md)
- [Architecture](ARCHITECTURE.md)
- [Modules and business rules](MODULES.md)
- [API Summary](API_SUMMARY.md)
- [Complete Demo Dataset](DEMO_DATA.md)
