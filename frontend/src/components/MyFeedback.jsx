import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createEventFeedback,
  deleteMyEventFeedback,
  getMyEventFeedback,
  getMyFeedbacks,
  updateMyEventFeedback,
} from "../services/api";

const display = (value) => typeof value === "string" ? value.slice(0, 16).replace("T", " ") : "—";

function MyFeedback({ token, events = [], registrations, onUnauthorized }) {
  // Feedback is available in the list for every active registration.
  // The form itself is enabled only after CHECKED_IN.
  const feedbackRegistrations = useMemo(
    () => registrations.filter((item) => item.status !== "CANCELLED"),
    [registrations],
  );
  const checkedInRegistrations = useMemo(
    () => feedbackRegistrations.filter((item) => item.status === "CHECKED_IN"),
    [feedbackRegistrations],
  );
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [eventId, setEventId] = useState(feedbackRegistrations.length ? String(feedbackRegistrations[0].event_id) : "");
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(0), [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false), [dirty, setDirty] = useState(false);
  const [error, setError] = useState(""), [success, setSuccess] = useState(""), [saving, setSaving] = useState(false);
  const sequence = useRef(0), busy = useRef(false);

  const historyMap = useMemo(() => new Map(history.map((item) => [item.event_id, item])), [history]);
  const eventMap = useMemo(() => new Map(events.map((item) => [item.id, item])), [events]);
  const selectedHistory = historyMap.get(Number(eventId));
  const selectedRegistration = feedbackRegistrations.find(
    (item) => String(item.event_id) === eventId,
  );
  const selectedIsCheckedIn = selectedRegistration?.status === "CHECKED_IN";

  useEffect(() => {
    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryError("");
    getMyFeedbacks(token, controller.signal)
      .then((items) => setHistory(items))
      .catch((requestError) => {
        if (requestError.name === "AbortError") return;
        if (requestError.status === 401) onUnauthorized();
        else setHistoryError(requestError.status === 0 ? "Unable to connect to the server." : "Unable to load your feedback history.");
      })
      .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [token, onUnauthorized]);

  useEffect(() => {
    if (!feedbackRegistrations.some((item) => String(item.event_id) === eventId)) {
      setEventId(feedbackRegistrations.length ? String(feedbackRegistrations[0].event_id) : "");
    }
  }, [feedbackRegistrations, eventId]);

  useEffect(() => {
    if (!eventId || !selectedIsCheckedIn) {
      setFeedback(null);
      setLoading(false);
      setEditing(false);
      setRating(0);
      setComment("");
      setError("");
      setSuccess("");
      setDirty(false);
      return;
    }
    const controller = new AbortController(), request = ++sequence.current;
    setLoading(true); setFeedback(null); setEditing(false); setRating(0); setComment(""); setError(""); setSuccess(""); setDirty(false);
    getMyEventFeedback(eventId, token, controller.signal)
      .then((value) => { if (request === sequence.current) setFeedback(value); })
      .catch((requestError) => {
        if (requestError.name === "AbortError" || request !== sequence.current) return;
        if (requestError.status === 401) onUnauthorized();
        else if (requestError.status !== 404 || requestError.message !== "Feedback not found") setError(requestError.status === 0 ? "Unable to connect to the server." : requestError.status === 404 ? "Event not found." : "Unable to load feedback.");
      })
      .finally(() => { if (request === sequence.current && !controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [eventId, token, onUnauthorized, selectedIsCheckedIn]);

  const mapError = (requestError) => {
    const message = String(requestError.message || "").toLowerCase();
    if (requestError.status === 403 && message.includes("after check-in")) return "Bạn chỉ có thể gửi feedback sau khi đã check-in sự kiện.";
    if (requestError.status === 403) return "Bạn không đủ điều kiện gửi feedback cho sự kiện này.";
    if (requestError.status === 409 && message.includes("already")) return "Bạn đã gửi feedback cho sự kiện này.";
    if (requestError.status === 422) return "Vui lòng chọn số sao từ 1 đến 5 và kiểm tra nội dung nhận xét.";
    if (requestError.status === 0) return "Không thể kết nối tới máy chủ.";
    return "Không thể hoàn tất thao tác feedback.";
  };

  const switchEvent = (value) => {
    if (!dirty || window.confirm("Discard unsaved feedback changes?")) setEventId(value);
  };

  const refreshHistory = async () => {
    try {
      setHistory(await getMyFeedbacks(token));
    } catch (requestError) {
      if (requestError.status === 401) onUnauthorized();
    }
  };

  const submit = async () => {
    if (busy.current || !eventId) return;
    if (!rating) { setError("Select a rating from 1 to 5."); return; }
    busy.current = true; setSaving(true); setError(""); setSuccess("");
    try {
      const payload = { rating, comment: comment.trim() || null };
      const value = feedback ? await updateMyEventFeedback(eventId, payload, token) : await createEventFeedback(eventId, payload, token);
      setFeedback(value); setEditing(false); setDirty(false);
      setSuccess(feedback ? "Feedback updated successfully." : "Feedback submitted successfully.");
      await refreshHistory();
    } catch (requestError) {
      if (requestError.status === 401) onUnauthorized();
      else setError(mapError(requestError));
    } finally { busy.current = false; setSaving(false); }
  };

  const edit = () => { setRating(feedback.rating); setComment(feedback.comment || ""); setEditing(true); setDirty(false); setError(""); setSuccess(""); };
  const remove = async () => {
    if (busy.current || !window.confirm("Delete your feedback for this event?")) return;
    busy.current = true; setSaving(true); setError("");
    try {
      await deleteMyEventFeedback(eventId, token);
      setFeedback(null); setRating(0); setComment(""); setEditing(false); setSuccess("Feedback deleted.");
      await refreshHistory();
    } catch (requestError) {
      if (requestError.status === 401) onUnauthorized();
      else setError(mapError(requestError));
    } finally { busy.current = false; setSaving(false); }
  };

  const formVisible = !feedback || editing;

  return (
    <section className="my-feedback">
      <div className="dashboard-title-row">
        <div>
          <p className="eyebrow">YOUR EXPERIENCE</p>
          <h1>My Feedback</h1>
          <p>Bạn chỉ có thể gửi feedback sau khi check-in, và feedback đã gửi sẽ được lưu để xem lại về sau.</p>
        </div>
      </div>

      {historyLoading ? (
        <div className="state-panel"><div className="app-loader"/><p>Loading feedback history...</p></div>
      ) : historyError ? (
        <div className="state-panel error-panel"><strong>Unable to load feedback history</strong><p>{historyError}</p></div>
      ) : (
        <>
          {history.length > 0 && (
            <section className="feedback-history-card">
              <div className="feedback-history-heading">
                <div>
                  <p className="eyebrow">HISTORY</p>
                  <h2>Feedback đã gửi</h2>
                </div>
                <span className="registration-status status-checked_in">{history.length} feedback</span>
              </div>
              <div className="feedback-history-list">
                {history.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`feedback-history-item ${String(item.event_id) === eventId ? "selected" : ""}`}
                    onClick={() => switchEvent(String(item.event_id))}
                  >
                    <span className="feedback-history-event">{item.event_title}</span>
                    <span className="rating-display" aria-label={`${item.rating} out of 5 stars`}>{"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}</span>
                    <span className="feedback-history-date">Updated {display(item.updated_at)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {feedbackRegistrations.length === 0 ? (
            <div className="state-panel">
              <strong>Chưa có sự kiện nào bạn đã đăng ký.</strong>
              <p>Các sự kiện đã đăng ký sẽ xuất hiện tại đây. Bạn chỉ có thể gửi feedback sau khi check-in.</p>
            </div>
          ) : (
            <section className="feedback-editor-section">
              <div className="editor-field feedback-event-field">
                <label htmlFor="feedback-event">Sự kiện đã đăng ký</label>
                <select id="feedback-event" value={eventId} onChange={(event) => switchEvent(event.target.value)} disabled={saving}>
                  {feedbackRegistrations.map((item) => {
                    const eventTitle = item.event_title || eventMap.get(item.event_id)?.title || historyMap.get(item.event_id)?.event_title;
                    const statusLabel = item.status === "CHECKED_IN" ? "✓ Đã check-in" : "• Chưa check-in";
                    return <option key={item.id} value={item.event_id}>{eventTitle || `Event #${item.event_id}`} — {statusLabel}</option>;
                  })}
                </select>
              </div>
              {!selectedIsCheckedIn ? (
                <div className="feedback-card feedback-locked-state">
                  <span className="registration-status status-registered">Chưa check-in</span>
                  <h3>Chưa thể gửi feedback</h3>
                  <p>Bạn đã đăng ký sự kiện này, nhưng hệ thống chưa ghi nhận check-in. Feedback sẽ được mở sau khi Staff xác nhận bạn đã check-in.</p>
                </div>
              ) : loading ? <div className="state-panel"><div className="app-loader"/><p>Loading feedback...</p></div> : <div className="feedback-card">
                {success && <div className="inline-message success-message">{success}</div>}
                {error && <div className="inline-message error-message">{error}</div>}
                {formVisible ? <>
                  <p>{feedback ? "Update your feedback." : "No feedback submitted yet for this event."}</p>
                  <fieldset className="rating-field"><legend>Your Rating *</legend><div>{[1,2,3,4,5].map((number) => <button type="button" key={number} aria-label={`Rate ${number} out of 5 stars`} className={number <= rating ? "selected" : ""} onClick={() => { setRating(number); setDirty(true); setError(""); }}>★</button>)}</div></fieldset>
                  <div className="editor-field"><label htmlFor="feedback-comment">Comment</label><textarea id="feedback-comment" rows={6} maxLength={2000} value={comment} onChange={(event) => { setComment(event.target.value); setDirty(true); }}/><span className="character-count">{comment.length}/2000</span></div>
                  <div className="feedback-actions">{feedback && <button type="button" className="secondary-button" onClick={() => { setEditing(false); setDirty(false); setError(""); }}>Cancel</button>}<button type="button" className="primary-button" disabled={saving} onClick={submit}>{saving ? "Saving..." : feedback ? "Save Changes" : "Submit Feedback"}</button></div>
                </> : <>
                  <div className="feedback-view"><span className="registration-status status-checked_in">✓ FEEDBACK SAVED</span><div className="rating-display" aria-label={`${feedback.rating} out of 5 stars`}>{"★".repeat(feedback.rating)}{"☆".repeat(5 - feedback.rating)}</div><p>{feedback.comment || "No comment provided."}</p><dl><div><dt>Submitted</dt><dd>{display(feedback.created_at)}</dd></div><div><dt>Updated</dt><dd>{display(feedback.updated_at)}</dd></div></dl></div>
                  <div className="feedback-actions"><button type="button" className="secondary-button" onClick={edit}>Edit</button><button type="button" className="danger-button" disabled={saving} onClick={remove}>Delete</button></div>
                </>}
              </div>}
            </section>
          )}
        </>
      )}
    </section>
  );
}

export default MyFeedback;
