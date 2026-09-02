# Modules và business rules

Mỗi module dưới đây được đối chiếu với router, schema, model và frontend hiện tại. Endpoint chi tiết nằm tại [API_SUMMARY.md](API_SUMMARY.md).

## Authentication và RBAC

**Purpose:** xác thực User và bảo vệ các workflow theo role.

**Actors:** mọi User; đăng ký account công khai không cần token.

**Main operations:** register, login, lấy current User và các endpoint kiểm tra RBAC.

**Endpoints:** `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/rbac/*`.

**Business rules:**

- Public registration luôn tạo role `ATTENDEE`; không nhận role từ client.
- Password dài 8–72 ký tự, được hash bằng bcrypt.
- JWT được ký bằng `HS256`, có expiry và được frontend giữ trong `sessionStorage`.
- Backend xác minh token, tải lại User và chặn account không active.

## Event Management

**Purpose:** quản lý thông tin và lifecycle của Event.

**Actors:** `ADMIN`, `ORGANIZER`.

**Main operations:** create, list, detail, update, delete.

**Endpoints:** `/api/events` và `/api/events/{event_id}`.

**Business rules:**

- Event có title, description, location, start/end, status và `max_attendees`.
- End time phải sau start time; capacity từ 1 đến 100000.
- Status hợp lệ: `DRAFT`, `PUBLISHED`, `CANCELLED`, `COMPLETED`.
- `ADMIN` truy cập mọi Event; `ORGANIZER` chỉ Event do mình sở hữu.
- Xóa Event cascade dữ liệu nghiệp vụ liên quan.

## Speaker Management

**Purpose:** lưu hồ sơ Speaker thuộc một Event.

**Actors:** `ADMIN`, `ORGANIZER` theo Event ownership.

**Main operations:** CRUD Speaker trong Event.

**Endpoints:** `/api/events/{event_id}/speakers`.

**Business rules:**

- Speaker là domain record, không phải User và không đăng nhập.
- Speaker luôn thuộc đúng một Event.
- Khi Speaker bị xóa, Session được giữ lại và `speaker_id` trở thành `NULL`.

## Schedule / Session Management

**Purpose:** quản lý chương trình theo thời gian của Event.

**Actors:** `ADMIN`, `ORGANIZER` theo Event ownership.

**Main operations:** CRUD Schedule/Session, gắn Speaker tùy chọn.

**Endpoints:** `/api/events/{event_id}/schedules`.

**Business rules:**

- Trong UI, Schedule gồm các Session.
- Start/end của Session phải nằm hoàn toàn trong start/end của Event và end phải sau start.
- Speaker nếu được chọn phải thuộc cùng Event.
- Speaker là optional; các Session trùng thời gian/diễn ra song song được phép.

## Registration

**Purpose:** quản lý lifecycle đăng ký tham dự.

**Actors:** `ATTENDEE` tạo/hủy/xem của mình; `ADMIN` và owner `ORGANIZER` xem danh sách Event.

**Main operations:** register, cancel, register again, list own, management list.

**Endpoints:** `/api/events/{event_id}/registrations`, `/api/events/{event_id}/registrations/me`, `/api/registrations/me`.

**Business rules:**

- Chỉ `ATTENDEE` đăng ký và chỉ với Event `PUBLISHED`.
- Capacity đếm registration đang `REGISTERED`; full Event trả conflict.
- Mỗi Event/User có một row. Đăng ký lại đổi `CANCELLED` → `REGISTERED` thay vì tạo row mới.
- Không được hủy registration đã có CheckIn.
- Management list là read-only; không có admin endpoint sửa trạng thái registration.

## Ticket và QR

**Purpose:** cấp bằng chứng đăng ký và QR cho attendee.

**Actors:** `ATTENDEE` xem Ticket/QR của mình; `ADMIN` và owner `ORGANIZER` xem Ticket theo Event.

**Main operations:** automatic issue, list/detail, protected QR generation.

**Endpoints:** `/api/tickets/me`, `/api/tickets/me/{ticket_id}`, `/api/tickets/me/{ticket_id}/qr`, `/api/events/{event_id}/tickets`.

**Business rules:**

- Ticket được tạo tự động cùng registration; không có public create/update/delete API.
- Registration active có Ticket `ACTIVE`; cancel chuyển `VOID`; register again chuyển lại `ACTIVE`.
- QR chỉ được trả khi Ticket và Registration đều active. QR PNG được tạo on-demand với payload là `ticket_code`.
- Frontend dùng Bearer JWT để tải Blob PNG và tạo Object URL.

## Check-in

**Purpose:** ghi nhận attendance tại Event.

**Actors:** `STAFF`, `ADMIN`, `ORGANIZER`; danh sách CheckIn chỉ dành cho `ADMIN` và owner `ORGANIZER`.

**Main operations:** chọn Event `PUBLISHED`, nhập/quét ticket code, tạo CheckIn, xem danh sách.

**Endpoints:** `/api/checkin/events`, `/api/events/{event_id}/checkins`.

**Business rules:**

- Check-in chỉ với Event `PUBLISHED`, Registration `REGISTERED` và Ticket `ACTIVE` của đúng Event.
- Một Ticket tối đa một CheckIn; lần lặp trả conflict.
- Ticket vẫn `ACTIVE` sau check-in; CheckIn record là attendance source.
- Camera scanner decode QR rồi gọi cùng endpoint như manual ticket code.

## Feedback

**Purpose:** thu thập rating và comment sau attendance.

**Actors:** `ATTENDEE` quản lý Feedback của mình; `ADMIN` và owner `ORGANIZER` xem toàn bộ Feedback Event.

**Main operations:** create, get/update/delete own Feedback, management list.

**Endpoints:** `/api/events/{event_id}/feedbacks` và `/api/events/{event_id}/feedbacks/me`.

**Business rules:**

- Attendee cần Registration `REGISTERED`, Ticket và CheckIn; Event phải `PUBLISHED` hoặc `COMPLETED`.
- Rating là integer 1–5; comment optional, tối đa 2000 ký tự.
- Mỗi Event/User chỉ có một Feedback.

## Statistics / Analytics

**Purpose:** tổng hợp số liệu của một Event.

**Actors:** `ADMIN`, owner `ORGANIZER`.

**Endpoint:** `/api/events/{event_id}/statistics`.

**Metrics thực tế:**

- Capacity: maximum, registered, available, usage rate.
- Registrations: total lifecycle rows, registered, cancelled.
- Attendance: checked-in, not checked-in, attendance rate.
- Feedback: total, average rating và phân phối rating 1–5.

Không có revenue, payment hoặc seat metrics.

## Announcement

**Purpose:** quản lý thông báo plain text theo Event.

**Actors:** `ADMIN`, owner `ORGANIZER` quản lý; `ATTENDEE` đọc announcement phù hợp.

**Main operations:** CRUD, chuyển `DRAFT`/`PUBLISHED`, attendee list/detail.

**Endpoints:** `/api/events/{event_id}/announcements`, `/api/announcements/me`.

**Business rules:**

- Publish time được gán khi chuyển sang `PUBLISHED` và xóa khi trở lại `DRAFT`.
- Attendee chỉ thấy `PUBLISHED` announcement của Event đang `REGISTERED`.
- Recipient được tính động; không có recipient table và không gửi email.

## AI Feedback Summary

**Purpose:** tạo insight hỗ trợ từ Feedback của Event.

**Actors:** `ADMIN`, owner `ORGANIZER`.

**Endpoint:** `/api/events/{event_id}/ai/feedback-summary`.

**Business rules:**

- Cần có Feedback và ít nhất một written comment.
- Chạy on-demand; không có AI table và không lưu summary.
- Dữ liệu gồm aggregate và tối đa 100 rating/comment; không truyền User object/email.
- Response có source `mock` hoặc `openai`, summary, strengths, issues và suggestions.

## AI Announcement Draft

**Purpose:** hỗ trợ soạn title/content từ Event context, purpose, key points và tone.

**Actors:** `ADMIN`, owner `ORGANIZER`.

**Endpoint:** `/api/events/{event_id}/ai/announcement-draft`.

**Business rules:**

- Tone: `PROFESSIONAL`, `FRIENDLY`, `URGENT`.
- Context gồm Event và tối đa 20 Session.
- Endpoint không save, không publish và không gửi Announcement.
- User phải review output rồi chủ động Save Draft hoặc Publish qua Announcement module.

## Workspaces

- **Management Workspace:** Analytics, Events, Speaker, Schedule, Registration list và Announcements cho `ADMIN`/`ORGANIZER`.
- **Staff Check-in Workspace:** Event selection, camera scanner và manual check-in cho `STAFF`.
- **Attendee Workspace:** Events, My Registrations, My Tickets/QR, Feedback và Announcements cho `ATTENDEE`.
