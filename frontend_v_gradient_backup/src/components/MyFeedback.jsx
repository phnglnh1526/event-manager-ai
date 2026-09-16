import React, { useEffect, useRef, useState } from "react";
import { createEventFeedback, deleteMyEventFeedback, getMyEventFeedback, updateMyEventFeedback } from "../services/api";

const display = (value) => typeof value === "string" ? value.slice(0, 16).replace("T", " ") : "—";

function MyFeedback({ token, events, registrations, onUnauthorized }) {
  const eligible = registrations.filter((item) => item.status === "REGISTERED");
  const eventMap = new Map(events.map((event) => [event.id, event]));
  const [eventId, setEventId] = useState(eligible.length ? String(eligible[0].event_id) : "");
  const [feedback, setFeedback] = useState(null), [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(0), [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false), [dirty, setDirty] = useState(false);
  const [error, setError] = useState(""), [success, setSuccess] = useState(""), [saving, setSaving] = useState(false);
  const sequence = useRef(0), busy = useRef(false);

  useEffect(() => {
    if (!eligible.some((item) => String(item.event_id) === eventId)) setEventId(eligible.length ? String(eligible[0].event_id) : "");
  }, [registrations, eventId]);

  useEffect(() => {
    if (!eventId) { setFeedback(null); return; }
    const controller = new AbortController(), request = ++sequence.current;
    setLoading(true); setFeedback(null); setEditing(false); setRating(0); setComment(""); setError(""); setSuccess(""); setDirty(false);
    getMyEventFeedback(eventId, token, controller.signal)
      .then((value) => { if (request === sequence.current) setFeedback(value); })
      .catch((requestError) => {
        if (requestError.name === "AbortError" || request !== sequence.current) return;
        if (requestError.status === 401) onUnauthorized();
        else if (!(requestError.status === 404 && requestError.message === "Feedback not found")) setError(requestError.status === 0 ? "Unable to connect to the server." : requestError.status === 404 ? "Event not found." : "Unable to load feedback.");
      })
      .finally(() => { if (request === sequence.current && !controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [eventId, token, onUnauthorized]);

  const mapError = (requestError) => {
    const message = requestError.message || "";
    if (requestError.status === 403 && message.includes("after check-in")) return "Feedback is available after you check in to the event.";
    if (requestError.status === 403) return "An active event registration is required to submit feedback.";
    if (requestError.status === 409 && message.includes("already")) return "You have already submitted feedback for this event.";
    if (requestError.status === 409) return "Feedback is not available for this event.";
    if (requestError.status === 422) return "Please select a valid rating and review your comment.";
    if (requestError.status === 0) return "Unable to connect to the server.";
    return "Feedback request could not be completed.";
  };
  const switchEvent = (value) => { if (!dirty || window.confirm("Discard unsaved feedback changes?")) setEventId(value); };
  const submit = async () => {
    if (busy.current) return;
    if (!rating) { setError("Select a rating from 1 to 5."); return; }
    busy.current = true; setSaving(true); setError(""); setSuccess("");
    try {
      const payload = { rating, comment: comment.trim() || null };
      const value = feedback ? await updateMyEventFeedback(eventId, payload, token) : await createEventFeedback(eventId, payload, token);
      setFeedback(value); setEditing(false); setDirty(false); setSuccess(feedback ? "Feedback updated successfully." : "Feedback submitted successfully.");
    } catch (requestError) { if (requestError.status === 401) onUnauthorized(); else setError(mapError(requestError)); }
    finally { busy.current = false; setSaving(false); }
  };
  const edit = () => { setRating(feedback.rating); setComment(feedback.comment || ""); setEditing(true); setDirty(false); setError(""); setSuccess(""); };
  const remove = async () => {
    if (busy.current || !window.confirm("Delete your feedback for this event?")) return;
    busy.current = true; setSaving(true); setError("");
    try { await deleteMyEventFeedback(eventId, token); setFeedback(null); setRating(0); setComment(""); setEditing(false); setSuccess("Feedback deleted."); }
    catch (requestError) { if (requestError.status === 401) onUnauthorized(); else setError(mapError(requestError)); }
    finally { busy.current = false; setSaving(false); }
  };
  const formVisible = !feedback || editing;

  return <section className="my-feedback"><div className="dashboard-title-row"><div><p className="eyebrow">YOUR EXPERIENCE</p><h1>My Feedback</h1><p>Share your experience after attending and checking in.</p></div></div>{eligible.length === 0 ? <div className="state-panel"><strong>You have no registered events available for feedback.</strong></div> : <><div className="editor-field feedback-event-field"><label htmlFor="feedback-event">Event</label><select id="feedback-event" value={eventId} onChange={(event) => switchEvent(event.target.value)} disabled={saving}>{eligible.map((item) => <option key={item.id} value={item.event_id}>{eventMap.get(item.event_id)?.title || `Event #${item.event_id}`}</option>)}</select></div>{loading ? <div className="state-panel"><div className="app-loader"/><p>Loading feedback...</p></div> : <div className="feedback-card">{success && <div className="inline-message success-message">{success}</div>}{error && <div className="inline-message error-message">{error}</div>}{formVisible ? <><p>{feedback ? "Update your feedback." : "No feedback submitted yet."}</p><fieldset className="rating-field"><legend>Your Rating *</legend><div>{[1, 2, 3, 4, 5].map((number) => <button type="button" key={number} aria-label={`Rate ${number} out of 5`} className={number <= rating ? "selected" : ""} onClick={() => { setRating(number); setDirty(true); setError(""); }}>★</button>)}</div></fieldset><div className="editor-field"><label htmlFor="feedback-comment">Comment</label><textarea id="feedback-comment" rows={6} maxLength={2000} value={comment} onChange={(event) => { setComment(event.target.value); setDirty(true); }}/><span className="character-count">{comment.length}/2000</span></div><div className="feedback-actions">{feedback && <button type="button" className="secondary-button" onClick={() => { setEditing(false); setDirty(false); setError(""); }}>Cancel</button>}<button type="button" className="primary-button" disabled={saving} onClick={submit}>{saving ? "Saving..." : feedback ? "Save Changes" : "Submit Feedback"}</button></div></> : <><div className="feedback-view"><span className="registration-status status-registered">YOUR FEEDBACK</span><div className="rating-display" aria-label={`${feedback.rating} out of 5 stars`}>{"★".repeat(feedback.rating)}{"☆".repeat(5 - feedback.rating)}</div><p>{feedback.comment || "No comment provided."}</p><dl><div><dt>Submitted</dt><dd>{display(feedback.created_at)}</dd></div><div><dt>Updated</dt><dd>{display(feedback.updated_at)}</dd></div></dl></div><div className="feedback-actions"><button type="button" className="secondary-button" onClick={edit}>Edit</button><button type="button" className="danger-button" disabled={saving} onClick={remove}>Delete</button></div></>}</div>}</>}</section>;
}

export default MyFeedback;
