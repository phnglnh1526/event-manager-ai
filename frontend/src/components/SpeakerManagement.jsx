import React, { useCallback, useEffect, useRef, useState } from "react";

import { createSpeaker, deleteSpeaker, getSpeaker, getSpeakers, updateSpeaker } from "../services/api";
import SpeakerForm from "./SpeakerForm";

const EMPTY_FORM = { full_name: "", title: "", organization: "", email: "", bio: "" };
const DELETE_WARNING = "Delete this speaker from the event? Existing schedules will remain, but their speaker assignment will be cleared. This cannot be undone.";
const displayDateTime = (value) => typeof value === "string" ? value.slice(0, 16).replace("T", " ") : "—";

function SpeakerManagement({ event, token, onUnauthorized, onDirtyChange }) {
  const [speakers, setSpeakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [formError, setFormError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const requestInFlight = useRef(false);
  const detailRequest = useRef(0);

  const reportError = useCallback((requestError, fallback) => {
    if (requestError.status === 401) { onUnauthorized(); return; }
    if (requestError.status === 403) setError("You do not have permission to manage speakers.");
    else if (requestError.status === 404) setError("Event not found.");
    else if (requestError.status === 0) setError("Unable to connect to the server.");
    else setError(fallback);
  }, [onUnauthorized]);

  useEffect(() => {
    const controller = new AbortController();
    setSpeakers([]); setDetail(null); setFormOpen(false); setEditingId(null); setForm(EMPTY_FORM);
    setDirty(false); onDirtyChange(false); setFormError(""); setLoading(true);
    getSpeakers(event.id, token, controller.signal)
      .then(setSpeakers)
      .catch((requestError) => { if (requestError.name !== "AbortError") reportError(requestError, "Unable to load speakers."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [event.id, token, reload, reportError, onDirtyChange]);

  const setDirtyState = (value) => { setDirty(value); onDirtyChange(value); };
  const confirmDiscard = () => !dirty || window.confirm("Discard unsaved changes?");
  const resetForm = () => { setForm(EMPTY_FORM); setFormOpen(false); setEditingId(null); setFormError(""); setDirtyState(false); };
  const cancelForm = () => { if (confirmDiscard()) resetForm(); };
  const changeForm = (field, value) => { setForm((current) => ({ ...current, [field]: value })); setDirtyState(true); setFormError(""); };
  const openNew = () => { if (!confirmDiscard()) return; resetForm(); setDetail(null); setSuccess(""); setFormOpen(true); };

  const openDetail = async (speakerId, editMode = false) => {
    if (formOpen && !confirmDiscard()) return;
    if (formOpen) resetForm();
    const requestId = ++detailRequest.current;
    setError(""); setSuccess("");
    try {
      const speaker = await getSpeaker(event.id, speakerId, token);
      if (requestId !== detailRequest.current) return;
      if (editMode) {
        setEditingId(speaker.id); setDetail(null); setFormOpen(true); setDirtyState(false);
        setForm({ full_name: speaker.full_name || "", title: speaker.title || "", organization: speaker.organization || "", email: speaker.email || "", bio: speaker.bio || "" });
      } else setDetail(speaker);
    } catch (requestError) {
      if (requestId !== detailRequest.current) return;
      if (requestError.status === 401) { onUnauthorized(); return; }
      if (requestError.status === 404) { setError("Speaker not found."); resetForm(); setDetail(null); setReload((value) => value + 1); }
      else reportError(requestError, "Unable to load speaker.");
    }
  };

  const validate = () => {
    const name = form.full_name.trim();
    if (name.length < 2 || name.length > 150) return "Full name must contain 2 to 150 characters.";
    if (form.title.trim().length > 150) return "Title cannot exceed 150 characters.";
    if (form.organization.trim().length > 200) return "Organization cannot exceed 200 characters.";
    if (form.bio.trim().length > 5000) return "Bio cannot exceed 5000 characters.";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Enter a valid email address.";
    return "";
  };

  const submit = async () => {
    if (requestInFlight.current) return;
    const validation = validate();
    if (validation) { setFormError(validation); return; }
    const optional = (value) => value.trim() || null;
    const payload = { full_name: form.full_name.trim(), title: optional(form.title), organization: optional(form.organization), email: optional(form.email)?.toLowerCase() || null, bio: optional(form.bio) };
    requestInFlight.current = true; setSubmitting(true); setFormError(""); setSuccess("");
    try {
      if (editingId == null) await createSpeaker(event.id, payload, token);
      else await updateSpeaker(event.id, editingId, payload, token);
      setSuccess(editingId == null ? "Speaker added successfully." : "Speaker updated successfully.");
      resetForm(); setReload((value) => value + 1);
    } catch (requestError) {
      if (requestError.status === 401) { onUnauthorized(); return; }
      if (requestError.status === 403) setFormError("You do not have permission to manage speakers.");
      else if (requestError.status === 404) { setError(editingId == null ? "Event not found." : "Speaker not found."); if (editingId != null) setReload((value) => value + 1); }
      else if (requestError.status === 422) setFormError("Please review the speaker fields and try again.");
      else setFormError(requestError.status === 0 ? "Unable to connect to the server." : editingId == null ? "Unable to add speaker." : "Unable to update speaker.");
    } finally { requestInFlight.current = false; setSubmitting(false); }
  };

  const remove = async (speaker) => {
    if (requestInFlight.current || !window.confirm(DELETE_WARNING)) return;
    requestInFlight.current = true; setSubmitting(true); setError(""); setSuccess("");
    try {
      await deleteSpeaker(event.id, speaker.id, token);
      setSuccess("Speaker deleted successfully."); if (detail?.id === speaker.id) setDetail(null); resetForm(); setReload((value) => value + 1);
    } catch (requestError) {
      if (requestError.status === 401) { onUnauthorized(); return; }
      if (requestError.status === 403) setError("You do not have permission to manage speakers.");
      else if (requestError.status === 404) { setError("Speaker not found."); setDetail(null); resetForm(); setReload((value) => value + 1); }
      else setError(requestError.status === 0 ? "Unable to connect to the server." : "Unable to delete speaker.");
    } finally { requestInFlight.current = false; setSubmitting(false); }
  };

  return (
    <section className="speaker-management">
      <div className="speaker-section-heading"><div><p className="eyebrow">EVENT SPEAKERS</p><h3>Speakers</h3></div><button type="button" className="primary-button" onClick={openNew} disabled={submitting}>+ Add Speaker</button></div>
      {success && <div className="inline-message success-message" role="status">{success}</div>}
      {error && <div className="inline-message error-message" role="alert">{error}<button type="button" className="text-button" onClick={() => { setError(""); setReload((value) => value + 1); }}>Retry</button></div>}
      {loading && <div className="compact-state"><div className="app-loader" /><p>Loading speakers...</p></div>}
      {!loading && !error && speakers.length === 0 && !formOpen && <div className="compact-state"><strong>No speakers added yet.</strong><p>Add the first speaker for this event.</p><button type="button" className="primary-button" onClick={openNew}>Add Speaker</button></div>}
      {!loading && speakers.length > 0 && <div className="speaker-list">{speakers.map((speaker) => <article className="speaker-card" key={speaker.id}><button type="button" className="speaker-name-button" onClick={() => openDetail(speaker.id)}>{speaker.full_name}</button>{speaker.title && <strong>{speaker.title}</strong>}{speaker.organization && <span>{speaker.organization}</span>}{speaker.email && <span className="speaker-email">{speaker.email}</span>}{speaker.bio && <p className="speaker-bio-preview">{speaker.bio}</p>}<div className="speaker-card-actions"><button type="button" className="text-button" onClick={() => openDetail(speaker.id)}>View</button><button type="button" className="secondary-button compact-button" onClick={() => openDetail(speaker.id, true)}>Edit</button><button type="button" className="danger-text-button" onClick={() => remove(speaker)} disabled={submitting}>Delete</button></div></article>)}</div>}
      {formOpen && <SpeakerForm form={form} editing={editingId != null} loading={submitting} error={formError} onChange={changeForm} onSubmit={submit} onCancel={cancelForm} />}
      {!formOpen && detail && <section className="speaker-detail"><div className="editor-heading"><div><p className="eyebrow">SPEAKER DETAILS</p><h3>{detail.full_name}</h3></div><button type="button" className="text-button" onClick={() => setDetail(null)}>Close</button></div><dl><div><dt>Title</dt><dd>{detail.title || "—"}</dd></div><div><dt>Organization</dt><dd>{detail.organization || "—"}</dd></div><div><dt>Email</dt><dd className="speaker-email">{detail.email || "—"}</dd></div><div className="speaker-detail-bio"><dt>Bio</dt><dd>{detail.bio || "No bio provided."}</dd></div><div><dt>Created</dt><dd>{displayDateTime(detail.created_at)}</dd></div><div><dt>Updated</dt><dd>{displayDateTime(detail.updated_at)}</dd></div></dl><div className="speaker-card-actions"><button type="button" className="primary-button" onClick={() => openDetail(detail.id, true)}>Edit Speaker</button><button type="button" className="danger-button" onClick={() => remove(detail)} disabled={submitting}>Delete Speaker</button></div></section>}
    </section>
  );
}

export default SpeakerManagement;
