import React, { useCallback, useEffect, useRef, useState } from "react";

import { createSpeaker, deleteSpeaker, getSpeaker, getSpeakers, updateSpeaker } from "../services/api";
import SpeakerForm from "./SpeakerForm";

const EMPTY_FORM = { full_name: "", title: "", organization: "", email: "", bio: "" };

const DELETE_WARNING =
  "Xóa diễn giả này khỏi sự kiện? Các phiên lịch trình hiện có vẫn được giữ nguyên nhưng thông tin diễn giả liên kết sẽ bị xóa. Thao tác này không thể hoàn tác.";

const displayDateTime = (value) => {
  if (typeof value !== "string" || !value) return "—";
  const trimmed = value.slice(0, 16);
  const parts = trimmed.split("T");
  if (parts.length === 2) {
    const [datePart, timePart] = parts;
    const dateSub = datePart.split("-");
    if (dateSub.length === 3) {
      return `${dateSub[2]}/${dateSub[1]}/${dateSub[0]} ${timePart}`;
    }
  }
  return trimmed.replace("T", " ");
};

const getInitials = (name) => {
  if (!name || typeof name !== "string") return "SP";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

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

  const reportError = useCallback(
    (requestError, fallback) => {
      if (requestError.status === 401) {
        onUnauthorized();
        return;
      }
      if (requestError.status === 403) setError("Bạn không có quyền quản lý diễn giả.");
      else if (requestError.status === 404) setError("Không tìm thấy sự kiện.");
      else if (requestError.status === 0) setError("Không thể kết nối đến máy chủ.");
      else setError(fallback);
    },
    [onUnauthorized]
  );

  useEffect(() => {
    const controller = new AbortController();
    setSpeakers([]);
    setDetail(null);
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDirty(false);
    onDirtyChange(false);
    setFormError("");
    setLoading(true);

    getSpeakers(event.id, token, controller.signal)
      .then(setSpeakers)
      .catch((requestError) => {
        if (requestError.name !== "AbortError") reportError(requestError, "Không thể tải danh sách diễn giả.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [event.id, token, reload, reportError, onDirtyChange]);

  const setDirtyState = (value) => {
    setDirty(value);
    onDirtyChange(value);
  };

  const confirmDiscard = () => !dirty || window.confirm("Hủy các thay đổi chưa lưu?");

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFormOpen(false);
    setEditingId(null);
    setFormError("");
    setDirtyState(false);
  };

  const cancelForm = () => {
    if (confirmDiscard()) resetForm();
  };

  const changeForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setDirtyState(true);
    setFormError("");
  };

  const openNew = () => {
    if (!confirmDiscard()) return;
    resetForm();
    setDetail(null);
    setSuccess("");
    setFormOpen(true);
  };

  const openDetail = async (speakerId, editMode = false) => {
    if (formOpen && !confirmDiscard()) return;
    if (formOpen) resetForm();
    const requestId = ++detailRequest.current;
    setError("");
    setSuccess("");

    try {
      const speaker = await getSpeaker(event.id, speakerId, token);
      if (requestId !== detailRequest.current) return;
      if (editMode) {
        setEditingId(speaker.id);
        setDetail(null);
        setFormOpen(true);
        setDirtyState(false);
        setForm({
          full_name: speaker.full_name || "",
          title: speaker.title || "",
          organization: speaker.organization || "",
          email: speaker.email || "",
          bio: speaker.bio || "",
        });
      } else {
        setDetail(speaker);
      }
    } catch (requestError) {
      if (requestId !== detailRequest.current) return;
      if (requestError.status === 401) {
        onUnauthorized();
        return;
      }
      if (requestError.status === 404) {
        setError("Không tìm thấy diễn giả.");
        resetForm();
        setDetail(null);
        setReload((value) => value + 1);
      } else {
        reportError(requestError, "Không thể tải thông tin diễn giả.");
      }
    }
  };

  const validate = () => {
    const name = form.full_name.trim();
    if (name.length < 2 || name.length > 150) return "Họ và tên phải từ 2 đến 150 ký tự.";
    if (form.title.trim().length > 150) return "Chức danh không được vượt quá 150 ký tự.";
    if (form.organization.trim().length > 200) return "Đơn vị/tổ chức không được vượt quá 200 ký tự.";
    if (form.bio.trim().length > 5000) return "Tiểu sử không được vượt quá 5.000 ký tự.";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      return "Vui lòng nhập địa chỉ email hợp lệ.";
    return "";
  };

  const submit = async () => {
    if (requestInFlight.current) return;
    const validation = validate();
    if (validation) {
      setFormError(validation);
      return;
    }
    const optional = (value) => value.trim() || null;
    const payload = {
      full_name: form.full_name.trim(),
      title: optional(form.title),
      organization: optional(form.organization),
      email: optional(form.email)?.toLowerCase() || null,
      bio: optional(form.bio),
    };

    requestInFlight.current = true;
    setSubmitting(true);
    setFormError("");
    setSuccess("");

    try {
      if (editingId == null) await createSpeaker(event.id, payload, token);
      else await updateSpeaker(event.id, editingId, payload, token);
      setSuccess(editingId == null ? "Thêm diễn giả thành công." : "Cập nhật diễn giả thành công.");
      resetForm();
      setReload((value) => value + 1);
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized();
        return;
      }
      if (requestError.status === 403) setFormError("Bạn không có quyền quản lý diễn giả.");
      else if (requestError.status === 404) {
        setError(editingId == null ? "Không tìm thấy sự kiện." : "Không tìm thấy diễn giả.");
        if (editingId != null) setReload((value) => value + 1);
      } else if (requestError.status === 422) {
        setFormError("Vui lòng kiểm tra lại thông tin diễn giả và thử lại.");
      } else {
        setFormError(
          requestError.status === 0
            ? "Không thể kết nối đến máy chủ."
            : editingId == null
            ? "Không thể thêm diễn giả."
            : "Không thể cập nhật diễn giả."
        );
      }
    } finally {
      requestInFlight.current = false;
      setSubmitting(false);
    }
  };

  const remove = async (speaker) => {
    if (requestInFlight.current || !window.confirm(DELETE_WARNING)) return;
    requestInFlight.current = true;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await deleteSpeaker(event.id, speaker.id, token);
      setSuccess("Xóa diễn giả thành công.");
      if (detail?.id === speaker.id) setDetail(null);
      resetForm();
      setReload((value) => value + 1);
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized();
        return;
      }
      if (requestError.status === 403) setError("Bạn không có quyền quản lý diễn giả.");
      else if (requestError.status === 404) {
        setError("Không tìm thấy diễn giả.");
        setDetail(null);
        resetForm();
        setReload((value) => value + 1);
      } else {
        setError(requestError.status === 0 ? "Không thể kết nối đến máy chủ." : "Không thể xóa diễn giả.");
      }
    } finally {
      requestInFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section className="speaker-management-root" aria-label="Quản lý diễn giả sự kiện">
      {/* Header */}
      <div className="speaker-mgmt-header">
        <div>
          <p className="hero-eyebrow" style={{ margin: 0 }}>DIỄN GIẢ SỰ KIỆN</p>
          <h3>Diễn giả</h3>
          <span className="related-event-tag">Sự kiện: <strong>{event.title}</strong></span>
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
          Thêm diễn giả
        </button>
      </div>

      {success && <div className="inline-message success-message" role="status">{success}</div>}
      {error && (
        <div className="inline-message error-message" role="alert">
          {error}
          <button type="button" className="text-button" onClick={() => { setError(""); setReload((value) => value + 1); }}>
            Thử lại
          </button>
        </div>
      )}

      {loading && (
        <div className="compact-state">
          <div className="app-loader" />
          <p>Đang tải danh sách diễn giả...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && speakers.length === 0 && !formOpen && (
        <div className="compact-state">
          <div className="ai-sparkle-icon" style={{ margin: "0 auto 0.75rem", width: 44, height: 44 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <strong>Chưa có diễn giả nào.</strong>
          <p>Thêm diễn giả đầu tiên để làm phong phú nội dung và lịch trình sự kiện.</p>
          <button type="button" className="primary-button" onClick={openNew}>
            + Thêm diễn giả ngay
          </button>
        </div>
      )}

      {/* Speaker Cards Grid */}
      {!loading && speakers.length > 0 && !formOpen && !detail && (
        <div className="speaker-cards-grid">
          {speakers.map((speaker) => (
            <article className="speaker-modern-card" key={speaker.id}>
              {/* Header with Avatar & Names */}
              <div className="speaker-card-header">
                <div className="speaker-avatar">
                  {getInitials(speaker.full_name)}
                </div>
                <div className="speaker-intro">
                  <h4 className="speaker-name" title={speaker.full_name}>
                    {speaker.full_name}
                  </h4>
                  {speaker.title && (
                    <span className="speaker-title-badge" title={speaker.title}>
                      {speaker.title}
                    </span>
                  )}
                  {speaker.organization && (
                    <span className="speaker-org" title={speaker.organization}>
                      {speaker.organization}
                    </span>
                  )}
                </div>
              </div>

              {/* Bio & Contact info */}
              <div className="speaker-card-body">
                {speaker.bio ? (
                  <p className="speaker-bio-clamped">{speaker.bio}</p>
                ) : (
                  <p className="speaker-bio-clamped" style={{ color: "#64748b", fontStyle: "italic" }}>
                    Chưa có tiểu sử tóm tắt.
                  </p>
                )}

                {speaker.email && (
                  <span className="speaker-email-pill" title={speaker.email}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    {speaker.email}
                  </span>
                )}

                <div className="speaker-event-ref">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>{event.title}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="speaker-card-actions">
                <button
                  type="button"
                  className="speaker-btn-view"
                  onClick={() => openDetail(speaker.id, false)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Xem
                </button>
                <button
                  type="button"
                  className="speaker-btn-edit"
                  onClick={() => openDetail(speaker.id, true)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Sửa
                </button>
                <button
                  type="button"
                  className="speaker-btn-delete"
                  onClick={() => remove(speaker)}
                  disabled={submitting}
                  title="Xóa diễn giả"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create / Edit Form */}
      {formOpen && (
        <SpeakerForm
          form={form}
          editing={editingId != null}
          loading={submitting}
          error={formError}
          onChange={changeForm}
          onSubmit={submit}
          onCancel={cancelForm}
        />
      )}

      {/* Speaker Detail Card */}
      {!formOpen && detail && (
        <section className="speaker-detail-card" aria-label="Chi tiết diễn giả">
          <div className="speaker-detail-header">
            <div className="speaker-detail-avatar">
              {getInitials(detail.full_name)}
            </div>
            <div className="speaker-detail-info" style={{ flex: 1 }}>
              <p className="hero-eyebrow" style={{ margin: 0 }}>HỒ SƠ DIỄN GIẢ</p>
              <h3>{detail.full_name}</h3>
              {detail.title && <span className="speaker-title-badge" style={{ fontSize: "0.85rem" }}>{detail.title}</span>}
              {detail.organization && <span className="speaker-org" style={{ fontSize: "0.8rem" }}>{detail.organization}</span>}
            </div>
            <button type="button" className="event-modal-close-btn" onClick={() => setDetail(null)} aria-label="Đóng">
              ✕
            </button>
          </div>

          <div className="speaker-detail-grid">
            <div className="speaker-detail-item">
              <dt>Sự kiện liên quan</dt>
              <dd><strong>{event.title}</strong></dd>
            </div>
            <div className="speaker-detail-item">
              <dt>Địa chỉ Email</dt>
              <dd>{detail.email || "—"}</dd>
            </div>
            <div className="speaker-detail-item">
              <dt>Ngày khởi tạo</dt>
              <dd>{displayDateTime(detail.created_at)}</dd>
            </div>
            <div className="speaker-detail-item">
              <dt>Cập nhật lần cuối</dt>
              <dd>{displayDateTime(detail.updated_at)}</dd>
            </div>
          </div>

          <div className="speaker-detail-bio-box">
            <h4>Tiểu sử chi tiết</h4>
            <p>{detail.bio || "Chưa có thông tin tiểu sử chi tiết cho diễn giả này."}</p>
          </div>

          <div className="speaker-card-actions" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="primary-button"
              onClick={() => openDetail(detail.id, true)}
            >
              Chỉnh sửa hồ sơ
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={() => remove(detail)}
              disabled={submitting}
            >
              Xóa diễn giả
            </button>
          </div>
        </section>
      )}
    </section>
  );
}

export default SpeakerManagement;
