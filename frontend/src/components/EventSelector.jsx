import React from "react";
import EventCoverImage from "./EventCoverImage";
import { EVENT_STATUS_LABELS } from "../locales/vi";

const literal = (value) => (typeof value === "string" ? value.slice(0, 16) : "");
const dateLabel = (value) => {
  const item = literal(value);
  return item ? `${item.slice(8, 10)}/${item.slice(5, 7)}/${item.slice(0, 4)}` : "";
};
const clock = (value) => literal(value).slice(11, 16) || "";

export function formatEventDateTime(startTime, endTime) {
  const startDate = dateLabel(startTime);
  const startClock = clock(startTime);
  if (!startDate) return "—";

  const endDate = dateLabel(endTime);
  const endClock = clock(endTime);

  if (!endDate) {
    return startClock ? `${startDate} · ${startClock}` : startDate;
  }

  if (startDate === endDate) {
    return startClock && endClock ? `${startDate} · ${startClock} – ${endClock}` : `${startDate} · ${startClock || endClock}`;
  }

  const startPart = startClock ? `${startDate} ${startClock}` : startDate;
  const endPart = endClock ? `${endDate} ${endClock}` : endDate;
  return `${startPart} – ${endPart}`;
}

export function SelectedEventCard({ event }) {
  if (!event) return null;
  const status = typeof event.status === "string" ? event.status : "DRAFT";
  const statusLower = status.toLowerCase();
  const statusLabel = EVENT_STATUS_LABELS[status] || status;
  const dateTimeDisplay = formatEventDateTime(event.start_time, event.end_time);

  return (
    <article className="analytics-hero-card" aria-label="Chi tiết sự kiện đang phân tích">
      <div className="hero-card-media">
        {event.cover_image_url ? (
          <EventCoverImage
            src={event.cover_image_url}
            alt={event.title}
            className="hero-card-img"
            fallbackClassName="hero-card-fallback"
          />
        ) : (
          <div className="hero-card-fallback" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <path d="M8 14h.01" />
              <path d="M12 14h.01" />
              <path d="M16 14h.01" />
              <path d="M8 18h.01" />
              <path d="M12 18h.01" />
              <path d="M16 18h.01" />
            </svg>
          </div>
        )}
        <div className="hero-media-badge">
          <span className={`status-badge status-${statusLower}`}>{statusLabel}</span>
        </div>
      </div>

      <div className="hero-card-body">
        <div className="hero-card-eyebrow">
          <span className="eyebrow-accent" aria-hidden="true">✦</span>
          <span>SỰ KIỆN ĐANG CHỌN</span>
        </div>
        <h2 className="hero-card-title">{event.title}</h2>
        {event.description && <p className="hero-card-desc">{event.description}</p>}

        <div className="hero-meta-row">
          <div className="hero-meta-pill">
            <span className="meta-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </span>
            <div>
              <small>Lịch trình</small>
              <strong>{dateTimeDisplay}</strong>
            </div>
          </div>

          <div className="hero-meta-pill">
            <span className="meta-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </span>
            <div>
              <small>Địa điểm</small>
              <strong>{event.location || "Chưa cập nhật"}</strong>
            </div>
          </div>

          <div className="hero-meta-pill">
            <span className="meta-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            <div>
              <small>Sức chứa tối đa</small>
              <strong>{event.max_attendees ? `${event.max_attendees} người` : "Không giới hạn"}</strong>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function EventSelector({ events = [], selectedEventId, onChange, disabled, showContext = false }) {
  const selectedEvent = events.find((event) => Number(event.id) === Number(selectedEventId));

  return (
    <div className="analytics-event-selector-wrap">
      <div className="selector-field">
        <label htmlFor="dashboard-event-select" className="selector-label">
          <span className="selector-indicator" aria-hidden="true" />
          Sự kiện đang chọn
        </label>
        <div className="selector-select-box">
          <select
            id="dashboard-event-select"
            className="selector-select"
            value={selectedEventId ?? ""}
            onChange={(e) => onChange(Number(e.target.value))}
            disabled={disabled || events.length === 0}
          >
            {events.length === 0 ? (
              <option value="" disabled>Không có sự kiện nào khả dụng.</option>
            ) : (
              events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} — {EVENT_STATUS_LABELS[event.status] || event.status}
                </option>
              ))
            )}
          </select>
          <span className="selector-caret" aria-hidden="true">⌄</span>
        </div>
      </div>
      {showContext && selectedEvent && <SelectedEventCard event={selectedEvent} />}
    </div>
  );
}

export default EventSelector;
