import React from "react";

const localValue = (value) => (typeof value === "string" ? value.slice(0, 16) : "");
const clock = (value) => localValue(value).slice(11, 16);
const dateLabel = (value) => {
  const literal = localValue(value);
  return `${literal.slice(8, 10)}/${literal.slice(5, 7)}/${literal.slice(0, 4)}`;
};

function ScheduleForm({
  event,
  form,
  speakers,
  speakersLoading,
  editing,
  loading,
  error,
  onChange,
  onSubmit,
  onCancel,
}) {
  return (
    <section className="schedule-form form-section-card" aria-labelledby="schedule-form-title">
      <div
        className="editor-heading"
        style={{ borderBottom: "1px solid #1a203f", paddingBottom: "0.75rem", marginBottom: "1rem" }}
      >
        <div>
          <p className="hero-eyebrow" style={{ margin: 0 }}>
            {editing ? "CHỈNH SỬA PHIÊN LỊCH TRÌNH" : "THÊM PHIÊN MỚI"}
          </p>
          <h3 id="schedule-form-title" style={{ color: "#ffffff", margin: "0.25rem 0 0" }}>
            {editing ? "Cập nhật phiên" : "Thêm phiên lịch trình"}
          </h3>
        </div>
        <button type="button" className="event-modal-close-btn" onClick={onCancel} disabled={loading} aria-label="Đóng">
          ✕
        </button>
      </div>

      <div
        style={{
          background: "rgba(217, 70, 239, 0.08)",
          border: "1px solid rgba(217, 70, 239, 0.25)",
          borderRadius: 8,
          padding: "0.65rem 0.85rem",
          fontSize: "0.8rem",
          color: "#f0abfc",
          marginBottom: "1rem",
        }}
      >
        <span style={{ fontWeight: 600 }}>Khung thời gian cho phép: </span>
        Từ <strong>{clock(event.start_time)}</strong> đến <strong>{clock(event.end_time)}</strong> (Ngày {dateLabel(event.start_time)}).
      </div>

      {error && (
        <div className="inline-message error-message" role="alert" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div className="form-group" style={{ marginBottom: "1rem" }}>
        <label htmlFor="session-title">Tên phiên thảo luận / hoạt động *</label>
        <input
          id="session-title"
          className="form-input-text"
          value={form.title}
          minLength={3}
          maxLength={200}
          required
          disabled={loading}
          onChange={(e) => onChange("title", e.target.value)}
          placeholder="Ví dụ: Khai mạc sự kiện, AI trong y tế..."
        />
      </div>

      <div className="form-grid-2col" style={{ marginBottom: "1rem" }}>
        <div className="form-group">
          <label htmlFor="session-start">Thời gian bắt đầu *</label>
          <input
            id="session-start"
            type="datetime-local"
            className="form-input-text"
            value={form.start_time}
            disabled={loading}
            onChange={(e) => onChange("start_time", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="session-end">Thời gian kết thúc *</label>
          <input
            id="session-end"
            type="datetime-local"
            className="form-input-text"
            value={form.end_time}
            disabled={loading}
            onChange={(e) => onChange("end_time", e.target.value)}
          />
        </div>
      </div>

      <div className="form-grid-2col" style={{ marginBottom: "1rem" }}>
        <div className="form-group">
          <label htmlFor="session-location">Địa điểm / Phòng họp</label>
          <input
            id="session-location"
            className="form-input-text"
            value={form.location}
            maxLength={255}
            disabled={loading}
            onChange={(e) => onChange("location", e.target.value)}
            placeholder="Ví dụ: Hội trường chính, Phòng 201..."
          />
        </div>

        <div className="form-group">
          <label htmlFor="session-speaker">Diễn giả phụ trách</label>
          <select
            id="session-speaker"
            className="form-select"
            value={form.speaker_id}
            disabled={loading || speakersLoading}
            onChange={(e) => onChange("speaker_id", e.target.value)}
          >
            <option value="">Chưa phân công diễn giả</option>
            {speakers.map((speaker) => (
              <option key={speaker.id} value={speaker.id}>
                {speaker.full_name} {speaker.title ? `(${speaker.title})` : ""}
              </option>
            ))}
          </select>
          {speakersLoading && <small style={{ color: "#94a3b8" }}>Đang tải danh sách diễn giả...</small>}
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: "1.25rem" }}>
        <label htmlFor="session-description">Mô tả nội dung phiên</label>
        <textarea
          id="session-description"
          className="form-textarea"
          rows={3}
          value={form.description}
          maxLength={5000}
          disabled={loading}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="Tóm tắt nội dung sẽ trình bày, thảo luận hoặc hoạt động chính..."
        />
      </div>

      <div className="editor-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
        <button type="button" className="secondary-button" onClick={onCancel} disabled={loading}>
          Hủy
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={onSubmit}
          disabled={loading || speakersLoading}
        >
          {loading ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Thêm phiên"}
        </button>
      </div>
    </section>
  );
}

export default ScheduleForm;
