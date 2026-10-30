import React, { useCallback, useEffect, useRef, useState } from "react";

import { getMyAnnouncement, getMyAnnouncements } from "../services/api";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" });
const formatDate = (value) => value ? dateFormatter.format(new Date(value)) : "—";

function MyAnnouncementsPage({ token, currentUser, onLogout, onUnauthorized, embedded = false }) {
  const [announcements, setAnnouncements] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const detailSequence = useRef(0);

  const handleError = useCallback((requestError, setter, fallback) => {
    if (requestError.status === 401) { onUnauthorized(); return; }
    setter(requestError.status === 404 ? "Không tìm thấy thông báo." : fallback);
  }, [onUnauthorized]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    getMyAnnouncements(token, controller.signal)
      .then(setAnnouncements)
      .catch((requestError) => { if (requestError.name !== "AbortError") handleError(requestError, setError, "Không thể tải danh sách thông báo."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, handleError]);

  const openDetail = async (announcementId) => {
    const sequence = detailSequence.current + 1;
    detailSequence.current = sequence;
    setDetailLoading(true); setDetailError("");
    try {
      const detail = await getMyAnnouncement(announcementId, token);
      if (detailSequence.current === sequence) setSelected(detail);
    } catch (requestError) {
      if (detailSequence.current === sequence) handleError(requestError, setDetailError, "Không thể tải thông tin thông báo.");
    } finally {
      if (detailSequence.current === sequence) setDetailLoading(false);
    }
  };

  const mainContent = (
    <>
      <section className="attendee-page-header">
        <div className="attendee-page-header-content">
          <span className="eyebrow">CẬP NHẬT TỪ SỰ KIỆN</span>
          <h1>Thông báo của tôi</h1>
          <p>Các cập nhật đã công bố cho những sự kiện bạn đã đăng ký tham gia.</p>
        </div>
      </section>

      {loading && <div className="state-panel"><div className="app-loader" /><p>Đang tải thông báo...</p></div>}
      {error && <div className="state-panel error-panel"><strong>Không thể tải thông báo</strong><p>{error}</p></div>}
      {!loading && !error && announcements.length === 0 && (
        <div className="state-panel">
          <strong>Chưa có thông báo nào.</strong>
          <p>Các thông báo từ sự kiện bạn tham gia sẽ hiển thị tại đây.</p>
        </div>
      )}
      {!loading && !error && announcements.length > 0 && (
        <div className="attendee-announcement-layout">
          <section className="attendee-announcement-list" aria-label="Danh sách thông báo">
            {announcements.map((item) => (
              <button
                type="button"
                className={`attendee-announcement-card ${selected?.id === item.id ? "selected" : ""}`}
                key={item.id}
                onClick={() => openDetail(item.id)}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                  <span className="status-badge status-published">ĐÃ ĐĂNG</span>
                  <span>{formatDate(item.published_at)}</span>
                </div>
                <h2>{item.title}</h2>
                <p>{item.content}</p>
              </button>
            ))}
          </section>

          <aside className="announcement-detail-card">
            {detailLoading ? (
              <div className="compact-state"><div className="app-loader" /><span>Đang tải thông báo...</span></div>
            ) : selected ? (
              <>
                <div className="editor-heading" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="eyebrow" style={{ margin: 0 }}>SỰ KIỆN #{selected.event_id}</span>
                    <span className="status-badge status-published">ĐÃ ĐĂNG</span>
                  </div>
                  <button type="button" className="secondary-button compact-button" onClick={() => setSelected(null)}>Đóng</button>
                </div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 750, color: "var(--text-primary)", margin: "4px 0" }}>{selected.title}</h2>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>Đã đăng vào: {formatDate(selected.published_at)}</p>
                <div className="announcement-full-content" style={{ fontSize: "0.9rem", lineHeight: "1.6", color: "var(--text-body, #34252A)", whiteSpace: "pre-wrap", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
                  {selected.content}
                </div>
              </>
            ) : (
              <div className="announcement-empty-selection">
                <span style={{ fontSize: "2rem" }}>📩</span>
                <strong>Chọn một thông báo</strong>
                <p style={{ margin: 0, fontSize: "0.84rem" }}>Bấm vào bất kỳ thông báo nào ở danh sách bên trái để đọc nội dung chi tiết.</p>
              </div>
            )}
            {detailError && <div className="inline-message error-message">{detailError}</div>}
          </aside>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <main className="dashboard-main attendee-portal-main">{mainContent}</main>;
  }

  return (
    <div className="dashboard-shell attendee-shell">
      <header className="dashboard-header">
        <div className="header-brand">
          <div className="brand-mark compact" aria-hidden="true"><span /><span /><span /></div>
          <div><strong>EVENT MANAGER AI</strong><span>Không gian người tham dự</span></div>
        </div>
        <div className="user-actions">
          <div className="user-copy">
            <strong>{currentUser.full_name}</strong>
            <span className="role-badge">NGƯỜI THAM DỰ</span>
          </div>
          <button type="button" className="secondary-button compact-button" onClick={onLogout}>Đăng xuất</button>
        </div>
      </header>
      <main className="dashboard-main attendee-portal-main">
        {mainContent}
      </main>
      <footer>Event Manager AI · Các thông báo đã công bố cho sự kiện bạn đăng ký.</footer>
    </div>
  );
}

export default MyAnnouncementsPage;
