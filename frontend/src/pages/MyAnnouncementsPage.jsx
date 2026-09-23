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

  return (
    <div className={`dashboard-shell attendee-shell ${embedded ? "attendee-embedded" : ""}`}>
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
          <button type="button" className="secondary-button" onClick={onLogout}>Đăng xuất</button>
        </div>
      </header>
      <main className="dashboard-main attendee-main">
        <section className="dashboard-title-row">
          <div>
            <p className="eyebrow">CẬP NHẬT TỪ SỰ KIỆN</p>
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
          <div className={`attendee-announcement-layout ${selected || detailLoading || detailError ? "detail-open" : ""}`}>
            <section className="attendee-announcement-list" aria-label="Danh sách thông báo">
              {announcements.map((item) => (
                <button type="button" className={`attendee-announcement-card ${selected?.id === item.id ? "selected" : ""}`} key={item.id} onClick={() => openDetail(item.id)}>
                  <span className="status-badge status-published">ĐÃ ĐĂNG</span>
                  <h2>{item.title}</h2>
                  <p>{item.content}</p>
                  <span>Đã đăng {formatDate(item.published_at)}</span>
                </button>
              ))}
            </section>
            {(selected || detailLoading || detailError) && (
              <aside className="announcement-detail">
                {detailLoading ? (
                  <div className="compact-state"><div className="app-loader" /><span>Đang tải thông báo...</span></div>
                ) : selected ? (
                  <>
                    <div className="editor-heading">
                      <div>
                        <p className="eyebrow">SỰ KIỆN #{selected.event_id}</p>
                        <span className="status-badge status-published">ĐÃ ĐĂNG</span>
                      </div>
                      <button type="button" className="text-button" onClick={() => setSelected(null)}>Đóng</button>
                    </div>
                    <h2>{selected.title}</h2>
                    <p className="detail-date">Đã đăng {formatDate(selected.published_at)}</p>
                    <div className="announcement-full-content">{selected.content}</div>
                  </>
                ) : null}
                {detailError && <div className="inline-message error-message">{detailError}</div>}
              </aside>
            )}
          </div>
        )}
      </main>
      <footer>Event Manager AI · Các thông báo đã công bố cho sự kiện bạn đăng ký.</footer>
    </div>
  );
}

export default MyAnnouncementsPage;
