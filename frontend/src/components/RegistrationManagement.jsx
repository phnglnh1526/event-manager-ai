import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getEventRegistrations, getEventStatistics } from "../services/api";
import { REGISTRATION_STATUS_LABELS } from "../locales/vi";

const FILTERS = ["ALL", "REGISTERED", "CANCELLED"];
const ITEMS_PER_PAGE = 8;

const displayTimestamp = (value) => {
  if (typeof value !== "string" || !value) return "—";
  const trimmed = value.slice(0, 16);
  const parts = trimmed.split("T");
  if (parts.length === 2) {
    const [d, t] = parts;
    const sub = d.split("-");
    if (sub.length === 3) return `${sub[2]}/${sub[1]}/${sub[0]} ${t}`;
  }
  return trimmed.replace("T", " ");
};

const formatRate = (value) => Number(value || 0).toFixed(1).replace(/\.0$/, "");

function RegistrationManagement({ event, token, onUnauthorized }) {
  const [registrations, setRegistrations] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [reload, setReload] = useState(0);

  const message = useCallback((error, fallback) => {
    if (error.status === 401) {
      onUnauthorized();
      return "";
    }
    if (error.status === 403) return "Bạn không có quyền xem danh sách đăng ký của sự kiện này.";
    if (error.status === 404) return "Không tìm thấy sự kiện.";
    if (error.status === 0) return "Không thể kết nối đến máy chủ.";
    return fallback;
  }, [onUnauthorized]);

  useEffect(() => {
    const controller = new AbortController();
    setRegistrations([]);
    setStatistics(null);
    setFilter("ALL");
    setSearchQuery("");
    setCurrentPage(1);
    setListError("");
    setSummaryError("");
    setListLoading(true);
    setSummaryLoading(true);

    getEventRegistrations(event.id, token, controller.signal)
      .then(setRegistrations)
      .catch((error) => {
        if (error.name !== "AbortError") setListError(message(error, "Không thể tải danh sách đăng ký."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setListLoading(false);
      });

    getEventStatistics(event.id, token, controller.signal)
      .then(setStatistics)
      .catch((error) => {
        if (error.name !== "AbortError") setSummaryError(message(error, "Không thể tải thông tin tổng hợp đăng ký."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setSummaryLoading(false);
      });

    return () => controller.abort();
  }, [event.id, token, reload, message]);

  // In-memory Filter & Search
  const filtered = useMemo(() => {
    return registrations.filter((item) => {
      if (filter !== "ALL" && item.status !== filter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchUser = String(item.user_id).includes(q);
        const matchId = String(item.id).includes(q);
        if (!matchUser && !matchId) return false;
      }
      return true;
    });
  }, [registrations, filter, searchQuery]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginatedRegistrations = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const registeredCount = statistics?.registrations?.registered ?? 0;
  const totalCount = statistics?.registrations?.total ?? 0;
  const cancelledCount = statistics?.registrations?.cancelled ?? 0;
  const maxAttendees = Math.max(0, Number(statistics?.capacity?.max_attendees) || event.max_attendees || 0);
  const remainingSlots = Math.max(0, maxAttendees - registeredCount);
  const usageRate = maxAttendees > 0 ? (registeredCount / maxAttendees) * 100 : 0;
  const progress = Math.max(0, Math.min(usageRate, 100));

  return (
    <section className="registration-mgmt-root" aria-label="Quản lý danh sách đăng ký">
      {/* Heading */}
      <div className="speaker-mgmt-header">
        <div>
          <p className="hero-eyebrow" style={{ margin: 0 }}>DANH SÁCH ĐĂNG KÝ SỰ KIỆN</p>
          <h3>Quản lý đăng ký</h3>
          <span style={{ fontSize: "0.8rem", color: "var(--primary)" }}>Sự kiện: <strong>{event.title}</strong></span>
        </div>
        <span className="read-only-badge" style={{ background: "var(--surface-muted)", color: "var(--text-muted)", padding: "0.3rem 0.75rem", borderRadius: 9999, fontSize: "0.75rem", fontWeight: 700 }}>
          Chỉ xem
        </span>
      </div>

      {/* Metrics Row */}
      {summaryLoading ? (
        <div className="compact-state"><div className="app-loader" /><p>Đang tải số liệu đăng ký...</p></div>
      ) : summaryError ? (
        <div className="inline-message error-message">{summaryError}</div>
      ) : (
        <div className="capacity-panel" style={{ padding: "1.15rem 1.35rem", marginBottom: 0 }}>
          <div className="capacity-metrics-grid" style={{ marginBottom: "1rem" }}>
            <div className="capacity-metric-item">
              <span className="metric-label">Tổng lượt đăng ký</span>
              <strong className="metric-val">{totalCount}</strong>
            </div>
            <div className="capacity-metric-item">
              <span className="metric-label">Đang hoạt động</span>
              <strong className="metric-val highlight">{registeredCount}</strong>
            </div>
            <div className="capacity-metric-item">
              <span className="metric-label">Đã hủy đăng ký</span>
              <strong className="metric-val" style={{ color: "var(--error)" }}>{cancelledCount}</strong>
            </div>
            <div className="capacity-metric-item">
              <span className="metric-label">Sức chứa tối đa</span>
              <strong className="metric-val">{maxAttendees > 0 ? `${maxAttendees} chỗ` : "Không giới hạn"}</strong>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.4rem" }}>
              <span>Tỷ lệ lấp đầy: <strong>{maxAttendees > 0 ? `${formatRate(usageRate)}%` : "Tự do"}</strong></span>
              <span>Còn <strong>{maxAttendees > 0 ? remainingSlots : "Còn chỗ"}</strong> chỗ trống</span>
            </div>
            <div className="capacity-track" style={{ margin: 0, height: 8 }}>
              <span className="capacity-bar-fill" style={{ width: `${maxAttendees > 0 ? progress : 0}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="reg-search-filter-bar">
        <div className="reg-search-box">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="reg-search-input"
            placeholder="Tìm theo Mã người dùng hoặc Mã đăng ký..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-status-pills" role="tablist">
          {FILTERS.map((value) => {
            const isActive = filter === value;
            const label = value === "ALL" ? "Tất cả" : REGISTRATION_STATUS_LABELS[value] || value;
            return (
              <button
                type="button"
                key={value}
                className={`status-pill-btn ${isActive ? "active" : ""}`}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {listLoading && (
        <div className="compact-state"><div className="app-loader" /><p>Đang tải danh sách đăng ký...</p></div>
      )}

      {listError && (
        <div className="inline-message error-message">
          {listError}
          <button type="button" className="text-button" onClick={() => setReload((v) => v + 1)}>Thử lại</button>
        </div>
      )}

      {!listLoading && !listError && registrations.length === 0 && (
        <div className="compact-state">
          <strong>Chưa có lượt đăng ký nào.</strong>
          <p>Danh sách người tham dự đăng ký sự kiện sẽ hiển thị chi tiết tại đây.</p>
        </div>
      )}

      {!listLoading && !listError && registrations.length > 0 && filtered.length === 0 && (
        <div className="compact-state">
          <strong>Không tìm thấy kết quả phù hợp.</strong>
          <p>Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc.</p>
        </div>
      )}

      {/* Registrations Data Table */}
      {!listLoading && !listError && filtered.length > 0 && (
        <div className="reg-table-container">
          <table className="reg-table">
            <thead>
              <tr>
                <th>Người tham dự</th>
                <th>Mã đăng ký</th>
                <th>Trạng thái</th>
                <th>Ngày đăng ký</th>
                <th>Cập nhật lần cuối</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRegistrations.map((reg) => (
                <tr key={reg.id}>
                  <td>
                    <div className="reg-user-cell">
                      <div className="reg-user-avatar">
                        U{reg.user_id}
                      </div>
                      <div>
                        <strong style={{ color: "var(--text-primary)", display: "block" }}>Người dùng #{reg.user_id}</strong>
                        <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>User ID: {reg.user_id}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--primary)" }}>
                      REG-{reg.id}
                    </span>
                  </td>
                  <td>
                    <span className={`reg-status-badge reg-status-${reg.status.toLowerCase()}`}>
                      {REGISTRATION_STATUS_LABELS[reg.status] || reg.status}
                    </span>
                  </td>
                  <td>{displayTimestamp(reg.created_at)}</td>
                  <td>{displayTimestamp(reg.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="reg-pagination">
              <span>
                Trang <strong>{currentPage}</strong> / {totalPages} (Tổng số {filtered.length} lượt)
              </span>
              <div className="reg-page-buttons">
                <button
                  type="button"
                  className="reg-page-btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  ← Trước
                </button>
                <button
                  type="button"
                  className="reg-page-btn"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Sau →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default RegistrationManagement;
