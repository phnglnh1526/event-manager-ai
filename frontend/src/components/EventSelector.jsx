import React from "react";

function EventSelector({ events, selectedEventId, onChange, disabled }) {
  return (
    <div className="event-selector">
      <label htmlFor="event-select">Selected event</label>
      <select id="event-select" value={selectedEventId} onChange={(e) => onChange(Number(e.target.value))} disabled={disabled || events.length === 0}>
        {events.map((event) => <option key={event.id} value={event.id}>{event.title} — {event.status}</option>)}
      </select>
    </div>
  );
}

export default EventSelector;
