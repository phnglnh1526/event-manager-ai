import React, { useCallback, useEffect, useRef, useState } from "react";

import AnnouncementForm from "../components/AnnouncementForm";
import EventSelector from "../components/EventSelector";
import ManagementNav from "../components/ManagementNav";
import {
  createAnnouncement,
  deleteAnnouncement,
  generateAnnouncementDraft,
  getAnnouncements,
  getEvents,
  updateAnnouncement,
} from "../services/api";

const EMPTY_FORM = { title: "", content: "" };
const EMPTY_AI = { expanded: false, purpose: "", keyPoints: "", tone: "PROFESSIONAL", loading: false, error: "", source: "" };
const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const formatDate = (value) => value ? dateFormatter.format(new Date(value)) : "—";

const aiErrorMessage = (error) => {
  if (error.status === 403) return "You do not have permission to generate an AI draft.";
  if (error.status === 502) return "AI draft could not be generated. Please try again.";
  if (error.status === 503) return "AI service is currently unavailable.";
  if (error.status === 0) return "Unable to connect to the AI service.";
  return "Unable to generate an AI draft.";
};

function AnnouncementsPage({ token, currentUser, onLogout, onUnauthorized, activeView, onViewChange }) {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [announcements, setAnnouncements] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [listError, setListError] = useState("");
  const [reload, setReload] = useState(0);
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formDirty, setFormDirty] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [ai, setAi] = useState(EMPTY_AI);
  const aiSequence = useRef(0);
  const aiInFlight = useRef(false);

  const handleError = useCallback((error, setter, fallback) => {
    if (error.status === 401) { onUnauthorized(); return; }
    setter(error.status === 403 ? "You do not have permission to manage this resource." : fallback);
  }, [onUnauthorized]);

  useEffect(() => {
    const controller = new AbortController();
    setEventsLoading(true); setEventsError("");
    getEvents(token, controller.signal)
      .then((data) => {
        setEvents(data);
        setSelectedEventId((current) => data.some((item) => item.id === current) ? current : (data[0]?.id || ""));
      })
      .catch((error) => { if (error.name !== "AbortError") handleError(error, setEventsError, "Unable to load events."); })
      .finally(() => { if (!controller.signal.aborted) setEventsLoading(false); });
    return () => controller.abort();
  }, [token, handleError]);

  useEffect(() => {
    setAnnouncements([]); setListError("");
    if (!selectedEventId) { setListLoading(false); return undefined; }
    const controller = new AbortController();
    setListLoading(true);
    getAnnouncements(selectedEventId, token, controller.signal)
      .then(setAnnouncements)
      .catch((error) => { if (error.name !== "AbortError") handleError(error, setListError, "Unable to load announcements."); })
      .finally(() => { if (!controller.signal.aborted) setListLoading(false); });
    return () => controller.abort();
  }, [selectedEventId, token, reload, handleError]);

  const resetEditor = () => {
    aiSequence.current += 1; aiInFlight.current = false;
    setEditor(null); setForm(EMPTY_FORM); setFormDirty(false); setFormError(""); setAi(EMPTY_AI);
  };

  const confirmDiscard = () => !formDirty || window.confirm("Discard unsaved changes?");

  const handleEventChange = (eventId) => {
    if (!confirmDiscard()) return;
    resetEditor(); setSuccess(""); setSelectedEventId(eventId);
  };

  const openNew = () => {
    if (!selectedEventId || !confirmDiscard()) return;
    resetEditor(); setEditor({ id: null, status: "DRAFT" });
  };

  const openEdit = (announcement) => {
    if (!confirmDiscard()) return;
    resetEditor();
    setEditor({ id: announcement.id, status: announcement.status });
    setForm({ title: announcement.title, content: announcement.content });
  };

  const closeEditor = () => { if (confirmDiscard()) resetEditor(); };
  const handleViewChange = (view) => {
    if (!confirmDiscard()) return;
    resetEditor();
    onViewChange(view);
  };
  const changeForm = (field, value) => { setForm((current) => ({ ...current, [field]: value })); setFormDirty(true); setFormError(""); };
  const changeAi = (field, value) => setAi((current) => ({ ...current, [field]: value, error: field === "error" ? value : "" }));

  const validateForm = () => {
    const title = form.title.trim(); const content = form.content.trim();
    if (title.length < 3 || title.length > 200) return "Title must contain 3 to 200 characters.";
    if (!content || content.length > 5000) return "Content is required and must not exceed 5000 characters.";
    return "";
  };

  const save = async (targetStatus) => {
    if (!editor || saving) return;
    const validation = validateForm();
    if (validation) { setFormError(validation); return; }
    const payload = { title: form.title.trim(), content: form.content.trim() };
    if (targetStatus) payload.status = targetStatus;
    setSaving(true); setFormError(""); setSuccess("");
    try {
      const result = editor.id == null
        ? await createAnnouncement(selectedEventId, { ...payload, status: targetStatus || "DRAFT" }, token)
        : await updateAnnouncement(selectedEventId, editor.id, payload, token);
      setSuccess(result.status === "PUBLISHED" ? "Announcement published." : editor.id == null ? "Announcement saved as draft." : targetStatus === "DRAFT" ? "Announcement unpublished." : "Announcement updated.");
      resetEditor(); setReload((value) => value + 1);
    } catch (error) {
      if (error.status === 401) { onUnauthorized(); return; }
      setFormError(editor.id == null ? "Unable to save announcement." : "Unable to update announcement.");
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!editor?.id || saving || !window.confirm("Delete this announcement?")) return;
    setSaving(true); setFormError("");
    try {
      await deleteAnnouncement(selectedEventId, editor.id, token);
      setSuccess("Announcement deleted."); resetEditor(); setReload((value) => value + 1);
    } catch (error) {
      if (error.status === 401) { onUnauthorized(); return; }
      setFormError("Unable to delete announcement.");
    } finally { setSaving(false); }
  };

  const generateDraft = async () => {
    if (!selectedEventId || aiInFlight.current) return;
    const purpose = ai.purpose.trim();
    const keyPoints = ai.keyPoints.split("\n").map((item) => item.trim()).filter(Boolean);
    if (purpose.length < 5 || purpose.length > 500) { setAi((current) => ({ ...current, error: "Purpose must contain 5 to 500 characters." })); return; }
    if (keyPoints.length > 10 || keyPoints.some((item) => item.length > 300)) { setAi((current) => ({ ...current, error: "Use at most 10 key points, each up to 300 characters." })); return; }
    if (formDirty && (form.title.trim() || form.content.trim()) && !window.confirm("Generate a new AI draft? Current form content will be replaced.")) return;
    aiInFlight.current = true;
    const sequence = aiSequence.current + 1; aiSequence.current = sequence;
    const requestedEventId = selectedEventId;
    setAi((current) => ({ ...current, loading: true, error: "" }));
    try {
      const draft = await generateAnnouncementDraft(requestedEventId, { purpose, key_points: keyPoints, tone: ai.tone }, token);
      if (sequence !== aiSequence.current || requestedEventId !== selectedEventId) return;
      if (!draft || typeof draft.title !== "string" || typeof draft.content !== "string" || !["mock", "openai"].includes(draft.source)) {
        setAi((current) => ({ ...current, error: "AI response could not be displayed." })); return;
      }
      setForm({ title: draft.title, content: draft.content }); setFormDirty(true);
      setAi((current) => ({ ...current, source: draft.source, error: "" }));
    } catch (error) {
      if (sequence !== aiSequence.current) return;
      if (error.status === 401) { onUnauthorized(); return; }
      setAi((current) => ({ ...current, error: aiErrorMessage(error) }));
    } finally {
      if (sequence === aiSequence.current) { aiInFlight.current = false; setAi((current) => ({ ...current, loading: false })); }
    }
  };

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header"><div className="header-brand"><div className="brand-mark compact" aria-hidden="true"><span /><span /><span /></div><div><strong>EVENT MANAGER AI</strong><span>Management workspace</span></div></div><ManagementNav activeView={activeView} onChange={handleViewChange} /><div className="user-actions"><div className="user-copy"><strong>{currentUser.full_name}</strong><span className="role-badge">{currentUser.role}</span></div><button type="button" className="secondary-button" onClick={onLogout}>Logout</button></div></header>
      <main className="dashboard-main announcements-page">
        <section className="dashboard-title-row"><div><p className="eyebrow">EVENT COMMUNICATIONS</p><h1>Announcements</h1><p>Create, publish, and manage plain-text updates for event attendees.</p></div>{!eventsLoading && !eventsError && <EventSelector events={events} selectedEventId={selectedEventId} onChange={handleEventChange} disabled={eventsLoading || saving || ai.loading} />}</section>
        <div className="announcement-toolbar"><div>{success && <div className="inline-message success-message" role="status">{success}</div>}</div><button type="button" className="primary-button" onClick={openNew} disabled={!selectedEventId || eventsLoading}>+ New Announcement</button></div>
        {eventsLoading && <div className="state-panel"><div className="app-loader" /><p>Loading events...</p></div>}
        {eventsError && <div className="state-panel error-panel"><strong>Unable to load events</strong><p>{eventsError}</p></div>}
        {!eventsLoading && !eventsError && events.length === 0 && <div className="state-panel"><strong>No events available.</strong><p>Create an event before adding announcements.</p></div>}
        {selectedEventId && !eventsLoading && !eventsError && <div className={`announcement-workspace ${editor ? "editor-open" : ""}`}>
          <section className="announcement-list-panel"><div className="panel-heading"><div><p className="eyebrow">EVENT MESSAGES</p><h3>Announcement list</h3></div><strong>{announcements.length}</strong></div>
            {listLoading && <div className="compact-state"><div className="app-loader" /><span>Loading announcements...</span></div>}
            {listError && <div className="inline-message error-message" role="alert">{listError}<button type="button" className="text-button" onClick={() => setReload((value) => value + 1)}>Retry</button></div>}
            {!listLoading && !listError && announcements.length === 0 && <div className="compact-state"><strong>No announcements yet.</strong><span>Create a draft or publish an update for this event.</span></div>}
            {!listLoading && announcements.length > 0 && <div className="announcement-list">{announcements.map((item) => <article className={`announcement-list-item ${editor?.id === item.id ? "selected" : ""}`} key={item.id}><div className="announcement-item-heading"><span className={`status-badge status-${item.status.toLowerCase()}`}>{item.status}</span><button type="button" className="text-button" onClick={() => openEdit(item)}>Edit</button></div><h4>{item.title}</h4><p className="content-preview">{item.content}</p><div className="announcement-dates"><span>Updated {formatDate(item.updated_at)}</span>{item.published_at && <span>Published {formatDate(item.published_at)}</span>}</div></article>)}</div>}
          </section>
          {editor && <AnnouncementForm editor={editor} form={form} onFormChange={changeForm} onClose={closeEditor} onSave={save} onDelete={remove} saving={saving} formError={formError} ai={ai} onAiChange={changeAi} onGenerate={generateDraft} />}
        </div>}
      </main>
      <footer>Event Manager AI · Announcements are delivered through the attendee workspace.</footer>
    </div>
  );
}

export default AnnouncementsPage;
