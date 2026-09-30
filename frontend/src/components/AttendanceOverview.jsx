import React from "react";

function AttendanceOverview({ attendance }) {
  const rate = Math.max(0, Math.min(Number(attendance?.attendance_rate) || 0, 100));
  const checkedIn = Math.max(0, Number(attendance?.checked_in) || 0);
  const notCheckedIn = Math.max(0, Number(attendance?.not_checked_in) || 0);
  const totalRegistered = checkedIn + notCheckedIn;
  const formattedRate = Number(rate.toFixed(1)).toString().replace(/\.0$/, "");

  return (
    <article className="panel-card attendance-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">THAM DỰ</p>
          <h3>Tổng quan tham dự</h3>
        </div>
        <span className="panel-badge-pill">Theo thời gian thực</span>
      </div>

      <div className="attendance-visual">
        <div
          className="attendance-donut"
          role="img"
          aria-label={`Tỷ lệ tham dự ${rate}%: ${checkedIn} trên ${totalRegistered} người đăng ký đã check-in`}
        >
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <defs>
              <linearGradient id="attendanceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ec4899" />
                <stop offset="50%" stopColor="#d946ef" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
            <circle className="donut-background" cx="60" cy="60" r="48" pathLength="100" />
            <circle
              className="donut-value"
              cx="60"
              cy="60"
              r="48"
              pathLength="100"
              stroke="url(#attendanceGradient)"
              strokeDasharray={`${rate} ${100 - rate}`}
              strokeDashoffset="25"
            />
          </svg>
          <div className="donut-center-info">
            <strong className="donut-percentage">{formattedRate}%</strong>
            <span className="donut-label">tham dự</span>
          </div>
        </div>

        <div className="attendance-stats">
          <div className="stat-pill stat-checked">
            <div className="stat-pill-label">
              <span className="legend-swatch checked" aria-hidden="true" />
              <p>Đã check-in</p>
            </div>
            <strong>{checkedIn}</strong>
          </div>
          <div className="stat-pill stat-pending">
            <div className="stat-pill-label">
              <span className="legend-swatch pending" aria-hidden="true" />
              <p>Chưa check-in</p>
            </div>
            <strong>{notCheckedIn}</strong>
          </div>
          <div className="stat-pill stat-total">
            <div className="stat-pill-label">
              <span className="legend-swatch total" aria-hidden="true" />
              <p>Tổng đăng ký</p>
            </div>
            <strong>{totalRegistered}</strong>
          </div>
        </div>
      </div>
    </article>
  );
}

export default AttendanceOverview;
