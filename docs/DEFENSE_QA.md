# Defense Q&A — 60 câu hỏi phản biện

Quy tắc trả lời: trả lời trực tiếp trước, sau đó mới giải thích. Nếu nội dung ngoài scope, nói rõ “hiện chưa nằm trong phạm vi đồ án” và chỉ nêu hướng mở rộng, không giả là đã triển khai.

## Top 15 MUST KNOW

Phải thuộc chắc: **B01, B07, B09, B10, B11, B12, B14, B15, B16, B17, B19, I02, I06, I09, H02**.

## Top 5 DANGEROUS

1. **H01 — AI có phải actor không?** Không; AI là internal supporting service.
2. **H07 — Ticket vẫn ACTIVE sau CheckIn có phải bug?** Không; Ticket validity và attendance là hai khái niệm.
3. **I06 — Vì sao Speaker không phải User?** Speaker không cần authentication.
4. **I09 — Re-register có tạo Ticket mới?** Không nếu Ticket đã tồn tại; tái sử dụng code/id và chuyển `ACTIVE`.
5. **H02 — Organizer security nằm frontend hay backend?** Backend; frontend chỉ UX.

---

## A. 20 câu cơ bản

### B01 — MUST KNOW: Hệ thống giải quyết vấn đề gì?

**QUESTION:** Event Manager AI giải quyết vấn đề gì?

**SHORT ANSWER:** Hệ thống tập trung toàn bộ core lifecycle của Event từ tổ chức đến attendance, Feedback và Analytics.

**DETAILED ANSWER:** Dữ liệu Event, Schedule, attendee, Ticket, CheckIn và Feedback thường dễ phân tán. Project nối chúng thành một workflow, đồng thời dùng AI hỗ trợ đọc Feedback, soạn Announcement và hỏi đáp theo Event context.

**Nếu bị hỏi tiếp:** Nêu rõ scope không gồm payment, seating, email campaign hoặc CRM.

### B02 — Vì sao chọn đề tài này?

**QUESTION:** Tại sao nhóm chọn đề tài quản lý sự kiện?

**SHORT ANSWER:** Vì bài toán có lifecycle và nhiều role đủ rõ để áp dụng full-stack, database, security và AI có kiểm soát.

**DETAILED ANSWER:** Đề tài cho phép chứng minh quan hệ dữ liệu, RBAC, transaction, QR, Analytics và AI trong một hệ thống quy mô vừa, phù hợp đồ án học phần.

**Nếu bị hỏi tiếp:** Không nói nhu cầu thị trường lớn nếu chưa có khảo sát; tập trung giá trị kỹ thuật/nghiệp vụ.

### B03 — Mục tiêu chính là gì?

**QUESTION:** Mục tiêu của hệ thống là gì?

**SHORT ANSWER:** Quản lý Event, Speaker/Schedule, Registration/Ticket, CheckIn, Feedback, Analytics và Announcement theo role.

**DETAILED ANSWER:** Hệ thống hướng đến một luồng xuyên suốt, dữ liệu nhất quán và vận hành đơn giản bằng Docker; AI hỗ trợ tạo Announcement draft, tóm tắt Feedback và hỏi đáp theo Event context.

**Nếu bị hỏi tiếp:** Dẫn flow `Event → Register → Ticket → CheckIn → Feedback → Analytics`.

### B04 — Tại sao dùng React?

**QUESTION:** Vì sao frontend dùng React?

**SHORT ANSWER:** React phù hợp giao diện nhiều workspace, state và component tái sử dụng.

**DETAILED ANSWER:** Project có các view theo role, form, selected Event context, loading/error state và API interaction; component-based UI giúp tách trách nhiệm rõ.

**Nếu bị hỏi tiếp:** Không khẳng định React luôn tốt nhất; đây là lựa chọn phù hợp team và scope.

### B05 — Tại sao dùng FastAPI?

**QUESTION:** Vì sao backend dùng FastAPI?

**SHORT ANSWER:** FastAPI hỗ trợ validation, dependency-based auth và OpenAPI tự động, đồng thời thuận lợi cho Python AI integration.

**DETAILED ANSWER:** Pydantic kiểm tra request/response, dependencies triển khai JWT/RBAC, Swagger giúp kiểm chứng API contract và Python dùng chung thuận tiện với OpenAI SDK.

**Nếu bị hỏi tiếp:** Nói “async-ready”, không nói mọi endpoint hiện đều async hoặc FastAPI luôn nhanh nhất.

### B06 — Tại sao dùng MySQL?

**QUESTION:** Vì sao chọn MySQL thay vì database khác?

**SHORT ANSWER:** Dữ liệu có quan hệ, transaction và integrity rõ nên relational database phù hợp.

**DETAILED ANSWER:** Project cần FK, unique constraints, cascade, row locking và aggregation. MySQL 8 đáp ứng trực tiếp và dễ chạy bằng Docker.

**Nếu bị hỏi tiếp:** MongoDB có thể dùng, nhưng không mang lợi thế rõ cho mô hình quan hệ hiện tại.

### B07 — MUST KNOW: Có bao nhiêu role?

**QUESTION:** Hệ thống có những role nào?

**SHORT ANSWER:** Bốn role: `ADMIN`, `ORGANIZER`, `STAFF`, `ATTENDEE`.

**DETAILED ANSWER:** Admin quản lý mọi Event; Organizer own Events; Staff check-in; Attendee đăng ký, Ticket, Feedback và Announcement.

**Nếu bị hỏi tiếp:** Nhấn mạnh AI không phải role/actor.

### B08 — Admin khác Organizer thế nào?

**QUESTION:** Điểm khác nhau chính giữa Admin và Organizer?

**SHORT ANSWER:** Admin truy cập mọi Event; Organizer chỉ Event do chính mình sở hữu.

**DETAILED ANSWER:** Cả hai có nhiều chức năng quản lý giống nhau, nhưng backend thêm điều kiện `owner_id` cho Organizer ở Event và related modules.

**Nếu bị hỏi tiếp:** Cross-owner resource không được trả về như một resource hợp lệ.

### B09 — MUST KNOW: JWT là gì trong project?

**QUESTION:** JWT được dùng như thế nào?

**SHORT ANSWER:** Sau login backend cấp access token; frontend gửi token trong Bearer header cho protected API.

**DETAILED ANSWER:** JWT có subject, email, role, issued/expiry time và được ký `HS256`. Backend xác minh chữ ký/expiry rồi tải User từ DB.

**Nếu bị hỏi tiếp:** Project chưa có refresh token hoặc revocation system.

### B10 — MUST KNOW: RBAC là gì?

**QUESTION:** RBAC trong hệ thống là gì?

**SHORT ANSWER:** Role-Based Access Control giới hạn endpoint theo role, kết hợp Event ownership cho Organizer.

**DETAILED ANSWER:** FastAPI dependencies `require_roles()` chặn sai role. Helper quản lý Event lọc owner cho non-Admin. Frontend hide/show chỉ hỗ trợ trải nghiệm.

**Nếu bị hỏi tiếp:** Authorization thật luôn nằm backend.

### B11 — MUST KNOW: Schedule và Session khác nhau không?

**QUESTION:** Schedule có khác Session không?

**SHORT ANSWER:** Trong scope project, Schedule record chính là một Session; UI dùng từ Session để dễ hiểu.

**DETAILED ANSWER:** Một Schedule có title, start/end, location và optional Speaker. Không cần thêm bảng Session vì sẽ trùng ý nghĩa.

**Nếu bị hỏi tiếp:** Schedule/Session phải nằm trong Event time; parallel sessions được phép.

### B12 — MUST KNOW: Registration cancel xử lý thế nào?

**QUESTION:** Khi attendee cancel registration, dữ liệu bị xóa không?

**SHORT ANSWER:** Không. Registration chuyển `CANCELLED`, Ticket chuyển `VOID`.

**DETAILED ANSWER:** Đây là soft lifecycle để giữ lịch sử và phục vụ thống kê total/registered/cancelled. Registration đã check-in không thể cancel.

**Nếu bị hỏi tiếp:** Re-register tái sử dụng row và đưa Ticket về `ACTIVE`.

### B13 — Ticket được sinh lúc nào?

**QUESTION:** Ticket được tạo khi nào?

**SHORT ANSWER:** Backend tự tạo Ticket khi tạo Registration mới.

**DETAILED ANSWER:** Attendee không có API tự tạo Ticket. Ticket có unique code và trạng thái `ACTIVE`; startup cũng backfill Ticket thiếu cho Registration cũ.

**Nếu bị hỏi tiếp:** Nếu register lại mà Ticket thiếu, backend mới tạo; nếu có thì tái kích hoạt.

### B14 — MUST KNOW: QR chứa dữ liệu gì?

**QUESTION:** QR code chứa gì?

**SHORT ANSWER:** Chỉ chứa `ticket_code`.

**DETAILED ANSWER:** QR không nhúng email, họ tên hay JWT. Backend tạo PNG on-demand qua protected endpoint; Staff decode code rồi gửi CheckIn API.

**Nếu bị hỏi tiếp:** Backend vẫn validate toàn bộ, nên QR không phải bằng chứng tự đủ.

### B15 — MUST KNOW: CheckIn được lưu ở đâu?

**QUESTION:** Hệ thống xác định attendance bằng gì?

**SHORT ANSWER:** Bằng record trong bảng `checkins`.

**DETAILED ANSWER:** `checkins.ticket_id` unique bảo đảm tối đa một CheckIn/Ticket; record còn lưu thời điểm và người thực hiện nếu còn tồn tại.

**Nếu bị hỏi tiếp:** Ticket vẫn `ACTIVE`, vì status đó biểu diễn validity, không phải attendance.

### B16 — MUST KNOW: Feedback có điều kiện gì?

**QUESTION:** Khi nào attendee được Feedback?

**SHORT ANSWER:** Khi Registration đang `REGISTERED`, có Ticket, đã CheckIn và Event `PUBLISHED` hoặc `COMPLETED`.

**DETAILED ANSWER:** Điều này bảo đảm Feedback từ người thực sự tham dự. Unique Event/User giới hạn một Feedback.

**Nếu bị hỏi tiếp:** Attendee có thể xem, update hoặc delete Feedback của mình.

### B17 — MUST KNOW: Statistics gồm gì?

**QUESTION:** Dashboard thống kê những gì?

**SHORT ANSWER:** Capacity, registration lifecycle, attendance và Feedback metrics.

**DETAILED ANSWER:** Có max/registered/available/usage rate; total/registered/cancelled; checked-in/not checked-in/attendance rate; feedback total, average và rating distribution.

**Nếu bị hỏi tiếp:** Không có payment/revenue/seat metrics.

### B18 — Attendance rate tính thế nào?

**QUESTION:** Attendance rate được tính ra sao?

**SHORT ANSWER:** `checked_in / registered × 100%`.

**DETAILED ANSWER:** Backend trả `0.0` khi denominator bằng 0 và giới hạn phần trăm tối đa 100 để tránh output bất hợp lý.

**Nếu bị hỏi tiếp:** `registered` chỉ đếm registration active.

### B19 — MUST KNOW: AI được dùng ở đâu?

**QUESTION:** Project có những AI feature nào?

**SHORT ANSWER:** Ba feature: AI Announcement Draft, AI Feedback Summary và Event AI Chatbot.

**DETAILED ANSWER:** Summary trả overview/strengths/issues/suggestions từ Feedback; draft trả title/content từ Event context và yêu cầu user; chatbot trả lời từ Event, Speaker và Schedule đã được backend cấp quyền.

**Nếu bị hỏi tiếp:** Chatbot là stateless Event Q&A; không có recommendation, persistent chat history hoặc automatic publish.

### B20 — Docker giúp gì?

**QUESTION:** Vì sao project dùng Docker Compose?

**SHORT ANSWER:** Để các thành viên chạy cùng frontend, backend và MySQL mà không cài từng runtime/database trên host.

**DETAILED ANSWER:** Compose thiết lập network, environment, ports, health dependency và persistent volume, giảm khác biệt môi trường.

**Nếu bị hỏi tiếp:** Container chia sẻ host kernel và nhẹ hơn VM.

---

## B. 20 câu trung bình

### I01 — Database có những quan hệ chính nào?

**QUESTION:** Hãy mô tả quan hệ database mà không đọc từng column.

**SHORT ANSWER:** User owns Event; Event chứa Speaker/Schedule; User + Event tạo Registration → Ticket → CheckIn; User + Event tạo Feedback; Event có Announcement.

**DETAILED ANSWER:** Các quan hệ được bảo vệ bằng FK và unique constraints; tổng cộng 9 bảng, không có bảng AI.

**Nếu bị hỏi tiếp:** Vẽ chuỗi lifecycle trước rồi mở rộng ba bảng nội dung.

### I02 — MUST KNOW: DB role là source of truth thế nào?

**QUESTION:** Nếu token có role rồi, tại sao vẫn query User DB?

**SHORT ANSWER:** Để dùng role và active status hiện tại trong database thay vì chỉ tin claim cũ.

**DETAILED ANSWER:** Token xác định User ID và tính hợp lệ phiên. Dependency sau đó tải User; authorization dùng object DB.

**Nếu bị hỏi tiếp:** Token bị ký nên client không sửa hợp lệ được, nhưng DB lookup còn hỗ trợ role/account changes.

### I03 — Tại sao dùng sessionStorage?

**QUESTION:** Vì sao token lưu `sessionStorage` thay vì `localStorage`?

**SHORT ANSWER:** Để session không tồn tại lâu qua browser session.

**DETAILED ANSWER:** Đây là trade-off đơn giản cho scope học phần. Nó không loại bỏ XSS risk; production có thể dùng mô hình cookie/refresh token được harden hơn.

**Nếu bị hỏi tiếp:** Không claim sessionStorage “an toàn tuyệt đối”.

### I04 — Tại sao tách frontend/backend?

**QUESTION:** Vì sao không render tất cả từ backend?

**SHORT ANSWER:** Tách trách nhiệm UI khỏi API/business rules, giúp phát triển và kiểm thử độc lập hơn.

**DETAILED ANSWER:** React quản lý interaction/state; FastAPI giữ validation, auth, rules và data. Contract OpenAPI làm ranh giới rõ.

**Nếu bị hỏi tiếp:** Docker vẫn đóng gói chúng thành một stack dễ chạy.

### I05 — Vì sao không dùng microservices?

**QUESTION:** Tại sao không chia nhiều microservice?

**SHORT ANSWER:** Scope vừa và domain chưa cần independent deployment; microservices sẽ tăng operational complexity.

**DETAILED ANSWER:** Backend modular theo API/service/model nhưng deploy như một service, dễ debug và phù hợp nhóm sinh viên.

**Nếu bị hỏi tiếp:** Có thể tách khi scale/ownership thực sự yêu cầu, không phải mặc định.

### I06 — MUST KNOW, DANGEROUS: Vì sao Speaker không phải User?

**QUESTION:** Tại sao không dùng bảng User cho Speaker?

**SHORT ANSWER:** Speaker là dữ liệu nội dung của Event và không nhất thiết có account/login.

**DETAILED ANSWER:** Ép Speaker thành User sẽ kéo theo password, role và authentication không cần thiết. Speaker chỉ cần profile và association với Event.

**Nếu bị hỏi tiếp:** Nếu tương lai có Speaker Portal, có thể thêm liên kết optional với User.

### I07 — Vì sao Schedule Speaker optional?

**QUESTION:** Tại sao một Session có thể không có Speaker?

**SHORT ANSWER:** Một số nội dung như break, opening hoặc networking không cần Speaker.

**DETAILED ANSWER:** FK nullable phản ánh nghiệp vụ; xóa Speaker dùng SET NULL để vẫn giữ chương trình.

**Nếu bị hỏi tiếp:** Speaker được chọn phải thuộc cùng Event.

### I08 — Tại sao soft cancel?

**QUESTION:** Tại sao cancel không xóa Registration?

**SHORT ANSWER:** Để giữ lịch sử và hỗ trợ đăng ký lại/thống kê.

**DETAILED ANSWER:** Một Event/User giữ cùng row, status đổi lifecycle; dashboard phân biệt total, registered, cancelled.

**Nếu bị hỏi tiếp:** Cancelled không chiếm capacity.

### I09 — MUST KNOW, DANGEROUS: Re-register có Ticket mới không?

**QUESTION:** Khi đăng ký lại, Ticket có đổi code không?

**SHORT ANSWER:** Không nếu Ticket đã tồn tại; backend giữ id/code và đổi về `ACTIVE`.

**DETAILED ANSWER:** Registration row cũng được tái sử dụng. Chỉ khi legacy Registration thiếu Ticket thì backend mới tạo.

**Nếu bị hỏi tiếp:** Cách này tránh nhiều Ticket cho cùng Event/User.

### I10 — Capacity được bảo vệ thế nào?

**QUESTION:** Capacity tính và kiểm tra ra sao?

**SHORT ANSWER:** Chỉ đếm Registration `REGISTERED` và so với `max_attendees`.

**DETAILED ANSWER:** Register chỉ cho Event `PUBLISHED`; backend lock Event/registration query trong transaction trước khi đếm và ghi.

**Nếu bị hỏi tiếp:** Cancelled registrations không chiếm chỗ.

### I11 — Unique constraints nào quan trọng?

**QUESTION:** Hệ thống dùng UNIQUE ở đâu để bảo vệ business rules?

**SHORT ANSWER:** Email, Event/User registration, Ticket per registration, ticket code, CheckIn per ticket và Feedback per Event/User.

**DETAILED ANSWER:** Backend validate để trả lỗi dễ hiểu, database constraint là lớp bảo vệ cuối trước race/bug.

**Nếu bị hỏi tiếp:** Registration constraint là composite `(event_id,user_id)`.

### I12 — CASCADE và SET NULL dùng thế nào?

**QUESTION:** Tại sao có cả CASCADE và SET NULL?

**SHORT ANSWER:** CASCADE xóa dữ liệu không còn ý nghĩa; SET NULL giữ dữ liệu vẫn có giá trị lịch sử/nội dung.

**DETAILED ANSWER:** Event delete cascade domain data. Speaker delete giữ Schedule; creator delete giữ Announcement và null creator.

**Nếu bị hỏi tiếp:** Ticket/CheckIn cascade gián tiếp qua Registration/Ticket.

### I13 — Cross-event ticket trả 404 vì sao?

**QUESTION:** Tại sao ticket của Event khác không trả 403?

**SHORT ANSWER:** 404 tránh tiết lộ resource có tồn tại ngoài scope truy cập.

**DETAILED ANSWER:** Query luôn ràng buộc ticket code/id với Event. Không match được coi như không tìm thấy trong resource scope.

**Nếu bị hỏi tiếp:** Đây là giảm information leakage, không thay thế authorization.

### I14 — HTTP status mapping?

**QUESTION:** Phân biệt 401, 403, 404, 409, 422?

**SHORT ANSWER:** 401 auth; 403 role/ownership/eligibility; 404 resource; 409 lifecycle conflict; 422 validation.

**DETAILED ANSWER:** Ví dụ duplicate CheckIn là 409, Session time sai là 422, Feedback trước CheckIn là 403.

**Nếu bị hỏi tiếp:** OpenAPI cũng có schema validation responses.

### I15 — QR endpoint bảo vệ thế nào?

**QUESTION:** Tại sao không để QR là URL public?

**SHORT ANSWER:** QR là dữ liệu Ticket của attendee nên endpoint yêu cầu JWT và ownership.

**DETAILED ANSWER:** Backend kiểm tra Ticket thuộc current attendee và đang active; frontend dùng authenticated Blob flow.

**Nếu bị hỏi tiếp:** QR payload ít dữ liệu nhưng ticket code vẫn là credential vận hành cần bảo vệ.

### I16 — Announcement recipient hoạt động ra sao?

**QUESTION:** Không có recipient table thì attendee nhận thông báo thế nào?

**SHORT ANSWER:** Visibility được query động từ Announcement `PUBLISHED` và Registration `REGISTERED`.

**DETAILED ANSWER:** Cancel thì Announcement tự ẩn; re-register thì tự hiện, không cần đồng bộ recipient rows.

**Nếu bị hỏi tiếp:** Project chưa gửi email; “delivery” là qua attendee workspace.

### I17 — AI Feedback input gồm gì?

**QUESTION:** Backend gửi gì cho AI Feedback Summary?

**SHORT ANSWER:** Event title, aggregate rating/distribution và tối đa 100 rating/comment đã normalize.

**DETAILED ANSWER:** Query không truyền User object hoặc email. Comments vẫn là user text và được coi là untrusted input.

**Nếu bị hỏi tiếp:** Summary chạy on-demand, không lưu DB.

### I18 — AI structured output để làm gì?

**QUESTION:** Tại sao yêu cầu AI trả structured output?

**SHORT ANSWER:** Để backend validate đúng schema trước khi trả UI.

**DETAILED ANSWER:** Response cần summary cùng ba list hoặc title/content. Pydantic/JSON schema giảm output khó parse; invalid output trả 502.

**Nếu bị hỏi tiếp:** Không có biện pháp nào bảo đảm semantic correctness 100%, nên vẫn cần human review.

### I19 — Mock Mode có vai trò gì?

**QUESTION:** Mock Mode có phải AI không?

**SHORT ANSWER:** Không. Đó là generator local deterministic cho test/demo.

**DETAILED ANSWER:** `AI_MODE=mock` bỏ phụ thuộc Internet/API key; `AI_MODE=openai` mới gọi OpenAI từ backend.

**Nếu bị hỏi tiếp:** Demo phải nói rõ đang dùng mode nào.

### I20 — Hệ thống đã test gì?

**QUESTION:** Nhóm kiểm thử hệ thống như thế nào?

**SHORT ANSWER:** Frontend build, Docker health, smoke/regression và E2E cho role/lifecycle chính.

**DETAILED ANSWER:** E2E đi từ Event → Registration → Ticket → CheckIn → Feedback → Statistics → AI, cùng ownership và cascade cleanup.

**Nếu bị hỏi tiếp:** Không công bố coverage percentage vì chưa đo.

---

## C. 20 câu khó / vặn

### H01 — DANGEROUS: AI có phải actor không?

**QUESTION:** AI thực hiện tác vụ, tại sao không vẽ AI là actor?

**SHORT ANSWER:** Vì AI không chủ động tương tác để đạt business goal; user mới là actor.

**DETAILED ANSWER:** User gọi feature, backend chuẩn bị context và gọi AI như internal/external supporting service. AI không login, publish, register hay khởi tạo workflow.

**Nếu bị hỏi tiếp:** OpenAI API có thể là external system trong architecture diagram, nhưng không phải business actor của use-case model này.

### H02 — MUST KNOW, DANGEROUS: Organizer security nằm ở đâu?

**QUESTION:** Nếu Organizer sửa frontend để mở Event người khác thì sao?

**SHORT ANSWER:** Không được; backend lọc `owner_id` ở mọi management request.

**DETAILED ANSWER:** Frontend chỉ điều hướng/UX. Role dependency và `get_event_for_management()` bảo vệ Event cùng related resources.

**Nếu bị hỏi tiếp:** Đoán ID không bypass được query ownership.

### H03 — Nếu sửa role trong JWT?

**QUESTION:** User decode JWT rồi đổi role thành ADMIN thì sao?

**SHORT ANSWER:** Token sửa sẽ sai chữ ký và bị từ chối.

**DETAILED ANSWER:** Backend xác minh `HS256` bằng secret. Sau đó còn tải User DB và dùng role hiện tại.

**Nếu bị hỏi tiếp:** Nếu secret bị lộ là security incident; phải rotate secret và bổ sung revocation/monitoring trong production.

### H04 — Hai attendee tranh suất cuối?

**QUESTION:** Nếu hai request đăng ký đồng thời khi còn một chỗ?

**SHORT ANSWER:** Backend khóa Event row trong transaction trước khi kiểm tra capacity và ghi.

**DETAILED ANSWER:** `SELECT ... FOR UPDATE` serialize các registration transaction cạnh tranh trên cùng Event, nên request sau thấy count mới và bị conflict nếu full.

**Nếu bị hỏi tiếp:** Đây là DB concurrency control; load test lớn chưa thuộc scope hiện tại.

### H05 — Gửi speaker_id từ Event khác?

**QUESTION:** Client tự gửi Speaker ID của Event khác vào Session thì sao?

**SHORT ANSWER:** Backend query Speaker với cả `speaker_id` và `event_id`; không match thì trả 422.

**DETAILED ANSWER:** Không dựa vào dropdown frontend. Đây là validation cross-aggregate ở API.

**Nếu bị hỏi tiếp:** FK đơn thuần chỉ chứng minh Speaker tồn tại, không chứng minh cùng Event, nên cần rule backend.

### H06 — Scanner đọc nhiều frame gây duplicate?

**QUESTION:** Camera có thể decode cùng QR nhiều lần rất nhanh, hệ thống chống duplicate thế nào?

**SHORT ANSWER:** Backend kiểm tra CheckIn tồn tại và database unique `ticket_id`.

**DETAILED ANSWER:** Nếu hai request vẫn race, unique constraint chặn bản ghi thứ hai và API trả 409.

**Nếu bị hỏi tiếp:** UI cũng khóa/đóng scanner khi xử lý, nhưng backend/DB mới là bảo vệ quyết định.

### H07 — DANGEROUS: Ticket ACTIVE sau CheckIn có phải bug?

**QUESTION:** Ticket đã dùng mà vẫn `ACTIVE`, thiết kế có sai không?

**SHORT ANSWER:** Không. `ACTIVE/VOID` biểu diễn validity; CheckIn record biểu diễn attendance.

**DETAILED ANSWER:** Tách hai state tránh nhồi hai ý nghĩa vào Ticket và hỗ trợ query attendance rõ ràng. Duplicate bị chặn bởi CheckIn unique.

**Nếu bị hỏi tiếp:** Với vé multi-entry tương lai, model CheckIn cần thay đổi; current flow là một lần.

### H08 — Hủy sau CheckIn?

**QUESTION:** Attendee check-in xong rồi cancel để giải phóng chỗ thì sao?

**SHORT ANSWER:** Backend từ chối 409.

**DETAILED ANSWER:** Attendance đã xảy ra nên không cho quay lifecycle về cancelled; điều này cũng giữ denominator/statistics hợp lý.

**Nếu bị hỏi tiếp:** Admin override không có trong scope hiện tại.

### H09 — Vì sao không refresh token?

**QUESTION:** JWT chỉ có access token có thiếu không?

**SHORT ANSWER:** Đây là trade-off theo scope học phần, dùng session ngắn và login lại.

**DETAILED ANSWER:** Production nên cân nhắc refresh token rotation, revocation, secure cookies và device/session management.

**Nếu bị hỏi tiếp:** Không nói hiện tại đã có logout server-side; logout frontend xóa session token.

### H10 — Vì sao không Alembic?

**QUESTION:** `create_all()` có phù hợp production không?

**SHORT ANSWER:** Phù hợp setup schema ổn định của đồ án; không phải migration strategy production đầy đủ.

**DETAILED ANSWER:** Project dùng `Base.metadata.create_all()` để clone/run đơn giản. Schema evolution dài hạn cần Alembic, versioning và rollback plan.

**Nếu bị hỏi tiếp:** `create_all()` không tự migrate mọi thay đổi column.

### H11 — Vì sao không Redis?

**QUESTION:** Tại sao không dùng Redis cho capacity/locking/cache?

**SHORT ANSWER:** Database transaction đã xử lý consistency hiện tại; Redis sẽ tăng complexity chưa cần thiết.

**DETAILED ANSWER:** Core rules cần relational transaction. Project chưa có workload chứng minh cần distributed cache, queue hay lock.

**Nếu bị hỏi tiếp:** Có thể thêm khi đo được bottleneck, không dùng chỉ để làm kiến trúc phức tạp.

### H12 — Nếu AI trả sai/hallucinate?

**QUESTION:** AI tạo Announcement sai thì trách nhiệm ở đâu?

**SHORT ANSWER:** AI output chỉ là draft; user phải review và chủ động save/publish.

**DETAILED ANSWER:** Endpoint không có side effect, dùng context giới hạn và structured output. Human-in-the-loop giảm nhưng không loại bỏ hoàn toàn rủi ro.

**Nếu bị hỏi tiếp:** Core authorization và lifecycle không phụ thuộc AI.

### H13 — Prompt injection từ Feedback?

**QUESTION:** Feedback có thể chứa câu lệnh đánh lừa AI không?

**SHORT ANSWER:** Backend coi comments là untrusted data, giới hạn context và tách chúng trong payload/instructions.

**DETAILED ANSWER:** Output bị schema validation, input normalize/truncate và request không cho AI side effects. Tuy nhiên không tuyên bố miễn nhiễm 100%.

**Nếu bị hỏi tiếp:** Production có thể thêm moderation, stronger isolation và adversarial testing.

### H14 — AI privacy?

**QUESTION:** Có gửi thông tin cá nhân attendee sang OpenAI không?

**SHORT ANSWER:** Query Summary không gửi User object/email; chỉ gửi dữ liệu Feedback cần thiết và Event title.

**DETAILED ANSWER:** Comment do user nhập vẫn có thể tự chứa PII, nên production cần policy/redaction bổ sung. Request đặt `store=False` theo implementation.

**Nếu bị hỏi tiếp:** Không gọi dữ liệu “ẩn danh tuyệt đối”.

### H15 — Tại sao AI Summary không lưu DB?

**QUESTION:** Không lưu kết quả AI có lãng phí và khó audit không?

**SHORT ANSWER:** Current scope chọn on-demand để tránh stale data và thêm lifecycle/versioning cho AI output.

**DETAILED ANSWER:** Feedback thay đổi thì summary cũ dễ lỗi thời. Lưu trữ sẽ cần generated_at, model, prompt/version, approval và regenerate rules.

**Nếu bị hỏi tiếp:** Đây là hướng mở rộng hợp lý nếu có yêu cầu audit/cost optimization.

### H16 — Tại sao không MongoDB?

**QUESTION:** Announcement/Feedback là text, sao không dùng MongoDB?

**SHORT ANSWER:** Toàn domain có quan hệ và consistency mạnh hơn lợi ích document flexibility.

**DETAILED ANSWER:** Registration, Ticket, CheckIn và ownership cần FK, unique, transaction, aggregation. MySQL phù hợp design hiện tại.

**Nếu bị hỏi tiếp:** Công nghệ phải theo dữ liệu/rule, không theo độ phổ biến.

### H17 — Scale hệ thống thế nào?

**QUESTION:** Nếu lượng người dùng tăng lớn, kiến trúc này mở rộng ra sao?

**SHORT ANSWER:** Có thể phục vụ frontend static, scale nhiều backend sau reverse proxy và dùng managed MySQL; hiện chưa triển khai.

**DETAILED ANSWER:** Trước tiên cần load test, indexes/queries audit, connection pooling, observability và shared configuration. AI calls có thể cần queue/rate control.

**Nếu bị hỏi tiếp:** Không claim horizontal scaling đã được kiểm chứng.

### H18 — Security production còn thiếu gì?

**QUESTION:** Hệ thống đã production-grade chưa?

**SHORT ANSWER:** Chưa tuyên bố production-grade; hiện phù hợp academic scope và local/demo deployment.

**DETAILED ANSWER:** Production cần HTTPS/reverse proxy, secret manager, refresh/revocation, rate limiting, audit logs, monitoring, backup, migration và security testing chuyên sâu.

**Nếu bị hỏi tiếp:** Các lớp hiện có là bcrypt, JWT, backend RBAC, ownership và environment secrets.

### H19 — Docker volume và mất dữ liệu?

**QUESTION:** Rebuild container có làm mất database không?

**SHORT ANSWER:** Không nếu giữ named volume `mysql_data`; `docker compose down -v` mới xóa volume.

**DETAILED ANSWER:** Container có thể recreate độc lập với volume. Documentation cảnh báo rõ không dùng `-v` nếu cần giữ dữ liệu.

**Nếu bị hỏi tiếp:** Production cần backup/restore ngoài local Docker volume.

### H20 — Nếu được cải tiến, ưu tiên gì?

**QUESTION:** Năm hướng phát triển tiếp theo là gì?

**SHORT ANSWER:** Event–Staff assignment, notification/email, refresh-token auth, migrations và richer reporting.

**DETAILED ANSWER:** Đây là future work, chưa implemented. Có thể cân nhắc audit log, observability và AI result governance khi yêu cầu tăng.

**Nếu bị hỏi tiếp:** Ưu tiên theo risk/value: migrations và auth hardening trước feature phụ cho production.

## Cách xử lý khi không biết câu trả lời

> Phần đó hiện chưa nằm trong phạm vi đồ án nên nhóm chưa triển khai và chưa có số liệu để khẳng định. Nếu mở rộng, nhóm sẽ bắt đầu bằng việc xác định yêu cầu, đo tải/rủi ro, rồi chọn giải pháp phù hợp thay vì giả định.

Không tranh luận phòng thủ. Thừa nhận trade-off, nói đúng current implementation và phân biệt rõ future work.
