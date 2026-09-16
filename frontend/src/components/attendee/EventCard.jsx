import React from "react";

/**
 * Attendee-only presentational event card.
 * Reused on the Dashboard (upcoming / recommended) and Discover Events grid.
 * Receives already-fetched event data only — no API calls, no new fields invented.
 */
const two = (n) => String(n).padStart(2, "0");

function dateParts(value) {
  if (typeof value !== "string" || value.length < 10) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return { day: two(date.getDate()), month: months[date.getMonth()] };
}

function timeRange(start, end) {
  const time = (value) => (typeof value === "string" && value.length >= 16 ? value.slice(11, 16) : "");
  const range = [time(start), time(end)].filter(Boolean).join(" – ");
  return range || "—";
}

function EventCard({ event, compact = false, selected = false, statusBadge, onOpenDetail, actions }) {
  const parts = dateParts(event.start_time);
  return (
    <article className={`ea-card ${compact ? "ea-card--compact" : ""} ${selected ? "is-selected" : ""}`}>
      <button
        type="button"
        className="ea-card-date"
        onClick={() => onOpenDetail?.(event)}
        aria-label={`Xem chi tiết ${event.title}`}
      >
        <strong>{parts?.day ?? "--"}</strong>
        <span>{parts?.month ?? ""}</span>
      </button>
      <div className="ea-card-body">
        <div className="ea-card-heading">
          <button type="button" className="ea-card-title" onClick={() => onOpenDetail?.(event)}>
            {event.title}
          </button>
          {statusBadge}
        </div>
        {!compact && <p className="ea-card-desc">{event.description || "No description provided."}</p>}
        <div className="ea-card-meta">
          <span><i aria-hidden="true">📍</i>{event.location || "TBA"}</span>
          <span><i aria-hidden="true">🕐</i>{timeRange(event.start_time, event.end_time)}</span>
          {event.max_attendees != null && <span><i aria-hidden="true">👥</i>{event.max_attendees}</span>}
        </div>
      </div>
      {actions && <div className="ea-card-actions">{actions}</div>}
    </article>
  );
}

export default EventCard;
export { dateParts, timeRange };
