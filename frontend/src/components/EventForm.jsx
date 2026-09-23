import React from "react";
import EventImageUpload from "./EventImageUpload";

const EVENT_STATUSES = [
  ["DRAFT", "Bản nháp"],
  ["PUBLISHED", "Đã công bố"],
  ["COMPLETED", "Đã kết thúc"],
  ["CANCELLED", "Đã hủy"],
];

function EventForm({
  eventId,
  form,
  onChange,
  onClose,
  onSubmit,
  onDelete,
  loading,
  error,
}) {
  const isEditing = eventId != null;

  return (
    <div
      className="event-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-form-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div className="event-modal-dialog">
        {/* Header */}
        <div className="event-modal-header">
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              {isEditing ? "CHỈNH SỬA SỰ KIỆN" : "TẠO SỰ KIỆN MỚI"}
            </p>
            <h2 id="event-form-title">
              {isEditing ? "Cập nhật sự kiện" : "Tạo sự kiện mới"}
            </h2>
          </div>
          <button
            type="button"
            className="event-modal-close-btn"
            onClick={onClose}
            disabled={loading}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Form Body with Clear Sections */}
        <div className="event-modal-body">
          {error && (
            <div className="inline-message error-message" role="alert">
              {error}
            </div>
          )}

          {/* SECTION 1: THÔNG TIN CƠ BẢN */}
          <section className="form-section-card">
            <h3 className="form-section-legend">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              1. Thông tin cơ bản
            </h3>

            <div className="form-group">
              <label htmlFor="event-title">Tên sự kiện *</label>
              <input
                id="event-title"
                className="form-input-text"
                value={form.title}
                maxLength={200}
                disabled={loading}
                onChange={(e) => onChange("title", e.target.value)}
                placeholder="Nhập tên sự kiện nổi bật..."
              />
              <span className="form-char-count">{form.title.length}/200 ký tự</span>
            </div>

            <div className="form-group">
              <label htmlFor="event-description">Mô tả chi tiết</label>
              <textarea
                id="event-description"
                className="form-textarea"
                rows={3}
                value={form.description}
                disabled={loading}
                onChange={(e) => onChange("description", e.target.value)}
                placeholder="Cung cấp nội dung, mục tiêu hoặc chủ đề của sự kiện..."
              />
            </div>
          </section>

          {/* SECTION 2: THỜI GIAN & ĐỊA ĐIỂM */}
          <section className="form-section-card">
            <h3 className="form-section-legend">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              2. Thời gian &amp; Địa điểm
            </h3>

            <div className="form-group">
              <label htmlFor="event-location">Địa điểm tổ chức *</label>
              <input
                id="event-location"
                className="form-input-text"
                value={form.location}
                maxLength={255}
                disabled={loading}
                onChange={(e) => onChange("location", e.target.value)}
                placeholder="Ví dụ: Hội trường A, Trung tâm Hội nghị Quốc gia..."
              />
            </div>

            <div className="form-grid-2col">
              <div className="form-group">
                <label htmlFor="event-start">Thời gian bắt đầu *</label>
                <input
                  id="event-start"
                  className="form-input-text"
                  type="datetime-local"
                  value={form.start_time}
                  disabled={loading}
                  onChange={(e) => onChange("start_time", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="event-end">Thời gian kết thúc *</label>
                <input
                  id="event-end"
                  className="form-input-text"
                  type="datetime-local"
                  value={form.end_time}
                  disabled={loading}
                  onChange={(e) => onChange("end_time", e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* SECTION 3: QUY MÔ & TRẠNG THÁI */}
          <section className="form-section-card">
            <h3 className="form-section-legend">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              3. Quy mô &amp; Trạng thái
            </h3>

            <div className="form-grid-2col">
              <div className="form-group">
                <label htmlFor="event-capacity">Sức chứa tối đa (người) *</label>
                <input
                  id="event-capacity"
                  className="form-input-text"
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  value={form.max_attendees}
                  disabled={loading}
                  onChange={(e) => onChange("max_attendees", e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="event-status">Trạng thái phát hành</label>
                <select
                  id="event-status"
                  className="form-select"
                  value={form.status}
                  disabled={loading}
                  onChange={(e) => onChange("status", e.target.value)}
                >
                  {EVENT_STATUSES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* SECTION 4: ẢNH BÌA SỰ KIỆN */}
          <section className="form-section-card">
            <h3 className="form-section-legend">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              4. Ảnh bìa sự kiện
            </h3>

            <EventImageUpload
              currentImageUrl={form.cover_image_url}
              pendingFile={form.pendingFile}
              onFileSelect={(file) => onChange("pendingFile", file)}
              onRemove={() => {
                onChange("pendingFile", null);
                onChange("cover_image_url", null);
              }}
              uploading={loading && Boolean(form.pendingFile)}
              disabled={loading}
            />
          </section>
        </div>

        {/* Modal Footer */}
        <div className="event-modal-footer">
          <div className="left-actions">
            {isEditing && (
              <button
                type="button"
                className="mgmt-btn-delete"
                onClick={onDelete}
                disabled={loading}
              >
                {loading ? "Đang xử lý..." : "Xóa sự kiện"}
              </button>
            )}
          </div>

          <div className="right-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={loading}
            >
              Hủy
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={onSubmit}
              disabled={loading}
            >
              {loading
                ? isEditing
                  ? "Đang lưu..."
                  : "Đang tạo..."
                : isEditing
                ? "Lưu thay đổi"
                : "Tạo sự kiện"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EventForm;
