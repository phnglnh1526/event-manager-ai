# Event Manager AI v1.1.0 — UML Diagrams

Tài liệu này đồng bộ với SQLAlchemy models, FastAPI routes và service modules hiện tại. Chín class có stereotype `ENTITY` tương ứng đúng chín bảng. AI service có stereotype `SERVICE`, xử lý on-demand và không phải entity, table hoặc state machine.

## 1. Class/domain model

```mermaid
classDiagram
direction LR
class User {
  <<ENTITY>>
  +int id PK
  +string full_name
  +string email UNIQUE
  +string password_hash
  +string role
  +bool is_active
  +datetime created_at
}
class Event {
  <<ENTITY>>
  +int id PK
  +string title
  +text description nullable
  +string location
  +datetime start_time
  +datetime end_time
  +string status
  +int max_attendees
  +int owner_id FK
  +datetime created_at
  +datetime updated_at
}
class Speaker {
  <<ENTITY>>
  +int id PK
  +int event_id FK
  +string full_name
  +string title nullable
  +string organization nullable
  +text bio nullable
  +string email nullable
  +datetime created_at
  +datetime updated_at
}
class Schedule {
  <<ENTITY>>
  +int id PK
  +int event_id FK
  +int speaker_id FK nullable
  +string title
  +text description nullable
  +datetime start_time
  +datetime end_time
  +string location nullable
  +datetime created_at
  +datetime updated_at
}
class Registration {
  <<ENTITY>>
  +int id PK
  +int event_id FK
  +int user_id FK
  +string status
  +datetime created_at
  +datetime updated_at
  +UNIQUE(event_id, user_id)
}
class Ticket {
  <<ENTITY>>
  +int id PK
  +int registration_id FK UNIQUE
  +string ticket_code UNIQUE
  +string status
  +datetime issued_at
  +datetime updated_at
}
class CheckIn {
  <<ENTITY>>
  +int id PK
  +int ticket_id FK UNIQUE
  +int checked_in_by_user_id FK nullable
  +datetime checked_in_at
}
class Feedback {
  <<ENTITY>>
  +int id PK
  +int event_id FK
  +int user_id FK
  +int rating 1..5
  +text comment nullable
  +datetime created_at
  +datetime updated_at
  +UNIQUE(event_id, user_id)
}
class Announcement {
  <<ENTITY>>
  +int id PK
  +int event_id FK
  +int created_by_user_id FK nullable
  +string title
  +text content
  +string status
  +datetime published_at nullable
  +datetime created_at
  +datetime updated_at
}

User "1" --> "0..*" Event : owns
Event "1" *-- "0..*" Speaker : CASCADE
Event "1" *-- "0..*" Schedule : CASCADE
Speaker "0..1" --> "0..*" Schedule : presents / SET NULL
User "1" --> "0..*" Registration : makes
Event "1" *-- "0..*" Registration : CASCADE
Registration "1" *-- "0..1" Ticket : CASCADE
Ticket "1" *-- "0..1" CheckIn : CASCADE
User "0..1" --> "0..*" CheckIn : performs / SET NULL
User "1" --> "0..*" Feedback : writes
Event "1" *-- "0..*" Feedback : CASCADE
Event "1" *-- "0..*" Announcement : CASCADE
User "0..1" --> "0..*" Announcement : creates / SET NULL

class FeedbackAIService {
  <<SERVICE>>
  +summarize(event, feedbacks)
}
class AnnouncementAIService {
  <<SERVICE>>
  +generateDraft(event, schedules, request)
}
class EventChatService {
  <<SERVICE>>
  +answer(event, speakers, schedules, question)
}
FeedbackAIService ..> Event : reads
FeedbackAIService ..> Feedback : reads
AnnouncementAIService ..> Event : reads
AnnouncementAIService ..> Schedule : reads max 20
EventChatService ..> Event : reads
EventChatService ..> Speaker : reads max 50
EventChatService ..> Schedule : reads max 100
```

`Speaker` là entity riêng, không phải `User`. `CheckIn` ghi nhận attendance; `Ticket` không có trạng thái `CHECKED_IN`. Ba service box ánh xạ tới các module AI service, không ánh xạ tới database.

## 2. Sequence diagrams

### 2.1 Login

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant Backend as FastAPI
    participant DB as MySQL/users
    User->>Frontend: Nhập email và password
    Frontend->>Backend: POST /api/auth/login
    Backend->>DB: Tìm User theo email
    DB-->>Backend: User, password_hash, role, is_active
    Backend->>Backend: Verify bcrypt, active; sign JWT
    alt hợp lệ
        Backend-->>Frontend: access_token + User
        Frontend->>Frontend: Lưu token trong sessionStorage
        Frontend-->>User: Mở workspace theo role
    else sai thông tin đăng nhập
        Backend-->>Frontend: 401
    else tài khoản inactive
        Backend-->>Frontend: 403
    end
```

### 2.2 Registration

```mermaid
sequenceDiagram
    actor Attendee
    participant Frontend
    participant Backend as FastAPI
    participant Event
    participant Registration
    participant Ticket
    Attendee->>Frontend: Register
    Frontend->>Backend: POST /api/events/{id}/registrations
    Backend->>Event: Lock; verify PUBLISHED
    Backend->>Registration: Lock matching row if present; lock/count REGISTERED rows
    alt invalid/full/already registered
        Backend-->>Frontend: 409
    else first registration
        Backend->>Registration: INSERT REGISTERED
        Backend->>Ticket: INSERT ACTIVE + unique code
        Backend-->>Frontend: 201 Registration
    else existing CANCELLED
        Backend->>Registration: status=REGISTERED
        Backend->>Ticket: Reuse/create; status=ACTIVE
        Backend-->>Frontend: 200 Registration
    end
```

### 2.3 Cancel and re-register

```mermaid
sequenceDiagram
    actor Attendee
    participant Frontend
    participant Backend as FastAPI
    participant Registration
    participant Ticket
    participant CheckIn
    Frontend->>Backend: DELETE /api/events/{id}/registrations/me
    Backend->>Registration: Lock active own row
    Backend->>Ticket: Lock Ticket
    Backend->>CheckIn: Check attendance record
    alt CheckIn exists
        Backend-->>Frontend: 409 cannot cancel
    else not checked in
        Backend->>Registration: status=CANCELLED
        Backend->>Ticket: status=VOID
        Backend-->>Frontend: 204
    end
    Attendee->>Frontend: Register again
    Frontend->>Backend: POST /api/events/{id}/registrations
    Backend->>Registration: Reuse row; status=REGISTERED
    Backend->>Ticket: Reuse code; status=ACTIVE
    Backend-->>Frontend: 200 Registration
```

### 2.4 QR Ticket

```mermaid
sequenceDiagram
    actor Attendee
    participant Frontend
    participant Backend as FastAPI
    participant Registration
    participant Ticket
    participant QR as QR encoder
    Frontend->>Backend: GET /api/tickets/me/{ticket_id}/qr
    Backend->>Ticket: Load own Ticket
    Backend->>Registration: Verify owner + REGISTERED
    alt Ticket ACTIVE
        Backend->>QR: Encode ticket_code
        QR-->>Backend: PNG bytes
        Backend-->>Frontend: image/png
        Frontend-->>Attendee: Render Blob URL
    else invalid lifecycle
        Backend-->>Frontend: 404/409
    end
```

### 2.5 CheckIn

```mermaid
sequenceDiagram
    actor Staff
    participant Frontend
    participant Backend as FastAPI
    participant Event
    participant Registration
    participant Ticket
    participant CheckIn
    Staff->>Frontend: Scan QR or enter ticket_code
    Frontend->>Backend: POST /api/events/{id}/checkins
    Backend->>Event: Verify selected Event PUBLISHED
    Backend->>Ticket: Lock code within Event
    Backend->>Registration: Verify REGISTERED
    Backend->>Ticket: Verify ACTIVE
    Backend->>CheckIn: Verify no record for Ticket
    alt valid
        Backend->>CheckIn: INSERT attendance + operator
        Backend-->>Frontend: 201 CheckIn
    else invalid/duplicate
        Backend-->>Frontend: 404/409
    end
    Note over Ticket,CheckIn: Ticket remains ACTIVE; CheckIn is attendance
```

### 2.6 Feedback

```mermaid
sequenceDiagram
    actor Attendee
    participant Frontend
    participant Backend as FastAPI
    participant Event
    participant Registration
    participant Ticket
    participant CheckIn
    participant Feedback
    Frontend->>Backend: POST /api/events/{id}/feedbacks
    Backend->>Event: Verify PUBLISHED or COMPLETED
    Backend->>Registration: Verify own REGISTERED row
    Backend->>Ticket: Resolve Ticket
    Backend->>CheckIn: Verify attendance
    Backend->>Feedback: Verify unique Event+User
    alt eligible
        Backend->>Feedback: INSERT rating 1..5/comment
        Backend-->>Frontend: 201 Feedback
    else ineligible/duplicate
        Backend-->>Frontend: 403/409
    end
    Note over Frontend,Feedback: GET/PATCH/DELETE operate on own Feedback
```

### 2.7 AI Feedback Summary

```mermaid
sequenceDiagram
    actor User as Admin/Organizer
    participant Frontend
    participant Backend as FastAPI
    participant DB as Event/Feedback
    participant AI as FeedbackAIService
    participant Provider as OpenAI Responses API / mock
    Frontend->>Backend: POST /api/events/{id}/ai/feedback-summary
    Backend->>DB: Authorize Event; load aggregates/comments
    DB-->>Backend: Event title + feedback context
    Backend->>AI: summarize(context)
    AI->>Provider: Structured request or local mock
    Provider-->>AI: Structured summary
    AI-->>Backend: summary/strengths/issues/suggestions
    Backend-->>Frontend: 200 response
    Frontend-->>User: Display result
    Note over Backend,DB: No AI result persisted
```

### 2.8 AI Announcement Draft

```mermaid
sequenceDiagram
    actor User as Admin/Organizer
    participant Frontend
    participant Backend as FastAPI
    participant DB as Event/Schedule
    participant AI as AnnouncementAIService
    participant Provider as OpenAI Responses API / mock
    Frontend->>Backend: POST /api/events/{id}/ai/announcement-draft
    Backend->>DB: Authorize Event; load up to 20 Schedules
    DB-->>Backend: Event/Schedule context
    Backend->>AI: generateDraft(context, request)
    AI->>Provider: Structured request or local mock
    Provider-->>AI: title/content
    AI-->>Backend: Draft response
    Backend-->>Frontend: 200 title/content
    Frontend-->>User: Review/edit generated draft
    Note over Backend,DB: Does not create or publish Announcement
```

### 2.9 AI Event Chatbot

```mermaid
sequenceDiagram
    actor User as Authorized User
    participant Frontend
    participant Backend as FastAPI
    participant DB as Event/Speaker/Schedule
    participant AI as EventChatService
    participant Provider as OpenAI Responses API / mock
    User->>Frontend: Ask for selected Event
    Frontend->>Backend: POST /api/events/{id}/ai/chat
    Backend->>DB: Apply all/own/PUBLISHED scope
    DB-->>Backend: Event + Speakers + Schedules only
    Backend->>AI: answer(grounded context, question)
    AI->>Provider: Guarded request or local mock
    Provider-->>AI: Grounded answer
    AI-->>Backend: Validated answer + mode
    Backend-->>Frontend: 200 response
    Frontend-->>User: Display answer and mode
    Note over Frontend,Backend: Event switch clears client chat; one Send = one request
    Note over Backend,DB: No attendee PII and no chat persistence
```

Ba AI flow dùng local generator khi `AI_MODE=mock` và Responses API từ backend khi `AI_MODE=openai`. Thiếu config trả `503`; upstream/invalid output trả `502`; không silent fallback và browser không gọi OpenAI.

### 2.10 Public registration and Admin user management

```mermaid
sequenceDiagram
    actor Visitor
    actor Admin
    participant Frontend
    participant Backend as FastAPI
    participant DB as Users table
    Visitor->>Frontend: Submit full name, email, password
    Frontend->>Backend: POST /api/auth/register
    Backend->>Backend: Validate input; force ATTENDEE; bcrypt hash
    Backend->>DB: Insert active User
    DB-->>Backend: Created User
    Backend-->>Frontend: 201 safe User response
    Admin->>Frontend: List/create/edit User
    Frontend->>Backend: GET/POST/PATCH /api/admin/users
    Backend->>DB: Reload caller; require current ADMIN
    Backend->>Backend: Enforce self/last-active-admin guards
    Backend->>DB: Read or persist allowed fields
    Backend-->>Frontend: Safe User response without password hash
    Note over Backend,DB: DB role/status controls old JWT authorization
```

## 3. State diagrams

### 3.1 Event

```mermaid
stateDiagram-v2
    [*] --> DRAFT: default create
    DRAFT --> PUBLISHED: PATCH status
    DRAFT --> CANCELLED: PATCH status
    DRAFT --> COMPLETED: PATCH status
    PUBLISHED --> DRAFT: PATCH status
    PUBLISHED --> CANCELLED: PATCH status
    PUBLISHED --> COMPLETED: PATCH status
    CANCELLED --> DRAFT: PATCH status
    CANCELLED --> PUBLISHED: PATCH status
    CANCELLED --> COMPLETED: PATCH status
    COMPLETED --> DRAFT: PATCH status
    COMPLETED --> PUBLISHED: PATCH status
    COMPLETED --> CANCELLED: PATCH status
```

`DRAFT` là default, nhưng create/update schema chấp nhận bất kỳ giá trị nào trong bốn status và code chưa áp đặt transition matrix. Diagram thể hiện các cập nhật trực tiếp API thực sự cho phép.

### 3.2 Registration and Ticket coordinated lifecycle

```mermaid
stateDiagram-v2
    state Registration {
        [*] --> REGISTERED: first register
        REGISTERED --> CANCELLED: cancel if no CheckIn
        CANCELLED --> REGISTERED: register again / reuse row
    }
    state Ticket {
        [*] --> ACTIVE: first register
        ACTIVE --> VOID: registration cancelled
        VOID --> ACTIVE: registration reactivated
    }
```

Cancel đồng bộ `Registration=CANCELLED` và `Ticket=VOID`; re-register đồng bộ `Registration=REGISTERED` và `Ticket=ACTIVE`. Ticket id/code được giữ nếu row đã tồn tại.

### 3.3 Announcement

```mermaid
stateDiagram-v2
    [*] --> DRAFT: default create
    [*] --> PUBLISHED: create with PUBLISHED
    DRAFT --> PUBLISHED: publish / set published_at
    PUBLISHED --> DRAFT: unpublish / clear published_at
```

### 3.4 CheckIn and AI clarification

- `CheckIn` là attendance record được tạo on demand; model không có status lifecycle.
- `CheckIn.ticket_id` là unique, nên mỗi Ticket có tối đa một record.
- Ticket vẫn `ACTIVE` sau check-in; không tồn tại `Ticket.CHECKED_IN`.
- Ba AI function là request/response on-demand, không có AI state machine hoặc AI persistence.

## 4. Consistency notes

- Chính xác 9 entity/table: User, Event, Speaker, Schedule, Registration, Ticket, CheckIn, Feedback, Announcement.
- Không có `Speaker = User`, join table `EventSpeaker`, QR trong Registration, hoặc CheckIn tham chiếu trực tiếp Registration.
- QR được sinh từ `Ticket.ticket_code`; CheckIn tham chiếu Ticket.
- AI service chỉ đọc context được authorize và trả response; không phải database entity.
- Cardinality/delete rules khớp [Final ERD](FINAL_ERD.md); flows khớp [API Summary](API_SUMMARY.md).
