import React from "react";

function SpeakerForm({ form, editing, loading, error, onChange, onSubmit, onCancel }) {
  return (
    <section className="speaker-form form-section-card" aria-labelledby="speaker-form-title">
      <div className="editor-heading" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem", marginBottom: "1rem" }}>
        <div>
          <p className="hero-eyebrow" style={{ margin: 0 }}>
            {editing ? "CHỈNH SỬA DIỄN GIẢ" : "THÊM DIỄN GIẢ MỚI"}
          </p>
          <h3 id="speaker-form-title" style={{ color: "var(--text-primary)", margin: "0.25rem 0 0" }}>
            {editing ? "Cập nhật diễn giả" : "Thêm diễn giả mới"}
          </h3>
        </div>
        <button type="button" className="event-modal-close-btn" onClick={onCancel} disabled={loading} aria-label="Đóng">
          ✕
        </button>
      </div>

      {error && (
        <div className="inline-message error-message" role="alert" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div className="form-group" style={{ marginBottom: "1rem" }}>
        <label htmlFor="speaker-name">Họ và tên *</label>
        <input
          id="speaker-name"
          className="form-input-text"
          value={form.full_name}
          minLength={2}
          maxLength={150}
          required
          disabled={loading}
          onChange={(event) => onChange("full_name", event.target.value)}
          placeholder="Ví dụ: TS. Nguyễn Văn A..."
        />
        <span className="form-char-count">{form.full_name.length}/150 ký tự</span>
      </div>

      <div className="form-grid-2col" style={{ marginBottom: "1rem" }}>
        <div className="form-group">
          <label htmlFor="speaker-title">Chức danh / Vai trò</label>
          <input
            id="speaker-title"
            className="form-input-text"
            value={form.title}
            maxLength={150}
            disabled={loading}
            onChange={(event) => onChange("title", event.target.value)}
            placeholder="Ví dụ: Giám đốc Công nghệ, AI Researcher..."
          />
        </div>
        <div className="form-group">
          <label htmlFor="speaker-organization">Tổ chức / Đơn vị</label>
          <input
            id="speaker-organization"
            className="form-input-text"
            value={form.organization}
            maxLength={200}
            disabled={loading}
            onChange={(event) => onChange("organization", event.target.value)}
            placeholder="Ví dụ: Viện Công nghệ, Google, OpenAI..."
          />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: "1rem" }}>
        <label htmlFor="speaker-email">Địa chỉ Email liên hệ</label>
        <input
          id="speaker-email"
          type="email"
          className="form-input-text"
          value={form.email}
          maxLength={255}
          disabled={loading}
          onChange={(event) => onChange("email", event.target.value)}
          placeholder="diengia@example.com"
        />
      </div>

      <div className="form-group" style={{ marginBottom: "1.25rem" }}>
        <label htmlFor="speaker-bio">Tiểu sử tóm tắt</label>
        <textarea
          id="speaker-bio"
          className="form-textarea"
          rows={4}
          value={form.bio}
          maxLength={5000}
          disabled={loading}
          onChange={(event) => onChange("bio", event.target.value)}
          placeholder="Kinh nghiệm, chuyên môn nghiên cứu, thành tựu của diễn giả..."
        />
        <span className="form-char-count">{form.bio.length}/5000 ký tự</span>
      </div>

      <div className="editor-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
        <button type="button" className="secondary-button" onClick={onCancel} disabled={loading}>
          Hủy
        </button>
        <button type="button" className="primary-button" onClick={onSubmit} disabled={loading}>
          {loading ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Thêm diễn giả"}
        </button>
      </div>
    </section>
  );
}

export default SpeakerForm;
