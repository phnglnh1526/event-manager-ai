import React from "react";

const icons = {
  registrations: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </svg>
  ),
  checkIn: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11a9 9 0 1 1-4.3-7.7" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  ),
  attendance: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  rating: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
};

function KpiCard({ label, value, detail, tone = "accent", icon = "registrations" }) {
  return (
    <article className={`analytics-kpi-card tone-${tone}`}>
      <div className="kpi-card-top">
        <span className="kpi-icon-wrapper" aria-hidden="true">
          {icons[icon] || icons.registrations}
        </span>
        <span className="kpi-title">{label}</span>
      </div>
      <div className="kpi-value-row">
        <strong className="kpi-metric-value">{value}</strong>
      </div>
      <p className="kpi-metric-detail">{detail}</p>
      <div className="kpi-card-glow-bar" aria-hidden="true" />
    </article>
  );
}

export default KpiCard;
