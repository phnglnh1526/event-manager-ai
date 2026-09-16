import React from "react";

const localValue = (value) => typeof value === "string" ? value.slice(0, 16) : "";
const clock = (value) => localValue(value).slice(11, 16);
const dateLabel = (value) => { const literal = localValue(value); return `${literal.slice(8, 10)}/${literal.slice(5, 7)}/${literal.slice(0, 4)}`; };

function ScheduleForm({ event, form, speakers, speakersLoading, editing, loading, error, onChange, onSubmit, onCancel }) {
  return <section className="schedule-form" aria-labelledby="schedule-form-title">
    <div className="editor-heading"><div><p className="eyebrow">{editing ? "EDIT SESSION" : "NEW SESSION"}</p><h3 id="schedule-form-title">{editing ? "Update session" : "Add session"}</h3></div><button type="button" className="text-button" onClick={onCancel} disabled={loading}>Close</button></div>
    <p className="schedule-range-note">Session must be scheduled between <strong>{clock(event.start_time)}</strong> and <strong>{clock(event.end_time)}</strong> on <strong>{dateLabel(event.start_time)}</strong>.</p>
    <div className="editor-field"><label htmlFor="session-title">Title *</label><input id="session-title" value={form.title} minLength={3} maxLength={200} required disabled={loading} onChange={(e) => onChange("title", e.target.value)} /></div>
    <div className="schedule-time-grid"><div className="editor-field"><label htmlFor="session-start">Start time *</label><input id="session-start" type="datetime-local" value={form.start_time} disabled={loading} onChange={(e) => onChange("start_time", e.target.value)} /></div><div className="editor-field"><label htmlFor="session-end">End time *</label><input id="session-end" type="datetime-local" value={form.end_time} disabled={loading} onChange={(e) => onChange("end_time", e.target.value)} /></div></div>
    <div className="schedule-fields-grid"><div className="editor-field"><label htmlFor="session-location">Location</label><input id="session-location" value={form.location} maxLength={255} disabled={loading} onChange={(e) => onChange("location", e.target.value)} /></div><div className="editor-field"><label htmlFor="session-speaker">Speaker</label><select id="session-speaker" value={form.speaker_id} disabled={loading || speakersLoading} onChange={(e) => onChange("speaker_id", e.target.value)}><option value="">No speaker</option>{speakers.map((speaker) => <option key={speaker.id} value={speaker.id}>{speaker.full_name}</option>)}</select>{speakersLoading && <small>Loading speakers...</small>}{!speakersLoading && speakers.length === 0 && <small>No speakers have been added to this event yet.</small>}</div></div>
    <div className="editor-field"><label htmlFor="session-description">Description</label><textarea id="session-description" rows={4} value={form.description} maxLength={5000} disabled={loading} onChange={(e) => onChange("description", e.target.value)} /></div>
    {error && <div className="inline-message error-message" role="alert">{error}</div>}
    <div className="editor-actions"><button type="button" className="secondary-button" onClick={onCancel} disabled={loading}>Cancel</button><button type="button" className="primary-button" onClick={onSubmit} disabled={loading || speakersLoading}>{loading ? "Saving..." : editing ? "Save Changes" : "Add Session"}</button></div>
  </section>;
}
export default ScheduleForm;
