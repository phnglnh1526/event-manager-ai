import React from "react";

function KpiCard({ label, value, detail, tone = "accent" }) {
  return (
    <article className={`kpi-card tone-${tone}`}>
      <div className="kpi-label"><span className="kpi-dot" />{label}</div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

export default KpiCard;
