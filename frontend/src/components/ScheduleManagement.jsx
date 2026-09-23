import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSchedule, deleteSchedule, getSchedule, getSchedules, getSpeakers, updateSchedule } from "../services/api";
import ScheduleForm from "./ScheduleForm";

const EMPTY = { title: "", description: "", start_time: "", end_time: "", location: "", speaker_id: "" };

const localValue = (value) => (typeof value === "string" ? value.slice(0, 16) : "");

const clock = (value) => localValue(value).slice(11, 16) || "—";

const dateLabel = (value) => {
  const literal = localValue(value);
  return literal ? `${literal.slice(8, 10)}/${literal.slice(5, 7)}/${literal.slice(0, 4)}` : "—";
};

const calcDuration = (start, end) => {
  if (!start || !end) return "";
  const s = new Date(start);
  const e = new Date(end);
  const diffMs = e - s;
  if (isNaN(diffMs) || diffMs <= 0) return "";
  const diffMins = Math.round(diffMs / (1000 * 60));
  if (diffMins < 60) return `${diffMins} phút`;
  const hours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}p` : `${hours} giờ`;
};

function ScheduleManagement({ event, token, onUnauthorized, onDirtyChange }) {
  const [schedules, setSchedules] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [speakersLoading, setSpeakersLoading] = useState(true);
  const [error, setError] = useState("");
  const [speakerError, setSpeakerError] = useState("");
  const [success, setSuccess] = useState("");
  const [reload, setReload] = useState(0);

  const [form, setForm] = useState(EMPTY);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const busy = useRef(false);
  const detailRequest = useRef(0);

  const fail = useCallback(
    (e, target) => {
      if (e.status === 401) onUnauthorized();
      else
        target(
          e.status === 403
            ? "Bạn không có quyền quản lý lịch trình này."
            : e.status === 404
            ? "Không tìm thấy sự kiện."
            : e.status === 0
            ? "Không thể kết nối đến máy chủ."
            : "Không thể tải lịch trình."
        );
    },
    [onUnauthorized]
  );

  useEffect(() => {
    const controller = new AbortController();
    setSchedules([]);
    setSpeakers([]);
    setLoading(true);
    setSpeakersLoading(true);
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY);
    setDirty(false);
    onDirtyChange(false);
    setFormError("");

    getSchedules(event.id, token, controller.signal)
      .then(setSchedules)
      .catch((e) => {
        if (e.name !== "AbortError") fail(e, setError);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    getSpeakers(event.id, token, controller.signal)
      .then(setSpeakers)
      .catch((e) => {
        if (e.name !== "AbortError") fail(e, setSpeakerError);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSpeakersLoading(false);
      });

    return () => controller.abort();
  }, [event.id, token, reload, fail, onDirtyChange]);

  const dirtySet = (v) => {
    setDirty(v);
    onDirtyChange(v);
  };

  const confirmDiscard = () => !dirty || window.confirm("Hủy các thay đổi chưa lưu?");

  const reset = () => {
    setForm(EMPTY);
    setFormOpen(false);
    setEditingId(null);
    setFormError("");
    dirtySet(false);
  };

  const cancel = () => {
    if (confirmDiscard()) reset();
  };

  const change = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    dirtySet(true);
    setFormError("");
  };

  const openNew = () => {
    if (!confirmDiscard()) return;
    reset();
    setSuccess("");
    setFormOpen(true);
  };

  const edit = async (id) => {
    if (formOpen && !confirmDiscard()) return;
    const request = ++detailRequest.current;
    setError("");
    try {
      const item = await getSchedule(event.id, id, token);
      if (request !== detailRequest.current) return;
      setEditingId(item.id);
      setFormOpen(true);
      dirtySet(false);
      setForm({
        title: item.title,
        description: item.description || "",
        start_time: localValue(item.start_time),
        end_time: localValue(item.end_time),
        location: item.location || "",
        speaker_id: item.speaker_id == null ? "" : String(item.speaker_id),
      });
    } catch (e) {
      if (e.status === 401) onUnauthorized();
      else {
        setError(
          e.status === 404
            ? "Không tìm thấy phiên lịch trình."
            : e.status === 0
            ? "Không thể kết nối đến máy chủ."
            : "Không thể tải thông tin phiên."
        );
        if (e.status === 404) {
          reset();
          setReload((v) => v + 1);
        }
      }
    }
  };

  const validate = () => {
    const title = form.title.trim();
    if (title.length < 3 || title.length > 200) return "Tên phiên phải từ 3 đến 200 ký tự.";
    if (!form.start_time || !form.end_time) return "Vui lòng nhập thời gian bắt đầu và kết thúc.";
    if (form.end_time <= form.start_time) return "Thời gian kết thúc phải sau thời gian bắt đầu.";
    if (form.start_time < localValue(event.start_time))
      return "Thời gian bắt đầu của phiên phải nằm trong khung thời gian sự kiện.";
    if (form.end_time > localValue(event.end_time))
      return "Thời gian kết thúc của phiên phải nằm trong khung thời gian sự kiện.";
    return "";
  };

  const submit = async () => {
    if (busy.current) return;
    const message = validate();
    if (message) {
      setFormError(message);
      return;
    }
    const optional = (v) => v.trim() || null;
    const payload = {
      title: form.title.trim(),
      description: optional(form.description),
      start_time: form.start_time,
      end_time: form.end_time,
      location: optional(form.location),
      speaker_id: form.speaker_id === "" ? null : Number(form.speaker_id),
    };
    busy.current = true;
    setSubmitting(true);
    setFormError("");
    try {
      if (editingId == null) await createSchedule(event.id, payload, token);
      else await updateSchedule(event.id, editingId, payload, token);
      setSuccess(editingId == null ? "Thêm phiên thành công." : "Cập nhật phiên thành công.");
      reset();
      setReload((v) => v + 1);
    } catch (e) {
      if (e.status === 401) onUnauthorized();
      else if (e.status === 403) setFormError("Bạn không có quyền quản lý lịch trình này.");
      else if (e.status === 404)
        setFormError(editingId == null ? "Không tìm thấy sự kiện." : "Không tìm thấy phiên.");
      else if (e.status === 422)
        setFormError(
          String(e.message).includes("Speaker does not belong")
            ? "Diễn giả đã chọn không thuộc sự kiện này."
            : "Vui lòng kiểm tra lại thời gian và các trường thông tin của phiên."
        );
      else
        setFormError(
          e.status === 0
            ? "Không thể kết nối đến máy chủ."
            : editingId == null
            ? "Không thể thêm phiên."
            : "Không thể cập nhật phiên."
        );
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  const remove = async (item) => {
    if (busy.current || !window.confirm("Xóa phiên này khỏi sự kiện? Thao tác này không thể hoàn tác.")) return;
    busy.current = true;
    setSubmitting(true);
    try {
      await deleteSchedule(event.id, item.id, token);
      setSuccess("Xóa phiên thành công.");
      if (editingId === item.id) reset();
      setReload((v) => v + 1);
    } catch (e) {
      if (e.status === 401) onUnauthorized();
      else {
        setError(
          e.status === 404
            ? "Không tìm thấy phiên."
            : e.status === 403
            ? "Bạn không có quyền quản lý lịch trình này."
            : e.status === 0
            ? "Không thể kết nối đến máy chủ."
            : "Không thể xóa phiên."
        );
        if (e.status === 404) setReload((v) => v + 1);
      }
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  // Find speaker helper
  const getSpeakerObj = (id) => {
    if (id == null) return null;
    return speakers.find((s) => s.id === id) || null;
  };

  // Chronologically sorted schedules
  const sortedSchedules = useMemo(() => {
    return [...schedules].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  }, [schedules]);

  return (
    <section className="schedule-management-root" aria-label="Quản lý lịch trình sự kiện">
      {/* Context Banner */}
      <div className="schedule-context-banner">
        <div className="schedule-context-title">
          <p className="hero-eyebrow" style={{ margin: 0 }}>LỊCH TRÌNH SỰ KIỆN</p>
          <h3>{event.title}</h3>
        </div>

        <div className="schedule-context-meta">
          <span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {dateLabel(event.start_time)}
          </span>
          <span>•</span>
          <span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {clock(event.start_time)} – {clock(event.end_time)}
          </span>
          <span>•</span>
          <span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {event.location}
          </span>
        </div>
      </div>

      {/* Heading & Add Button */}
      <div className="speaker-mgmt-header" style={{ marginTop: "0.25rem" }}>
        <div>
          <h3>Chương trình nghị sự</h3>
          <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
            Tổng số: <strong>{schedules.length} phiên hoạt động</strong>
          </span>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={openNew}
          disabled={submitting}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Thêm phiên mới
        </button>
      </div>

      {success && <div className="inline-message success-message" role="status">{success}</div>}
      {error && <div className="inline-message error-message" role="alert">{error}</div>}
      {speakerError && (
        <div className="inline-message error-message">
          Không thể tải danh sách diễn giả. Các phiên lịch trình vẫn khả dụng.
        </div>
      )}

      {loading && (
        <div className="compact-state">
          <div className="app-loader" />
          <p>Đang tải lịch trình sự kiện...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && schedules.length === 0 && !formOpen && (
        <div className="compact-state">
          <div className="ai-sparkle-icon" style={{ margin: "0 auto 0.75rem", width: 44, height: 44 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <strong>Chưa có phiên lịch trình nào.</strong>
          <p>Tạo các phiên thảo luận hoặc hoạt động để người tham dự nắm rõ thời gian biểu.</p>
          <button type="button" className="primary-button" onClick={openNew}>
            + Thêm phiên đầu tiên
          </button>
        </div>
      )}

      {/* Vertical Timeline / Agenda Cards */}
      {!loading && schedules.length > 0 && !formOpen && (
        <div className="schedule-timeline-container" aria-label="Dòng thời gian sự kiện">
          <div className="schedule-timeline-spine" aria-hidden="true" />

          {sortedSchedules.map((item) => {
            const speakerObj = getSpeakerObj(item.speaker_id);
            const durationText = calcDuration(item.start_time, item.end_time);

            return (
              <article key={item.id} className="timeline-agenda-item">
                {/* Time Column */}
                <div className="timeline-time-col">
                  <span className="timeline-time-start">{clock(item.start_time)}</span>
                  <span className="timeline-time-end">đến {clock(item.end_time)}</span>
                </div>

                {/* Glowing Node Dot */}
                <div className="timeline-node-dot" aria-hidden="true" />

                {/* Agenda Card */}
                <div className="timeline-card">
                  <div className="timeline-card-header">
                    <h4 className="timeline-card-title">{item.title}</h4>
                    {durationText && (
                      <span className="timeline-duration-badge">{durationText}</span>
                    )}
                  </div>

                  <div className="timeline-card-meta">
                    {item.location && (
                      <span className="timeline-meta-pill">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        {item.location}
                      </span>
                    )}

                    {speakerObj ? (
                      <span className="timeline-speaker-pill">
                        <div className="timeline-speaker-avatar-mini">
                          {speakerObj.full_name[0]?.toUpperCase() || "S"}
                        </div>
                        <span>{speakerObj.full_name}</span>
                        {speakerObj.title && (
                          <span style={{ color: "#cbd5e1", fontSize: "0.72rem" }}>
                            • {speakerObj.title}
                          </span>
                        )}
                      </span>
                    ) : item.speaker_id != null ? (
                      <span className="timeline-speaker-pill" style={{ opacity: 0.8 }}>
                        <span>Diễn giả #{item.speaker_id}</span>
                      </span>
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        Chưa phân công diễn giả
                      </span>
                    )}
                  </div>

                  {item.description && (
                    <p className="timeline-card-desc">{item.description}</p>
                  )}

                  {/* Actions */}
                  <div className="timeline-card-actions">
                    <button
                      type="button"
                      className="speaker-btn-edit"
                      onClick={() => edit(item.id)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Chỉnh sửa
                    </button>
                    <button
                      type="button"
                      className="speaker-btn-delete"
                      onClick={() => remove(item)}
                      disabled={submitting}
                      title="Xóa phiên"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Form Section */}
      {formOpen && (
        <ScheduleForm
          event={event}
          form={form}
          speakers={speakers}
          speakersLoading={speakersLoading}
          editing={editingId != null}
          loading={submitting}
          error={formError}
          onChange={change}
          onSubmit={submit}
          onCancel={cancel}
        />
      )}
    </section>
  );
}

export default ScheduleManagement;
