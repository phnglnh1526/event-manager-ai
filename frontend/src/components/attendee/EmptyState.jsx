import React from "react";

/**
 * Attendee-only presentational empty/zero-data state.
 * Used across Dashboard, Discover Events, My Tickets, Announcements, etc.
 * Purely visual — no data fetching, no side effects.
 */
function EmptyState({ icon = "info", title, description, actionLabel, onAction }) {
  return (
    <div className="ea-empty-state" role="status">
      <span className="ea-empty-icon" aria-hidden="true">{ICONS[icon] || ICONS.info}</span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {actionLabel && onAction && (
        <button type="button" className="primary-button" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}

const ICONS = {
  info: "＊",
  calendar: "▦",
  ticket: "▭",
  bell: "◔",
  star: "☆",
};

export default EmptyState;
