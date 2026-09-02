import React from "react";

function SpeakerForm({ form, editing, loading, error, onChange, onSubmit, onCancel }) {
  return (
    <section className="speaker-form" aria-labelledby="speaker-form-title">
      <div className="editor-heading">
        <div>
          <p className="eyebrow">{editing ? "EDIT SPEAKER" : "NEW SPEAKER"}</p>
          <h3 id="speaker-form-title">{editing ? "Update speaker" : "Add speaker"}</h3>
        </div>
        <button type="button" className="text-button" onClick={onCancel} disabled={loading}>Close</button>
      </div>
      <div className="editor-field">
        <label htmlFor="speaker-name">Full name *</label>
        <input id="speaker-name" value={form.full_name} minLength={2} maxLength={150} required disabled={loading} onChange={(event) => onChange("full_name", event.target.value)} />
        <span className="character-count">{form.full_name.length}/150</span>
      </div>
      <div className="speaker-fields-grid">
        <div className="editor-field"><label htmlFor="speaker-title">Title</label><input id="speaker-title" value={form.title} maxLength={150} disabled={loading} onChange={(event) => onChange("title", event.target.value)} /></div>
        <div className="editor-field"><label htmlFor="speaker-organization">Organization</label><input id="speaker-organization" value={form.organization} maxLength={200} disabled={loading} onChange={(event) => onChange("organization", event.target.value)} /></div>
      </div>
      <div className="editor-field"><label htmlFor="speaker-email">Email</label><input id="speaker-email" type="email" value={form.email} maxLength={255} disabled={loading} onChange={(event) => onChange("email", event.target.value)} /></div>
      <div className="editor-field"><label htmlFor="speaker-bio">Bio</label><textarea id="speaker-bio" rows={5} value={form.bio} maxLength={5000} disabled={loading} onChange={(event) => onChange("bio", event.target.value)} /><span className="character-count">{form.bio.length}/5000</span></div>
      {error && <div className="inline-message error-message" role="alert">{error}</div>}
      <div className="editor-actions">
        <button type="button" className="secondary-button" onClick={onCancel} disabled={loading}>Cancel</button>
        <button type="button" className="primary-button" onClick={onSubmit} disabled={loading}>{loading ? "Saving..." : editing ? "Save Changes" : "Add Speaker"}</button>
      </div>
    </section>
  );
}

export default SpeakerForm;
