import React from "react";

const TONES = [
  ["PROFESSIONAL", "Professional"],
  ["FRIENDLY", "Friendly"],
  ["URGENT", "Urgent"],
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
  const sourceLabel = ai.source === "openai" ? "OpenAI" : "Mock Mode";

  return (
    <section className="announcement-editor" aria-labelledby="announcement-form-title">
      <div className="editor-heading">
        <div>
          <p className="eyebrow">{isEditing ? "EDIT ANNOUNCEMENT" : "NEW ANNOUNCEMENT"}</p>
          <h2 id="announcement-form-title">{isEditing ? "Update announcement" : "Create announcement"}</h2>
          {isEditing && <span className={`status-badge status-${editor.status.toLowerCase()}`}>{editor.status}</span>}
        </div>
        <button type="button" className="text-button" onClick={onClose} disabled={saving}>Close</button>
      </div>

      <div className="editor-field">
        <label htmlFor="announcement-title">Title</label>
        <input id="announcement-title" value={form.title} maxLength={200} disabled={saving} onChange={(event) => onFormChange("title", event.target.value)} />
        <span className="character-count">{form.title.length}/200</span>
      </div>
      <div className="editor-field">
        <label htmlFor="announcement-content">Content</label>
        <textarea id="announcement-content" rows={10} value={form.content} maxLength={5000} disabled={saving} onChange={(event) => onFormChange("content", event.target.value)} />
        <span className="character-count">{form.content.length}/5000</span>
      </div>

      <section className="ai-draft-helper">
        <div className="ai-helper-heading">
          <div><strong>AI draft helper</strong><span>Generates editable text only. Nothing is saved automatically.</span></div>
          <button type="button" className="secondary-button compact-button" onClick={() => onAiChange("expanded", !ai.expanded)} disabled={saving}>{ai.expanded ? "Hide AI helper" : "Generate with AI"}</button>
        </div>
        {ai.expanded && (
          <div className="ai-helper-fields">
            <div className="editor-field">
              <label htmlFor="ai-purpose">Purpose *</label>
              <textarea id="ai-purpose" rows={3} value={ai.purpose} maxLength={500} disabled={ai.loading} placeholder="Ví dụ: Thông báo thay đổi phòng tổ chức phiên buổi chiều" onChange={(event) => onAiChange("purpose", event.target.value)} />
            </div>
            <div className="editor-field">
              <label htmlFor="ai-key-points">Key points <span>(one per line, maximum 10)</span></label>
              <textarea id="ai-key-points" rows={4} value={ai.keyPoints} disabled={ai.loading} placeholder={"Room changed to A301\nStart time remains 13:30"} onChange={(event) => onAiChange("keyPoints", event.target.value)} />
            </div>
            <div className="ai-controls">
              <div className="editor-field tone-field">
                <label htmlFor="ai-tone">Tone</label>
                <select id="ai-tone" value={ai.tone} disabled={ai.loading} onChange={(event) => onAiChange("tone", event.target.value)}>
                  {TONES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <button type="button" className="secondary-button" onClick={onGenerate} disabled={ai.loading || saving}>{ai.loading ? "Generating..." : ai.source ? "Regenerate Draft" : "Generate Draft"}</button>
            </div>
            {ai.error && <div className="inline-message error-message" role="alert">{ai.error}</div>}
            {ai.source && <div className="inline-message ai-generated-message"><span className={`ai-source-badge source-${ai.source}`}>{sourceLabel}</span><span>AI draft generated. Review and edit before saving.</span></div>}
          </div>
        )}
      </section>

      {formError && <div className="inline-message error-message" role="alert">{formError}</div>}
      <div className="editor-actions">
        {isEditing && <button type="button" className="danger-button" onClick={onDelete} disabled={saving}>Delete</button>}
        <div>
          <button type="button" className="secondary-button" onClick={() => onSave(isEditing ? null : "DRAFT")} disabled={saving}>{saving ? "Saving..." : isEditing ? "Save Changes" : "Save Draft"}</button>
          {isPublished ? (
            <button type="button" className="warning-button" onClick={() => onSave("DRAFT")} disabled={saving}>Unpublish</button>
          ) : (
            <button type="button" className="primary-button" onClick={() => onSave("PUBLISHED")} disabled={saving}>Publish</button>
          )}
        </div>
      </div>
    </section>
  );
}

export default AnnouncementForm;
