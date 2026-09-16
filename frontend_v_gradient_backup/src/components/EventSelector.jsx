import React from "react";

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
    return startClock && endClock ? `${startDate} · ${startClock}–${endClock}` : `${startDate} · ${startClock || endClock}`;
  }

  const startPart = startClock ? `${startDate} ${startClock}` : startDate;
  const endPart = endClock ? `${endDate} ${endClock}` : endDate;
  return `${startPart} – ${endPart}`;
}

export function SelectedEventCard({ event }) {
  if (!event) return null;
  const status = typeof event.status === "string" ? event.status : "DRAFT";
  const statusLower = status.toLowerCase();
  const dateTimeDisplay = formatEventDateTime(event.start_time, event.end_time);

  return (
    <article className="selected-event-card selected-event-line" aria-label="Selected event details">
      <div className="selected-event-card-main">
        <div className="selected-event-card-header">
          <span className="selected-event-context-eyebrow">SELECTED EVENT</span>
          <span className={`status-badge status-${statusLower}`}>{status}</span>
        </div>
        <h2 className="selected-event-card-title">{event.title}</h2>
        <div className="selected-event-card-meta">
          <div className="selected-event-meta-item">
            <span className="meta-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </span>
            <span className="meta-value">{dateTimeDisplay}</span>
          </div>
          {event.location ? (
            <div className="selected-event-meta-item">
              <span className="meta-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <span className="meta-value">{event.location}</span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="selected-event-card-visual" aria-hidden="true">
        <div className="event-visual-icon">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
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
      </div>
    </article>
  );
}

function EventSelector({ events = [], selectedEventId, onChange, disabled, showContext = false }) {
  const selectedEvent = events.find((event) => Number(event.id) === Number(selectedEventId));

  return (
    <div className="event-selector-wrap">
      <div className="event-selector">
        <label htmlFor="event-select">Selected event</label>
        <select
          id="event-select"
          value={selectedEventId ?? ""}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled || events.length === 0}
        >
          {events.length === 0 ? (
            <option value="" disabled>No events available.</option>
          ) : (
            events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} — {event.status}
              </option>
            ))
          )}
        </select>
      </div>
      {showContext && selectedEvent && <SelectedEventCard event={selectedEvent} />}
    </div>
  );
}

export default EventSelector;
