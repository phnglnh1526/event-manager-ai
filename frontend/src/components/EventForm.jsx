import React from "react";

const EVENT_STATUSES = [
  ["DRAFT", "Draft"],
  ["PUBLISHED", "Published"],
  ["CANCELLED", "Cancelled"],
  ["COMPLETED", "Completed"],
];

function EventForm({ eventId, form, onChange, onClose, onSubmit, onDelete, loading, error }) {
  const isEditing = eventId != null;
  return (
    <section className="event-editor" aria-labelledby="event-form-title">
      <div className="editor-heading">
        <div><p className="eyebrow">{isEditing ? "EDIT EVENT" : "NEW EVENT"}</p><h2 id="event-form-title">{isEditing ? "Update event" : "Create event"}</h2></div>
        <button type="button" className="text-button" onClick={onClose} disabled={loading}>Close</button>
      </div>
      <div className="editor-field"><label htmlFor="event-title">Title *</label><input id="event-title" value={form.title} maxLength={200} disabled={loading} onChange={(e) => onChange("title", e.target.value)} /><span className="character-count">{form.title.length}/200</span></div>
      <div className="editor-field"><label htmlFor="event-description">Description</label><textarea id="event-description" rows={4} value={form.description} disabled={loading} onChange={(e) => onChange("description", e.target.value)} /></div>
      <div className="editor-field"><label htmlFor="event-location">Location *</label><input id="event-location" value={form.location} maxLength={255} disabled={loading} onChange={(e) => onChange("location", e.target.value)} /></div>
      <div className="event-time-grid">
        <div className="editor-field"><label htmlFor="event-start">Start time *</label><input id="event-start" type="datetime-local" value={form.start_time} disabled={loading} onChange={(e) => onChange("start_time", e.target.value)} /></div>
        <div className="editor-field"><label htmlFor="event-end">End time *</label><input id="event-end" type="datetime-local" value={form.end_time} disabled={loading} onChange={(e) => onChange("end_time", e.target.value)} /></div>
      </div>
      <div className="event-options-grid">
        <div className="editor-field"><label htmlFor="event-status">Status</label><select id="event-status" value={form.status} disabled={loading} onChange={(e) => onChange("status", e.target.value)}>{EVENT_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="editor-field"><label htmlFor="event-capacity">Maximum attendees *</label><input id="event-capacity" type="number" min="1" max="100000" step="1" value={form.max_attendees} disabled={loading} onChange={(e) => onChange("max_attendees", e.target.value)} /></div>
      </div>
      {error && <div className="inline-message error-message" role="alert">{error}</div>}
      <div className="editor-actions event-editor-actions">
        {isEditing && <button type="button" className="danger-button" onClick={onDelete} disabled={loading}>{loading ? "Working..." : "Delete Event"}</button>}
        <button type="button" className="primary-button" onClick={onSubmit} disabled={loading}>{loading ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Event")}</button>
      </div>
    </section>
  );
}

export default EventForm;
