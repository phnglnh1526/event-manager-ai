import React from "react";

const icons = {
  registrations: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
  checkIn: <><path d="M20 11a9 9 0 1 1-4.3-7.7" /><path d="m9 11 3 3L22 4" /></>,
  attendance: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  rating: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
};

function KpiCard({ label, value, detail, tone = "accent", icon = "registrations" }) {
  return (
    <article className={`kpi-card tone-${tone}`}>
      <div className="kpi-card-heading">
        <span className="kpi-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">{icons[icon]}</svg>
        </span>
        <span className="kpi-label">{label}</span>
      </div>
      <strong className="kpi-value">{value}</strong>
      <p className="kpi-detail">{detail}</p>
      <span className="kpi-accent-line" aria-hidden="true" />
    </article>
  );
}

export default KpiCard;
