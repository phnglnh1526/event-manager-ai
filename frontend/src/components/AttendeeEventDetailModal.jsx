import React, { useEffect, useState } from "react";
import EventCoverImage from "./EventCoverImage";
import { getAttendeeEventDetail } from "../services/api";

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

const formatTimeOnly = (value) => {
  if (typeof value !== "string" || !value) return "";
  const parts = value.split("T");
  if (parts.length === 2) {
    return parts[1].slice(0, 5);
  }
  return "";
};

const formatDateOnly = (value) => {
  if (typeof value !== "string" || !value) return "";
  const parts = value.split("T");
  const sub = parts[0].split("-");
  if (sub.length === 3) return `${sub[2]}/${sub[1]}/${sub[0]}`;
  return parts[0];
};

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "D";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)[0]}`.toUpperCase();
}

function AttendeeEventDetailModal({
  event,
  registration,
  token,
  busy,
  onClose,
  onRegister,
  onCancelRegistration,
  onAskAI,
}) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const isRegistered = registration?.status === "REGISTERED";

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);

    getAttendeeEventDetail(event.id, token, controller.signal)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch(() => {
        // Fallback to basic event object if detail endpoint isn't supported
        if (active) {
          setDetail({
            ...event,
            speakers: [],
            schedules: [],
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [event, token]);

  const activeEvent = detail || event;
  const speakers = activeEvent.speakers || [];
  const schedules = activeEvent.schedules || [];

  return (
    <div
      className="attendee-detail-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="attendee-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`event-detail-title-${activeEvent.id}`}
      >
        {/* Cover Hero Banner */}
        <div className="attendee-detail-hero">
          <EventCoverImage src={activeEvent.cover_image_url} alt={activeEvent.title} />
          <div className="attendee-detail-hero-gradient" />
          <button
            type="button"
            className="attendee-detail-close"
            onClick={onClose}
            aria-label="Đóng chi tiết sự kiện"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="attendee-detail-body">
          {/* Title & Badge */}
          <div className="attendee-detail-title-group">
            <span className="attendee-hero-badge">Sự kiện công bố</span>
            <h2 id={`event-detail-title-${activeEvent.id}`}>{activeEvent.title}</h2>
          </div>

          {/* Quick Meta Grid */}
          <div className="attendee-detail-meta-grid">
            <div className="attendee-detail-meta-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
              <div>
                <span>Ngày tổ chức</span>
                <strong>{formatDateOnly(activeEvent.start_time)}</strong>
              </div>
            </div>

            <div className="attendee-detail-meta-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <div>
                <span>Thời gian</span>
                <strong>
                  {formatTimeOnly(activeEvent.start_time)} – {formatTimeOnly(activeEvent.end_time)}
                </strong>
              </div>
            </div>

            <div className="attendee-detail-meta-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <div>
                <span>Địa điểm</span>
                <strong>{activeEvent.location || "Đang cập nhật"}</strong>
              </div>
            </div>

            <div className="attendee-detail-meta-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <div>
                <span>Sức chứa</span>
                <strong>
                  {activeEvent.max_attendees ? `${activeEvent.max_attendees} người` : "Không giới hạn"}
                </strong>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="attendee-detail-section">
            <h3 className="attendee-detail-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              Mô tả sự kiện
            </h3>
            <p className="attendee-detail-desc-text">
              {activeEvent.description || "Chưa có mô tả chi tiết cho sự kiện này."}
            </p>
          </div>

          {/* Speakers Section */}
          <div className="attendee-detail-section">
            <h3 className="attendee-detail-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Diễn giả khách mời ({speakers.length})
            </h3>
            {loading ? (
              <div className="compact-state">
                <div className="app-loader" />
                <p>Đang tải thông tin diễn giả...</p>
              </div>
            ) : speakers.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: "0.85rem", fontStyle: "italic", background: "#11152e", padding: "0.85rem", borderRadius: 8 }}>
                Chưa có diễn giả nào được công bố hoặc bạn có thể hỏi Trợ lý AI để cập nhật.
              </div>
            ) : (
              <div className="attendee-speakers-list">
                {speakers.map((spk) => (
                  <div className="attendee-speaker-item" key={spk.id}>
                    <div className="attendee-speaker-avatar">{getInitials(spk.full_name)}</div>
                    <div className="attendee-speaker-info">
                      <strong>{spk.full_name}</strong>
                      <span>{spk.title ? `${spk.title}${spk.organization ? ` · ${spk.organization}` : ""}` : spk.organization || "Diễn giả"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Schedule Section */}
          <div className="attendee-detail-section">
            <h3 className="attendee-detail-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Lịch trình sự kiện ({schedules.length})
            </h3>
            {loading ? (
              <div className="compact-state">
                <div className="app-loader" />
                <p>Đang tải lịch trình...</p>
              </div>
            ) : schedules.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: "0.85rem", fontStyle: "italic", background: "#11152e", padding: "0.85rem", borderRadius: 8 }}>
                Chưa có lịch trình phân đoạn chi tiết hoặc bạn có thể hỏi Trợ lý AI để biết thêm.
              </div>
            ) : (
              <div className="attendee-timeline">
                {schedules.map((sch) => (
                  <div className="attendee-timeline-item" key={sch.id}>
                    <div className="attendee-timeline-time">
                      {formatTimeOnly(sch.start_time)} – {formatTimeOnly(sch.end_time)}
                    </div>
                    <div className="attendee-timeline-title">{sch.title}</div>
                    {sch.description && (
                      <p style={{ margin: "0 0 0.4rem", fontSize: "0.8rem", color: "#94a3b8" }}>
                        {sch.description}
                      </p>
                    )}
                    <div className="attendee-timeline-meta">
                      {sch.location && <span>📍 {sch.location}</span>}
                      {sch.speaker_name && <span>🎙️ {sch.speaker_name}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="attendee-detail-footer">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              onClose();
              onAskAI(activeEvent);
            }}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            Hỏi Trợ lý AI
          </button>

          {isRegistered ? (
            <button
              type="button"
              className="danger-button"
              disabled={busy}
              onClick={() => onCancelRegistration(activeEvent, registration)}
            >
              {busy ? "Đang hủy..." : "Hủy đăng ký sự kiện"}
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={() => onRegister(activeEvent, registration)}
            >
              {busy ? "Đang đăng ký..." : "Đăng ký sự kiện"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default AttendeeEventDetailModal;
