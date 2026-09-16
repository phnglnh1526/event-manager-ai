import React, { useCallback, useEffect, useRef, useState } from "react";
import { createSchedule, deleteSchedule, getSchedule, getSchedules, getSpeakers, updateSchedule } from "../services/api";
import ScheduleForm from "./ScheduleForm";

const EMPTY = { title: "", description: "", start_time: "", end_time: "", location: "", speaker_id: "" };
const localValue = (value) => typeof value === "string" ? value.slice(0, 16) : "";
const display = (value) => localValue(value).replace("T", " ") || "—";
const clock = (value) => localValue(value).slice(11, 16) || "—";
const dateLabel = (value) => { const literal = localValue(value); return literal ? `${literal.slice(8, 10)}/${literal.slice(5, 7)}/${literal.slice(0, 4)}` : "—"; };

function ScheduleManagement({ event, token, onUnauthorized, onDirtyChange }) {
  const [schedules, setSchedules] = useState([]), [speakers, setSpeakers] = useState([]);
  const [loading, setLoading] = useState(true), [speakersLoading, setSpeakersLoading] = useState(true);
  const [error, setError] = useState(""), [speakerError, setSpeakerError] = useState(""), [success, setSuccess] = useState("");
  const [reload, setReload] = useState(0), [form, setForm] = useState(EMPTY), [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null), [formError, setFormError] = useState(""), [dirty, setDirty] = useState(false), [submitting, setSubmitting] = useState(false);
  const busy = useRef(false), detailRequest = useRef(0);
  const fail = useCallback((e, target) => { if (e.status === 401) onUnauthorized(); else target(e.status === 403 ? "You do not have permission to manage this schedule." : e.status === 404 ? "Event not found." : e.status === 0 ? "Unable to connect to the server." : "Unable to load schedule."); }, [onUnauthorized]);

  useEffect(() => {
    const controller = new AbortController(); setSchedules([]); setSpeakers([]); setLoading(true); setSpeakersLoading(true); setFormOpen(false); setEditingId(null); setForm(EMPTY); setDirty(false); onDirtyChange(false); setFormError("");
    getSchedules(event.id, token, controller.signal).then(setSchedules).catch((e) => { if (e.name !== "AbortError") fail(e, setError); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    getSpeakers(event.id, token, controller.signal).then(setSpeakers).catch((e) => { if (e.name !== "AbortError") fail(e, setSpeakerError); }).finally(() => { if (!controller.signal.aborted) setSpeakersLoading(false); });
    return () => controller.abort();
  }, [event.id, token, reload, fail, onDirtyChange]);

  const dirtySet = (v) => { setDirty(v); onDirtyChange(v); };
  const confirmDiscard = () => !dirty || window.confirm("Discard unsaved changes?");
  const reset = () => { setForm(EMPTY); setFormOpen(false); setEditingId(null); setFormError(""); dirtySet(false); };
  const cancel = () => { if (confirmDiscard()) reset(); };
  const change = (field, value) => { setForm((current) => ({ ...current, [field]: value })); dirtySet(true); setFormError(""); };
  const openNew = () => { if (!confirmDiscard()) return; reset(); setSuccess(""); setFormOpen(true); };
  const edit = async (id) => { if (formOpen && !confirmDiscard()) return; const request = ++detailRequest.current; setError(""); try { const item = await getSchedule(event.id, id, token); if (request !== detailRequest.current) return; setEditingId(item.id); setFormOpen(true); dirtySet(false); setForm({ title: item.title, description: item.description || "", start_time: localValue(item.start_time), end_time: localValue(item.end_time), location: item.location || "", speaker_id: item.speaker_id == null ? "" : String(item.speaker_id) }); } catch (e) { if (e.status === 401) onUnauthorized(); else { setError(e.status === 404 ? "Session not found." : e.status === 0 ? "Unable to connect to the server." : "Unable to load session."); if (e.status === 404) { reset(); setReload((v) => v + 1); } } } };
  const validate = () => { const title = form.title.trim(); if (title.length < 3 || title.length > 200) return "Title must contain 3 to 200 characters."; if (!form.start_time || !form.end_time) return "Start time and end time are required."; if (form.end_time <= form.start_time) return "End time must be after start time."; if (form.start_time < localValue(event.start_time)) return "Session must start within the event time."; if (form.end_time > localValue(event.end_time)) return "Session must end within the event time."; return ""; };
  const submit = async () => { if (busy.current) return; const message = validate(); if (message) { setFormError(message); return; } const optional = (v) => v.trim() || null; const payload = { title: form.title.trim(), description: optional(form.description), start_time: form.start_time, end_time: form.end_time, location: optional(form.location), speaker_id: form.speaker_id === "" ? null : Number(form.speaker_id) }; busy.current = true; setSubmitting(true); setFormError(""); try { if (editingId == null) await createSchedule(event.id, payload, token); else await updateSchedule(event.id, editingId, payload, token); setSuccess(editingId == null ? "Session added successfully." : "Session updated successfully."); reset(); setReload((v) => v + 1); } catch (e) { if (e.status === 401) onUnauthorized(); else if (e.status === 403) setFormError("You do not have permission to manage this schedule."); else if (e.status === 404) setFormError(editingId == null ? "Event not found." : "Session not found."); else if (e.status === 422) setFormError(String(e.message).includes("Speaker does not belong") ? "Selected speaker does not belong to this event." : "Please review the session time and fields."); else setFormError(e.status === 0 ? "Unable to connect to the server." : editingId == null ? "Unable to add session." : "Unable to update session."); } finally { busy.current = false; setSubmitting(false); } };
  const remove = async (item) => { if (busy.current || !window.confirm("Delete this session from the event? This cannot be undone.")) return; busy.current = true; setSubmitting(true); try { await deleteSchedule(event.id, item.id, token); setSuccess("Session deleted successfully."); if (editingId === item.id) reset(); setReload((v) => v + 1); } catch (e) { if (e.status === 401) onUnauthorized(); else { setError(e.status === 404 ? "Session not found." : e.status === 403 ? "You do not have permission to manage this schedule." : e.status === 0 ? "Unable to connect to the server." : "Unable to delete session."); if (e.status === 404) setReload((v) => v + 1); } } finally { busy.current = false; setSubmitting(false); } };
  const speakerName = (id) => { if (id == null) return "No speaker assigned"; if (speakersLoading) return "Loading speaker..."; return speakers.find((s) => s.id === id)?.full_name || "No speaker assigned"; };

  return <section className="schedule-management"><div className="schedule-event-context"><p className="eyebrow">EVENT SCHEDULE</p><h3>{event.title}</h3><strong>{dateLabel(event.start_time)}</strong><span>{clock(event.start_time)} → {clock(event.end_time)}</span><span>{event.location}</span></div><div className="schedule-heading"><div><h3>Schedule</h3><span>{schedules.length} session{schedules.length === 1 ? "" : "s"}</span></div><button type="button" className="primary-button" onClick={openNew} disabled={submitting}>+ Add Session</button></div>
    {success && <div className="inline-message success-message">{success}</div>}{error && <div className="inline-message error-message">{error}</div>}{speakerError && <div className="inline-message error-message">Unable to load speakers. Sessions remain available.</div>}
    {loading && <div className="compact-state"><div className="app-loader" /><p>Loading schedule...</p></div>}
    {!loading && schedules.length === 0 && !formOpen && <div className="compact-state"><strong>No sessions scheduled yet.</strong><p>Add the first session for this event.</p><button type="button" className="primary-button" onClick={openNew}>Add Session</button></div>}
    {!loading && schedules.length > 0 && <div className="schedule-timeline">{schedules.map((item) => <article key={item.id} className="schedule-row"><time>{clock(item.start_time)}</time><div className="schedule-card"><div><h4>{item.title}</h4><strong>{display(item.start_time)} – {display(item.end_time)}</strong></div>{item.location && <span>{item.location}</span>}<span>Speaker: {speakerName(item.speaker_id)}</span>{item.description && <p>{item.description}</p>}<div className="speaker-card-actions"><button type="button" className="secondary-button compact-button" onClick={() => edit(item.id)}>Edit</button><button type="button" className="danger-text-button" onClick={() => remove(item)} disabled={submitting}>Delete</button></div></div></article>)}</div>}
    {formOpen && <ScheduleForm event={event} form={form} speakers={speakers} speakersLoading={speakersLoading} editing={editingId != null} loading={submitting} error={formError} onChange={change} onSubmit={submit} onCancel={cancel} />}
  </section>;
}
export default ScheduleManagement;
