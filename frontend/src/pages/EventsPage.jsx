import React, { useCallback, useEffect, useRef, useState } from "react";

import EventForm from "../components/EventForm";
import EventAIChat from "../components/EventAIChat";
import ManagementNav from "../components/ManagementNav";
import SpeakerManagement from "../components/SpeakerManagement";
import ScheduleManagement from "../components/ScheduleManagement";
import RegistrationManagement from "../components/RegistrationManagement";
import { createEvent, deleteEvent, getEvent, getEvents, updateEvent } from "../services/api";

const EMPTY_FORM = { title: "", description: "", location: "", start_time: "", end_time: "", status: "DRAFT", max_attendees: "100" };
const FILTERS = ["ALL", "DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"];
const DELETE_WARNING = "Deleting this event will permanently remove its related data, including schedules, speakers, registrations, tickets, check-ins, feedback, and announcements. This cannot be undone.";
const toDateTimeLocalValue = (value) => typeof value === "string" ? value.slice(0, 16) : "";
const displayDateTime = (value) => typeof value === "string" ? value.slice(0, 16).replace("T", " ") : "—";

function EventsPage({ token, currentUser, onLogout, onUnauthorized, activeView, onViewChange }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reload, setReload] = useState(0);
  const [filter, setFilter] = useState("ALL");
  const [editorId, setEditorId] = useState(undefined);
  const [detail, setDetail] = useState(null);
  const [workspaceTab, setWorkspaceTab] = useState("overview");
  const [speakerDirty, setSpeakerDirty] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [dirty, setDirty] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const requestInFlight = useRef(false);

  const handleRequestError = useCallback((requestError, fallback) => {
    if (requestError.status === 401) { onUnauthorized(); return; }
    if (requestError.status === 403) { setError("You do not have permission to manage events."); return; }
    setError(requestError.status === 0 ? "Unable to connect to the server." : fallback);
  }, [onUnauthorized]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    getEvents(token, controller.signal)
      .then(setEvents)
      .catch((requestError) => { if (requestError.name !== "AbortError") handleRequestError(requestError, "Unable to load events."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, reload, handleRequestError]);

  const confirmDiscard = () => (!dirty && !speakerDirty) || window.confirm("Discard unsaved changes?");
  const resetEditor = () => { setEditorId(undefined); setForm(EMPTY_FORM); setDirty(false); setFormError(""); };
  const closeEditor = () => { if (confirmDiscard()) resetEditor(); };
  const handleViewChange = (view) => { if (!confirmDiscard()) return; resetEditor(); onViewChange(view); };
  const changeForm = (field, value) => { setForm((current) => ({ ...current, [field]: value })); setDirty(true); setFormError(""); };

  const openNew = () => {
    if (!confirmDiscard()) return;
    resetEditor(); setDetail(null); setWorkspaceTab("overview"); setSpeakerDirty(false); setEditorId(null);
  };

  const loadEvent = async (eventId, editMode, targetTab = "overview") => {
    if (!confirmDiscard()) return;
    if (editorId !== undefined) resetEditor();
    setDetail(null); setWorkspaceTab(targetTab); setSpeakerDirty(false);
    setError(""); setFormError("");
    try {
      const event = await getEvent(eventId, token);
      if (editMode) {
        setDetail(null); setWorkspaceTab("overview"); setSpeakerDirty(false); setEditorId(event.id); setDirty(false);
        setForm({ title: event.title, description: event.description || "", location: event.location, start_time: toDateTimeLocalValue(event.start_time), end_time: toDateTimeLocalValue(event.end_time), status: event.status, max_attendees: String(event.max_attendees) });
      } else { setDetail(event); setWorkspaceTab(targetTab); setSpeakerDirty(false); }
    } catch (requestError) {
      if (requestError.status === 401) { onUnauthorized(); return; }
      setError(requestError.status === 404 ? "Event not found." : requestError.status === 0 ? "Unable to connect to the server." : "Unable to load event.");
      if (requestError.status === 404) setReload((value) => value + 1);
    }
  };

  const validate = () => {
    const title = form.title.trim(); const location = form.location.trim();
    const capacity = Number(form.max_attendees);
    if (title.length < 3 || title.length > 200) return "Title must contain 3 to 200 characters.";
    if (location.length < 2 || location.length > 255) return "Location must contain 2 to 255 characters.";
    if (!form.start_time || !form.end_time) return "Start time and end time are required.";
    if (form.end_time <= form.start_time) return "End time must be after start time.";
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000) return "Maximum attendees must be an integer from 1 to 100000.";
    return "";
  };

  const submit = async () => {
    if (requestInFlight.current) return;
    const validation = validate();
    if (validation) { setFormError(validation); return; }
    requestInFlight.current = true; setSubmitting(true); setFormError(""); setSuccess("");
    const payload = { title: form.title.trim(), description: form.description.trim() || null, location: form.location.trim(), start_time: form.start_time, end_time: form.end_time, status: form.status, max_attendees: Number(form.max_attendees) };
    try {
      const result = editorId == null ? await createEvent(payload, token) : await updateEvent(editorId, payload, token);
      setSuccess(editorId == null ? "Event created successfully." : "Event updated successfully.");
      resetEditor(); setDetail(result); setWorkspaceTab("overview"); setSpeakerDirty(false); setFilter("ALL"); setReload((value) => value + 1);
    } catch (requestError) {
      if (requestError.status === 401) { onUnauthorized(); return; }
      if (requestError.status === 403) setFormError("You do not have permission to manage events.");
      else if (requestError.status === 404) { setFormError("Event not found."); setReload((value) => value + 1); }
      else if (requestError.status === 422) setFormError("Please review the event fields and try again.");
      else setFormError(requestError.status === 0 ? "Unable to connect to the server." : editorId == null ? "Unable to create event." : "Unable to update event.");
    } finally { requestInFlight.current = false; setSubmitting(false); }
  };

  const remove = async () => {
    if (editorId == null || requestInFlight.current || !window.confirm(DELETE_WARNING)) return;
    requestInFlight.current = true; setSubmitting(true); setFormError(""); setSuccess("");
    try {
      await deleteEvent(editorId, token);
      setSuccess("Event deleted successfully."); resetEditor(); setDetail(null); setWorkspaceTab("overview"); setSpeakerDirty(false); setFilter("ALL"); setReload((value) => value + 1);
    } catch (requestError) {
      if (requestError.status === 401) { onUnauthorized(); return; }
      if (requestError.status === 403) setFormError("You do not have permission to manage events.");
      else if (requestError.status === 404) { setFormError("Event not found."); setReload((value) => value + 1); }
      else setFormError(requestError.status === 0 ? "Unable to connect to the server." : "Unable to delete event.");
    } finally { requestInFlight.current = false; setSubmitting(false); }
  };

  const visibleEvents = filter === "ALL" ? events : events.filter((event) => event.status === filter);
  return (
    <div className="dashboard-shell">
      <header className="dashboard-header"><div className="header-brand"><div className="brand-mark compact" aria-hidden="true"><span /><span /><span /></div><div><strong>EVENT MANAGER AI</strong><span>Management workspace</span></div></div><ManagementNav activeView={activeView} onChange={handleViewChange} /><div className="user-actions"><div className="user-copy"><strong>{currentUser.full_name}</strong><span className="role-badge">{currentUser.role}</span></div><button type="button" className="secondary-button" onClick={onLogout}>Logout</button></div></header>
      <main className="dashboard-main events-page"><section className="dashboard-title-row"><div><p className="eyebrow">EVENT OPERATIONS</p><h1>Events</h1><p>Create and maintain the core details and lifecycle status of your events.</p></div><button type="button" className="primary-button" onClick={openNew} disabled={submitting}>+ New Event</button></section>
        {success && <div className="inline-message success-message page-message" role="status">{success}</div>}
        <div className="event-filters" aria-label="Filter events by status">{FILTERS.map((status) => <button type="button" key={status} className={filter === status ? "active" : ""} onClick={() => setFilter(status)}>{status === "ALL" ? "All" : status[0] + status.slice(1).toLowerCase()}</button>)}</div>
        {loading && <div className="state-panel"><div className="app-loader" /><p>Loading events...</p></div>}
        {error && <div className="state-panel error-panel"><strong>Unable to load events</strong><p>{error}</p><button type="button" className="secondary-button" onClick={() => setReload((value) => value + 1)}>Retry</button></div>}
        {!loading && !error && events.length === 0 && editorId === undefined && <div className="state-panel"><strong>No events yet.</strong><p>Create your first event to begin managing event operations.</p><button type="button" className="primary-button" onClick={openNew}>Create your first event</button></div>}
        {!loading && !error && events.length === 0 && editorId !== undefined && <div className="event-workspace panel-open empty-event-workspace"><EventForm eventId={editorId} form={form} onChange={changeForm} onClose={closeEditor} onSubmit={submit} onDelete={remove} loading={submitting} error={formError} /></div>}
        {!loading && !error && events.length > 0 && <div className={`event-workspace ${editorId !== undefined || detail ? "panel-open" : ""}`}><section className="event-list"><div className="event-list-summary"><strong>{visibleEvents.length} event{visibleEvents.length === 1 ? "" : "s"}</strong><span>{filter === "ALL" ? "All statuses" : filter}</span></div>{visibleEvents.length === 0 ? <div className="compact-state"><strong>No events match this status.</strong></div> : visibleEvents.map((event) => <article className={`event-card ${detail?.id === event.id ? "selected" : ""}`} key={event.id}>{detail?.id === event.id && <span className="selected-event-label">Selected</span>}<div className="event-card-heading"><div><span className={`status-badge status-${event.status.toLowerCase()}`}>{event.status}</span><h2>{event.title}</h2></div><div><button type="button" className="text-button" onClick={() => loadEvent(event.id, false)}>View</button><button type="button" className="text-button" onClick={() => loadEvent(event.id, false, "speakers")}>Speakers</button><button type="button" className="text-button" onClick={() => loadEvent(event.id, false, "schedule")}>Schedule</button><button type="button" className="secondary-button compact-button" onClick={() => loadEvent(event.id, true)}>Edit</button></div></div><p className="event-description-preview">{event.description || "No description provided."}</p><div className="event-card-meta"><div><span>Location</span><strong>{event.location}</strong></div><div><span>Schedule</span><strong>{displayDateTime(event.start_time)} – {displayDateTime(event.end_time)}</strong></div><div><span>Capacity</span><strong>{event.max_attendees} attendees</strong></div></div></article>)}</section>
          {editorId !== undefined && <EventForm eventId={editorId} form={form} onChange={changeForm} onClose={closeEditor} onSubmit={submit} onDelete={remove} loading={submitting} error={formError} />}
          {editorId === undefined && detail && <aside className="event-detail-panel speaker-workspace-panel"><div className="editor-heading"><div><p className="eyebrow">EVENT WORKSPACE</p><span className={`status-badge status-${detail.status.toLowerCase()}`}>{detail.status}</span><h2>{detail.title}</h2><div className="event-context-meta"><span>{displayDateTime(detail.start_time)} – {displayDateTime(detail.end_time)}</span><span>{detail.location}</span></div></div><button type="button" className="text-button" onClick={() => { if (confirmDiscard()) { setDetail(null); setSpeakerDirty(false); } }}>Close</button></div><div className="workspace-tabs" role="tablist" aria-label="Event workspace"><button type="button" role="tab" aria-selected={workspaceTab === "overview"} className={workspaceTab === "overview" ? "active" : ""} onClick={() => { if (confirmDiscard()) { setWorkspaceTab("overview"); setSpeakerDirty(false); } }}>Overview</button><button type="button" role="tab" aria-selected={workspaceTab === "speakers"} className={workspaceTab === "speakers" ? "active" : ""} onClick={() => { if (confirmDiscard()) { setWorkspaceTab("speakers"); setSpeakerDirty(false); } }}>Speakers</button><button type="button" role="tab" aria-selected={workspaceTab === "schedule"} className={workspaceTab === "schedule" ? "active" : ""} onClick={() => { if (confirmDiscard()) { setWorkspaceTab("schedule"); setSpeakerDirty(false); } }}>Schedule</button><button type="button" role="tab" aria-selected={workspaceTab === "registrations"} className={workspaceTab === "registrations" ? "active" : ""} onClick={() => { if (confirmDiscard()) { setWorkspaceTab("registrations"); setSpeakerDirty(false); } }}>Registrations</button><button type="button" role="tab" aria-selected={workspaceTab === "ai"} className={workspaceTab === "ai" ? "active" : ""} onClick={() => { if (confirmDiscard()) { setWorkspaceTab("ai"); setSpeakerDirty(false); } }}>Ask AI</button></div>{workspaceTab === "overview" ? <div className="event-overview"><p className="event-detail-description">{detail.description || "No description provided."}</p><dl><div><dt>Location</dt><dd>{detail.location}</dd></div><div><dt>Start</dt><dd>{displayDateTime(detail.start_time)}</dd></div><div><dt>End</dt><dd>{displayDateTime(detail.end_time)}</dd></div><div><dt>Maximum attendees</dt><dd>{detail.max_attendees}</dd></div><div><dt>Created</dt><dd>{displayDateTime(detail.created_at)}</dd></div><div><dt>Updated</dt><dd>{displayDateTime(detail.updated_at)}</dd></div></dl><button type="button" className="primary-button" onClick={() => loadEvent(detail.id, true)}>Edit Event</button></div> : workspaceTab === "speakers" ? <SpeakerManagement key={`speakers-${detail.id}`} event={detail} token={token} onUnauthorized={onUnauthorized} onDirtyChange={setSpeakerDirty} /> : workspaceTab === "schedule" ? <ScheduleManagement key={`schedule-${detail.id}`} event={detail} token={token} onUnauthorized={onUnauthorized} onDirtyChange={setSpeakerDirty} /> : workspaceTab === "registrations" ? <RegistrationManagement key={`registrations-${detail.id}`} event={detail} token={token} onUnauthorized={onUnauthorized} /> : <EventAIChat key={`ai-${detail.id}`} event={detail} token={token} onUnauthorized={onUnauthorized} />}</aside>}
        </div>}
      </main><footer>Event Manager AI · Event ownership and validation are enforced by the backend.</footer>
    </div>
  );
}

export default EventsPage;
