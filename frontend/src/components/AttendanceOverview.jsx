import React from "react";

function AttendanceOverview({ attendance }) {
  const rate = Math.max(0, Math.min(Number(attendance.attendance_rate) || 0, 100));
  return (
    <article className="panel-card">
      <div className="panel-heading"><div><p className="eyebrow">PARTICIPATION</p><h3>Attendance overview</h3></div><strong className="panel-rate">{rate}%</strong></div>
      <div className="attendance-track" aria-label={`${rate}% attendance rate`}><span style={{ width: `${rate}%` }} /></div>
      <div className="legend-grid">
        <div><span className="legend-swatch checked" /><p>Checked in</p><strong>{attendance.checked_in}</strong></div>
        <div><span className="legend-swatch pending" /><p>Not checked in</p><strong>{attendance.not_checked_in}</strong></div>
      </div>
    </article>
  );
}

export default AttendanceOverview;
