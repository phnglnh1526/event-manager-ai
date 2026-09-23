import React from "react";
import { AIBadge, AIError, AIIcon, AILoading } from "./AIComponents";
import { ANNOUNCEMENT_STATUS_LABELS } from "../locales/vi";

const TONES = [
  ["PROFESSIONAL", "Chuyên nghiệp & Trang trọng"],
  ["FRIENDLY", "Thân thiện & Gần gũi"],
  ["URGENT", "Khẩn cấp & Cần lưu ý ngay"],
];

function AnnouncementForm({
  editor,
  form,
  onFormChange,
  onClose,
  onSave,
  onDelete,
  saving,
  formError,
  ai,
  onAiChange,
  onGenerate,
}) {
  const isEditing = editor.id != null;
  const isPublished = editor.status === "PUBLISHED";

  return (
    <section className="announcement-editor form-section-card" aria-labelledby="announcement-form-title">
      <div
        className="editor-heading"
        style={{ borderBottom: "1px solid #1a203f", paddingBottom: "0.85rem", marginBottom: "1.15rem" }}
      >
        <div>
          <p className="hero-eyebrow" style={{ margin: 0 }}>
            {isEditing ? "CHỈNH SỬA THÔNG BÁO" : "TẠO THÔNG BÁO MỚI"}
          </p>
          <h3 id="announcement-form-title" style={{ color: "#ffffff", margin: "0.25rem 0 0.35rem" }}>
            {isEditing ? "Cập nhật thông báo" : "Soạn thông báo sự kiện"}
          </h3>
          {isEditing && (
            <span
              className={`mgmt-card-status-badge status-badge-${editor.status.toLowerCase()}`}
              style={{ position: "static", display: "inline-block", marginTop: "0.25rem" }}
            >
              {ANNOUNCEMENT_STATUS_LABELS[editor.status] || editor.status}
            </span>
          )}
        </div>
        <button
          type="button"
          className="event-modal-close-btn"
          onClick={onClose}
          disabled={saving}
          aria-label="Đóng"
        >
          ✕
        </button>
      </div>

      {/* Standardized AI Assistant Section */}
      <section className="ai-announcement-assistant ai-card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
        <div className="ai-assistant-toggle-bar">
          <div className="ai-assistant-label" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <AIIcon size="compact" />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontWeight: 700, color: "#ffffff" }}>Trợ lý AI tạo thông báo</span>
                {ai.source && <AIBadge source={ai.source} />}
              </div>
              <span className="ai-assistant-subtext">
                Tự động phác thảo bản nháp thông minh vào biểu mẫu bên dưới.
              </span>
            </div>
          </div>

          <button
            type="button"
            className={ai.expanded ? "secondary-button compact-button" : "ai-button-primary"}
            onClick={() => onAiChange("expanded", !ai.expanded)}
            disabled={saving || ai.loading}
          >
            {ai.expanded ? "Thu gọn Trợ lý" : "✨ Tạo nội dung bằng AI"}
          </button>
        </div>

        {ai.expanded && (
          <div className="ai-assistant-form-fields" style={{ marginTop: "1rem" }}>
            <div className="form-group">
              <label htmlFor="ai-purpose">Mục đích chính của thông báo *</label>
              <textarea
                id="ai-purpose"
                className="form-textarea"
                rows={2}
                value={ai.purpose}
                maxLength={500}
                disabled={ai.loading}
                placeholder="Ví dụ: Cập nhật phòng họp cho phiên thảo luận AI buổi chiều và thời gian giải lao..."
                onChange={(e) => onAiChange("purpose", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="ai-key-points">
                Các điểm trọng tâm <span>(mỗi dòng 1 ý, tối đa 10 ý)</span>
              </label>
              <textarea
                id="ai-key-points"
                className="form-textarea"
                rows={3}
                value={ai.keyPoints}
                disabled={ai.loading}
                placeholder={"Chuyển từ Hội trường A sang Hội trường C\nThời gian bắt đầu lùi 15 phút\nCó phục vụ trà và cà phê"}
                onChange={(e) => onAiChange("keyPoints", e.target.value)}
              />
            </div>

            <div className="ai-assistant-actions">
              <div className="form-group" style={{ minWidth: 200, flex: 1 }}>
                <label htmlFor="ai-tone">Văn phong diễn đạt</label>
                <select
                  id="ai-tone"
                  className="form-select"
                  value={ai.tone}
                  disabled={ai.loading}
                  onChange={(e) => onAiChange("tone", e.target.value)}
                >
                  {TONES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="ai-button-primary"
                onClick={onGenerate}
                disabled={ai.loading || saving || !ai.purpose.trim()}
                style={{ alignSelf: "flex-end" }}
              >
                {ai.loading ? (
                  <>
                    <span className="app-loader" style={{ width: 14, height: 14, margin: 0 }} />
                    <span>Đang tạo nội dung...</span>
                  </>
                ) : ai.source ? (
                  <>
                    <span>✦</span>
                    <span>Tạo lại với AI</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Khởi tạo bản nháp AI</span>
                  </>
                )}
              </button>
            </div>

            {/* Standardized AI Loading state */}
            {ai.loading && (
              <div style={{ marginTop: "0.75rem" }}>
                <AILoading text="Đang tạo nội dung thông báo thông minh..." />
              </div>
            )}

            {/* Standardized AI Error state with Retry */}
            {ai.error && (
              <AIError
                message={ai.error || "Không thể phân tích dữ liệu."}
                onRetry={onGenerate}
              />
            )}

            {/* Success notice */}
            {ai.source && !ai.loading && !ai.error && (
              <div
                className="inline-message success-message"
                style={{
                  marginTop: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                }}
              >
                <AIBadge source={ai.source} />
                <span>
                  Bản nháp AI đã được điền vào form bên dưới. Bạn có thể chỉnh sửa trước khi quyết định lưu hoặc đăng.
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Editor Form Fields */}
      <div className="form-group" style={{ marginBottom: "1rem" }}>
        <label htmlFor="announcement-title">Tiêu đề thông báo *</label>
        <input
          id="announcement-title"
          className="form-input-text"
          value={form.title}
          maxLength={200}
          disabled={saving}
          onChange={(event) => onFormChange("title", event.target.value)}
          placeholder="Nhập tiêu đề thông báo ngắn gọn, rõ nghĩa..."
        />
        <span className="form-char-count">{form.title.length}/200 ký tự</span>
      </div>

      <div className="form-group" style={{ marginBottom: "1.25rem" }}>
        <label htmlFor="announcement-content">Nội dung chi tiết *</label>
        <textarea
          id="announcement-content"
          className="form-textarea"
          rows={8}
          value={form.content}
          maxLength={5000}
          disabled={saving}
          onChange={(event) => onFormChange("content", event.target.value)}
          placeholder="Nhập toàn văn thông báo gửi đến tất cả người tham dự sự kiện..."
        />
        <span className="form-char-count">{form.content.length}/5000 ký tự</span>
      </div>

      {formError && (
        <div className="inline-message error-message" role="alert" style={{ marginBottom: "1rem" }}>
          {formError}
        </div>
      )}

      {/* Action Buttons */}
      <div
        className="editor-actions"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          {isEditing && (
            <button
              type="button"
              className="mgmt-btn-delete"
              onClick={onDelete}
              disabled={saving}
            >
              Xóa thông báo
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="secondary-button"
            onClick={() => onSave(isEditing ? null : "DRAFT")}
            disabled={saving}
          >
            {saving ? "Đang lưu..." : isEditing ? "Lưu thay đổi" : "Lưu bản nháp"}
          </button>

          {isPublished ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => onSave("DRAFT")}
              disabled={saving}
              style={{ borderColor: "#f59e0b", color: "#fbbf24" }}
            >
              Hủy đăng (Về nháp)
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              onClick={() => onSave("PUBLISHED")}
              disabled={saving}
              style={{ background: "#22c55e", color: "#080b1a", fontWeight: 800 }}
            >
              Đăng thông báo ngay
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default AnnouncementForm;
