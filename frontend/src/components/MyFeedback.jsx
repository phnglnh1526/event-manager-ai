import React, { useEffect, useRef, useState } from "react";
import { createEventFeedback, deleteMyEventFeedback, getMyEventFeedback, updateMyEventFeedback } from "../services/api";

const display = (value) => {
  if (typeof value !== "string" || !value) return "—";
  const trimmed = value.slice(0, 16);
  const parts = trimmed.split("T");
  if (parts.length === 2) {
    const [d, t] = parts;
    const sub = d.split("-");
    if (sub.length === 3) return `${sub[2]}/${sub[1]}/${sub[0]} ${t}`;
  }
  return trimmed.replace("T", " ");
};

function MyFeedback({ token, events, registrations, onUnauthorized }) {
  const eligible = registrations.filter((item) => item.status === "REGISTERED");
  const eventMap = new Map(events.map((event) => [event.id, event]));
  const [eventId, setEventId] = useState(eligible.length ? String(eligible[0].event_id) : "");
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const sequence = useRef(0);
  const busy = useRef(false);

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
        else if (!(requestError.status === 404 && requestError.message === "Feedback not found")) setError(requestError.status === 0 ? "Không thể kết nối đến máy chủ." : requestError.status === 404 ? "Không tìm thấy sự kiện." : "Không thể tải phản hồi.");
      })
      .finally(() => { if (request === sequence.current && !controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [eventId, token, onUnauthorized]);

  const mapError = (requestError) => {
    const message = requestError.message || "";
    if (requestError.status === 403 && message.includes("after check-in")) return "Bạn chỉ có thể gửi phản hồi sau khi đã check-in vào sự kiện.";
    if (requestError.status === 403) return "Cần có đăng ký sự kiện đang hoạt động để gửi phản hồi.";
    if (requestError.status === 409 && message.includes("already")) return "Bạn đã gửi phản hồi cho sự kiện này rồi.";
    if (requestError.status === 409) return "Sự kiện hiện không tiếp nhận phản hồi.";
    if (requestError.status === 422) return "Vui lòng chọn số sao hợp lệ và kiểm tra lại nhận xét của bạn.";
    if (requestError.status === 0) return "Không thể kết nối đến máy chủ.";
    return "Không thể hoàn tất yêu cầu phản hồi.";
  };
  const switchEvent = (value) => { if (!dirty || window.confirm("Hủy các thay đổi phản hồi chưa lưu?")) setEventId(value); };
  const submit = async () => {
    if (busy.current) return;
    if (!rating) { setError("Vui lòng chọn đánh giá từ 1 đến 5 sao."); return; }
    busy.current = true; setSaving(true); setError(""); setSuccess("");
    try {
      const payload = { rating, comment: comment.trim() || null };
      const value = feedback ? await updateMyEventFeedback(eventId, payload, token) : await createEventFeedback(eventId, payload, token);
      setFeedback(value); setEditing(false); setDirty(false); setSuccess(feedback ? "Cập nhật phản hồi thành công." : "Gửi phản hồi thành công.");
    } catch (requestError) { if (requestError.status === 401) onUnauthorized(); else setError(mapError(requestError)); }
    finally { busy.current = false; setSaving(false); }
  };
  const edit = () => { setRating(feedback.rating); setComment(feedback.comment || ""); setEditing(true); setDirty(false); setError(""); setSuccess(""); };
  const remove = async () => {
    if (busy.current || !window.confirm("Xóa phản hồi của bạn cho sự kiện này? Thao tác này không thể hoàn tác.")) return;
    busy.current = true; setSaving(true); setError("");
    try { await deleteMyEventFeedback(eventId, token); setFeedback(null); setRating(0); setComment(""); setEditing(false); setSuccess("Đã xóa phản hồi."); }
    catch (requestError) { if (requestError.status === 401) onUnauthorized(); else setError(mapError(requestError)); }
    finally { busy.current = false; setSaving(false); }
  };
  const formVisible = !feedback || editing;

  return (
    <section className="my-feedback">
      <div className="dashboard-title-row">
        <div>
          <p className="eyebrow">TRẢI NGHIỆM CỦA BẠN</p>
          <h1>Phản hồi của tôi</h1>
          <p>Chia sẻ cảm nhận và đánh giá sau khi tham gia sự kiện.</p>
        </div>
      </div>
      {eligible.length === 0 ? (
        <div className="state-panel">
          <strong>Bạn chưa có sự kiện nào đủ điều kiện để gửi phản hồi.</strong>
        </div>
      ) : (
        <>
          <div className="editor-field feedback-event-field">
            <label htmlFor="feedback-event">Sự kiện</label>
            <select id="feedback-event" value={eventId} onChange={(event) => switchEvent(event.target.value)} disabled={saving}>
              {eligible.map((item) => (
                <option key={item.id} value={item.event_id}>
                  {eventMap.get(item.event_id)?.title || `Sự kiện #${item.event_id}`}
                </option>
              ))}
            </select>
          </div>
          {loading ? (
            <div className="state-panel"><div className="app-loader"/><p>Đang tải phản hồi...</p></div>
          ) : (
            <div className="feedback-card">
              {success && <div className="inline-message success-message">{success}</div>}
              {error && <div className="inline-message error-message">{error}</div>}
              {formVisible ? (
                <>
                  <p>{feedback ? "Cập nhật phản hồi của bạn." : "Chưa có phản hồi nào được gửi."}</p>
                  <fieldset className="rating-field">
                    <legend>Đánh giá của bạn *</legend>
                    <div>
                      {[1, 2, 3, 4, 5].map((number) => (
                        <button
                          type="button"
                          key={number}
                          aria-label={`Đánh giá ${number} trên 5 sao`}
                          className={number <= rating ? "selected" : ""}
                          onClick={() => { setRating(number); setDirty(true); setError(""); }}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <div className="editor-field">
                    <label htmlFor="feedback-comment">Nhận xét / Ý kiến đóng góp</label>
                    <textarea
                      id="feedback-comment"
                      rows={6}
                      maxLength={2000}
                      value={comment}
                      onChange={(event) => { setComment(event.target.value); setDirty(true); }}
                      placeholder="Chia sẻ trải nghiệm của bạn về nội dung, diễn giả, công tác tổ chức..."
                    />
                    <span className="character-count">{comment.length}/2000</span>
                  </div>
                  <div className="feedback-actions">
                    {feedback && (
                      <button type="button" className="secondary-button" onClick={() => { setEditing(false); setDirty(false); setError(""); }}>
                        Hủy
                      </button>
                    )}
                    <button type="button" className="primary-button" disabled={saving} onClick={submit}>
                      {saving ? "Đang lưu..." : feedback ? "Lưu thay đổi" : "Gửi phản hồi"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="feedback-view">
                    <span className="registration-status status-registered">PHẢN HỒI CỦA BẠN</span>
                    <div className="rating-display" aria-label={`${feedback.rating} trên 5 sao`}>
                      {"★".repeat(feedback.rating)}{"☆".repeat(5 - feedback.rating)}
                    </div>
                    <p>{feedback.comment || "Chưa có nhận xét."}</p>
                    <dl>
                      <div><dt>Đã gửi</dt><dd>{display(feedback.created_at)}</dd></div>
                      <div><dt>Cập nhật lần cuối</dt><dd>{display(feedback.updated_at)}</dd></div>
                    </dl>
                  </div>
                  <div className="feedback-actions">
                    <button type="button" className="secondary-button" onClick={edit}>Chỉnh sửa</button>
                    <button type="button" className="danger-button" disabled={saving} onClick={remove}>Xóa</button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default MyFeedback;
