import React from "react";

function AttendanceOverview({ attendance }) {
  const rate = Math.max(0, Math.min(Number(attendance.attendance_rate) || 0, 100));
  const checkedIn = Math.max(0, Number(attendance.checked_in) || 0);
  const notCheckedIn = Math.max(0, Number(attendance.not_checked_in) || 0);
  const totalRegistered = checkedIn + notCheckedIn;

  return (
    <article className="panel-card attendance-panel">
      <div className="panel-heading"><div><p className="eyebrow">PARTICIPATION</p><h3>Attendance overview</h3></div></div>
      <div className="attendance-visual">
        <div className="attendance-donut" role="img" aria-label={`${rate}% attendance rate: ${checkedIn} of ${totalRegistered} registered attendees checked in`}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="donut-background" cx="60" cy="60" r="48" pathLength="100" />
            <circle className="donut-value" cx="60" cy="60" r="48" pathLength="100" strokeDasharray={`${rate} ${100 - rate}`} />
          </svg>
          <div><strong>{rate}%</strong><span>attendance</span></div>
        </div>
        <div className="attendance-stats">
          <div><span className="legend-swatch checked" /><p>Checked in</p><strong>{checkedIn}</strong></div>
          <div><span className="legend-swatch pending" /><p>Not checked in</p><strong>{notCheckedIn}</strong></div>
          <div className="attendance-total"><p>Total registered</p><strong>{totalRegistered}</strong></div>
        </div>
      </div>
    </article>
  );
}

export default AttendanceOverview;
