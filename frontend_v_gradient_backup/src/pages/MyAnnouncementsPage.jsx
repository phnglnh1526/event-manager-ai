import React, { useCallback, useEffect, useRef, useState } from "react";

import { getMyAnnouncement, getMyAnnouncements } from "../services/api";

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
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
    setter(requestError.status === 404 ? "Announcement not found." : fallback);
  }, [onUnauthorized]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    getMyAnnouncements(token, controller.signal)
      .then(setAnnouncements)
      .catch((requestError) => { if (requestError.name !== "AbortError") handleError(requestError, setError, "Unable to load announcements."); })
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
      if (detailSequence.current === sequence) handleError(requestError, setDetailError, "Unable to load announcement.");
    } finally {
      if (detailSequence.current === sequence) setDetailLoading(false);
    }
  };

  return (
    <div className={`dashboard-shell attendee-shell ${embedded ? "attendee-embedded" : ""}`}>
      <header className="dashboard-header"><div className="header-brand"><div className="brand-mark compact" aria-hidden="true"><span /><span /><span /></div><div><strong>EVENT MANAGER AI</strong><span>Attendee workspace</span></div></div><div className="user-actions"><div className="user-copy"><strong>{currentUser.full_name}</strong><span className="role-badge">ATTENDEE</span></div><button type="button" className="secondary-button" onClick={onLogout}>Logout</button></div></header>
      <main className="dashboard-main attendee-main"><section className="dashboard-title-row"><div><p className="eyebrow">EVENT UPDATES</p><h1>My Announcements</h1><p>Published updates for events you are currently registered to attend.</p></div></section>
        {loading && <div className="state-panel"><div className="app-loader" /><p>Loading announcements...</p></div>}
        {error && <div className="state-panel error-panel"><strong>Unable to load announcements</strong><p>{error}</p></div>}
        {!loading && !error && announcements.length === 0 && <div className="state-panel"><strong>No announcements available.</strong><p>Published event updates will appear here.</p></div>}
        {!loading && !error && announcements.length > 0 && <div className={`attendee-announcement-layout ${selected || detailLoading || detailError ? "detail-open" : ""}`}><section className="attendee-announcement-list" aria-label="Published announcements">{announcements.map((item) => <button type="button" className={`attendee-announcement-card ${selected?.id === item.id ? "selected" : ""}`} key={item.id} onClick={() => openDetail(item.id)}><span className="status-badge status-published">PUBLISHED</span><h2>{item.title}</h2><p>{item.content}</p><span>Published {formatDate(item.published_at)}</span></button>)}</section>{(selected || detailLoading || detailError) && <aside className="announcement-detail">{detailLoading ? <div className="compact-state"><div className="app-loader" /><span>Loading announcement...</span></div> : selected ? <><div className="editor-heading"><div><p className="eyebrow">EVENT #{selected.event_id}</p><span className="status-badge status-published">PUBLISHED</span></div><button type="button" className="text-button" onClick={() => setSelected(null)}>Close</button></div><h2>{selected.title}</h2><p className="detail-date">Published {formatDate(selected.published_at)}</p><div className="announcement-full-content">{selected.content}</div></> : null}{detailError && <div className="inline-message error-message">{detailError}</div>}</aside>}</div>}
      </main>
      <footer>Event Manager AI · Published announcements for your registered events.</footer>
    </div>
  );
}

export default MyAnnouncementsPage;
