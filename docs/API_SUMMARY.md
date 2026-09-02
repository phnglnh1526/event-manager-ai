# API Summary

Đây là reference tóm tắt, không thay thế schema tương tác của FastAPI. Khi hệ thống chạy, xem Swagger tại http://localhost:8000/docs và OpenAPI JSON tại http://localhost:8000/openapi.json.

Phần lớn endpoint cần header:

```http
Authorization: Bearer <JWT>
```

`Own Event` nghĩa là Organizer chỉ truy cập Event có `owner_id` của chính mình; `ADMIN` truy cập mọi Event.

## Health

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | API health |
| GET | `/api/health/database` | Public | Database connectivity health |

## Authentication và RBAC verification

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Tạo account `ATTENDEE` |
| POST | `/api/auth/login` | Public | Nhận JWT và User |
| GET | `/api/auth/me` | Authenticated | Lấy current User |
| GET | `/api/rbac/admin` | `ADMIN` | Kiểm tra Admin access |
| GET | `/api/rbac/organizer` | `ORGANIZER` | Kiểm tra Organizer access |
| GET | `/api/rbac/staff` | `STAFF` | Kiểm tra Staff access |
| GET | `/api/rbac/authenticated` | Any authenticated | Kiểm tra authentication |

## Events

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/api/events` | `ADMIN`, `ORGANIZER` | Tạo Event |
| GET | `/api/events` | `ADMIN`, `ORGANIZER` | List all/own Events |
| GET | `/api/events/{event_id}` | `ADMIN`, Own Event | Event detail |
| PATCH | `/api/events/{event_id}` | `ADMIN`, Own Event | Update Event |
| DELETE | `/api/events/{event_id}` | `ADMIN`, Own Event | Delete Event và related data |
| GET | `/api/attendee/events` | `ATTENDEE` | List Event `PUBLISHED` để browse |

## Speakers

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/api/events/{event_id}/speakers` | `ADMIN`, Own Event | Tạo Speaker |
| GET | `/api/events/{event_id}/speakers` | `ADMIN`, Own Event | List Speakers |
| GET | `/api/events/{event_id}/speakers/{speaker_id}` | `ADMIN`, Own Event | Speaker detail |
| PATCH | `/api/events/{event_id}/speakers/{speaker_id}` | `ADMIN`, Own Event | Update Speaker |
| DELETE | `/api/events/{event_id}/speakers/{speaker_id}` | `ADMIN`, Own Event | Delete Speaker |

## Schedules

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/api/events/{event_id}/schedules` | `ADMIN`, Own Event | Tạo Session |
| GET | `/api/events/{event_id}/schedules` | `ADMIN`, Own Event | List Sessions |
| GET | `/api/events/{event_id}/schedules/{schedule_id}` | `ADMIN`, Own Event | Session detail |
| PATCH | `/api/events/{event_id}/schedules/{schedule_id}` | `ADMIN`, Own Event | Update Session |
| DELETE | `/api/events/{event_id}/schedules/{schedule_id}` | `ADMIN`, Own Event | Delete Session |

## Registrations

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/api/events/{event_id}/registrations` | `ATTENDEE` | Register hoặc register again |
| DELETE | `/api/events/{event_id}/registrations/me` | `ATTENDEE` | Cancel own active registration |
| GET | `/api/registrations/me` | `ATTENDEE` | List own registrations |
| GET | `/api/events/{event_id}/registrations` | `ADMIN`, Own Event | Management registration list |

## Tickets và QR

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| GET | `/api/tickets/me` | `ATTENDEE` | List own Tickets |
| GET | `/api/tickets/me/{ticket_id}` | `ATTENDEE` | Own Ticket detail |
| GET | `/api/tickets/me/{ticket_id}/qr` | `ATTENDEE` | Protected QR PNG của active Ticket |
| GET | `/api/events/{event_id}/tickets` | `ADMIN`, Own Event | List Event Tickets |
| GET | `/api/events/{event_id}/tickets/{ticket_id}` | `ADMIN`, Own Event | Event Ticket detail |

Ticket không có public create/update/delete endpoint; service phát hành tự động theo Registration.

## Check-ins

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| GET | `/api/checkin/events` | `ADMIN`, `ORGANIZER`, `STAFF` | List Event `PUBLISHED` cho check-in; Organizer chỉ own Events |
| POST | `/api/events/{event_id}/checkins` | `ADMIN`, `ORGANIZER`, `STAFF` | Check-in bằng `ticket_code`; Organizer chỉ own Event |
| GET | `/api/events/{event_id}/checkins` | `ADMIN`, Own Event | List CheckIns |

`STAFF` không có Event assignment trong scope hiện tại và có thể vận hành check-in trên các Event `PUBLISHED` được endpoint trả về.

## Feedback

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/api/events/{event_id}/feedbacks` | `ATTENDEE` | Tạo own Feedback sau check-in |
| GET | `/api/events/{event_id}/feedbacks/me` | `ATTENDEE` | Xem own Feedback |
| PATCH | `/api/events/{event_id}/feedbacks/me` | `ATTENDEE` | Update own Feedback |
| DELETE | `/api/events/{event_id}/feedbacks/me` | `ATTENDEE` | Delete own Feedback |
| GET | `/api/events/{event_id}/feedbacks` | `ADMIN`, Own Event | List Event Feedbacks |

## Statistics

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| GET | `/api/events/{event_id}/statistics` | `ADMIN`, Own Event | Capacity, registration, attendance và feedback metrics |

## Announcements

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/api/events/{event_id}/announcements` | `ADMIN`, Own Event | Tạo Draft/Published Announcement |
| GET | `/api/events/{event_id}/announcements` | `ADMIN`, Own Event | List Event Announcements |
| GET | `/api/events/{event_id}/announcements/{announcement_id}` | `ADMIN`, Own Event | Announcement detail |
| PATCH | `/api/events/{event_id}/announcements/{announcement_id}` | `ADMIN`, Own Event | Update nội dung/status |
| DELETE | `/api/events/{event_id}/announcements/{announcement_id}` | `ADMIN`, Own Event | Delete Announcement |
| GET | `/api/announcements/me` | `ATTENDEE` | List published Announcements cho active registrations |
| GET | `/api/announcements/me/{announcement_id}` | `ATTENDEE` | Attendee Announcement detail |

## AI

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/api/events/{event_id}/ai/feedback-summary` | `ADMIN`, Own Event | On-demand Feedback Summary |
| POST | `/api/events/{event_id}/ai/announcement-draft` | `ADMIN`, Own Event | Tạo title/content draft; không save/publish |
| POST | `/api/events/{event_id}/ai/chat` | `ADMIN`; `ORGANIZER` Own Event; `STAFF`/`ATTENDEE` Published Event | Event-grounded Q&A; read-only và không lưu chat |

Chat request dùng `{ "question": "..." }`; response gồm `event_id`, `answer` và source `mock` hoặc `openai`. Chat context chỉ chứa Event, Speaker và Schedule đã được backend authorize.

## Common response codes

| Code | Ý nghĩa thường gặp |
|---:|---|
| `200` | Đọc/update thành công hoặc đăng ký lại thành công |
| `201` | Resource mới được tạo |
| `204` | Delete/cancel thành công, không có response body |
| `401` | Thiếu, hết hạn hoặc JWT không hợp lệ |
| `403` | Sai role, account inactive, ownership/eligibility không đủ |
| `404` | Resource không tồn tại hoặc không thuộc scope truy cập |
| `409` | Lifecycle conflict: duplicate, full, inactive, already checked-in... |
| `422` | Request/schema hoặc time range không hợp lệ |
| `502` | AI upstream/response lỗi |
| `503` | Database health fail hoặc AI chưa được cấu hình |

OpenAPI là source of truth cho request/response schema chi tiết và validation fields.
