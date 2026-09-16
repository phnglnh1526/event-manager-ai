import React, { useCallback, useEffect, useRef, useState } from "react";

import { getMyAnnouncement, getMyAnnouncements } from "../services/api";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatDate = (value) =>
  value ? dateFormatter.format(new Date(value)) : "—";

const eventStatusLabel = (registrationStatus, eventStatus) => {
  if (registrationStatus === "CHECKED_IN") return "✓ Đã check-in";
  if (eventStatus === "PUBLISHED") return "PUBLISHED";
  if (eventStatus === "CANCELLED") return "CANCELLED";
  if (eventStatus === "COMPLETED") return "COMPLETED";
  return eventStatus || "UNKNOWN";
};

const eventStatusClass = (registrationStatus, eventStatus) => {
  if (registrationStatus === "CHECKED_IN") return "status-checked_in";
  if (eventStatus === "CANCELLED") return "status-cancelled";
  if (eventStatus === "COMPLETED") return "status-completed";
  return "status-published";
};

function MyAnnouncementsPage({
  token,
  currentUser,
  onLogout,
  onUnauthorized,
  embedded = false,
}) {
  const [announcements, setAnnouncements] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");

  const detailSequence = useRef(0);

  const handleError = useCallback(
    (requestError, setter, fallback) => {
      if (requestError.status === 401) {
        onUnauthorized();
        return;
      }

      setter(
        requestError.status === 404
          ? "Announcement not found."
          : requestError.message || fallback
      );
    },
    [onUnauthorized]
  );

  // Load announcements
  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");

    getMyAnnouncements(token, controller.signal)
      .then(setAnnouncements)
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          handleError(
            requestError,
            setError,
            "Unable to load announcements."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [token, handleError]);

  // Load announcement detail
  const openDetail = useCallback(
    (announcementId) => {
      const sequence = ++detailSequence.current;
      const controller = new AbortController();

      setDetailLoading(true);
      setDetailError("");
      setSelected(null);

      getMyAnnouncement(
        announcementId,
        token,
        controller.signal
      )
        .then((data) => {
          if (sequence === detailSequence.current) {
            setSelected(data);
          }
        })
        .catch((requestError) => {
          if (
            requestError.name !== "AbortError" &&
            sequence === detailSequence.current
          ) {
            handleError(
              requestError,
              setDetailError,
              "Unable to load announcement."
            );
          }
        })
        .finally(() => {
          if (
            !controller.signal.aborted &&
            sequence === detailSequence.current
          ) {
            setDetailLoading(false);
          }
        });
    },
    [token, handleError]
  );

  const announcementContent = (
    <>
      <section className="attendee-section-header">
        <div>
          <p className="attendee-eyebrow">ENGAGEMENT</p>
          <h1>Announcements</h1>
          <p>
            Stay informed about the events connected to your attendee journey.
          </p>
        </div>
      </section>

      {loading && (
        <div className="attendee-panel attendee-page-loader">
          <div className="attendee-spinner" />
          <p>Loading announcements...</p>
        </div>
      )}

      {error && (
        <div className="state-panel error-panel">
          <strong>Unable to load announcements</strong>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && announcements.length === 0 && (
        <div className="attendee-panel attendee-empty">
          <h3>No announcements available.</h3>
          <p>Published event updates will appear here.</p>
        </div>
      )}

      {!loading && !error && announcements.length > 0 && (
        <div
          className={`announcement-layout ${
            selected || detailLoading || detailError ? "detail-open" : ""
          }`}
        >
          <section
            className="attendee-panel announcement-list-panel"
            aria-label="Published announcements"
          >
            {announcements.map((item) => (
              <button
                type="button"
                className={`announcement-item ${
                  selected?.id === item.id ? "active" : ""
                }`}
                key={item.id}
                onClick={() => openDetail(item.id)}
              >
                <span className="announcement-icon">♧</span>

                <span className="announcement-copy">
                  <span className="announcement-status">
                    <span
                      className={`attendee-pill ${
                        eventStatusClass(
                          item.registration_status,
                          item.event_status
                        ).includes("cancelled")
                          ? "attendee-pill-cancelled"
                          : item.registration_status === "CHECKED_IN"
                          ? "attendee-pill-checked_in"
                          : "attendee-pill-published"
                      }`}
                    >
                      {eventStatusLabel(
                        item.registration_status,
                        item.event_status
                      )}
                    </span>
                  </span>

                  <strong>
                    {item.event_title || `Event #${item.event_id}`}
                  </strong>

                  <small>
                    {item.title} · Published {formatDate(item.published_at)}
                  </small>

                  <p>{item.content}</p>
                </span>

                <span aria-hidden="true">›</span>
              </button>
            ))}
          </section>

          {(selected || detailLoading || detailError) && (
            <aside className="attendee-panel announcement-detail-panel">
              {detailLoading && (
                <div className="compact-state">
                  <div className="app-loader" />
                  <span>Loading announcement...</span>
                </div>
              )}

              {selected && (
                <>
                  <button
                    type="button"
                    className="announcement-close"
                    onClick={() => {
                      setSelected(null);
                      setDetailError("");
                    }}
                    aria-label="Close"
                  >
                    ×
                  </button>

                  <p className="attendee-eyebrow">
                    {selected.event_title || `Event #${selected.event_id}`}
                  </p>

                  <div className="announcement-status-row">
                    <span
                      className={`attendee-pill ${
                        selected.registration_status === "CHECKED_IN"
                          ? "attendee-pill-checked_in"
                          : selected.event_status === "CANCELLED"
                          ? "attendee-pill-cancelled"
                          : selected.event_status === "COMPLETED"
                          ? "attendee-pill-completed"
                          : "attendee-pill-published"
                      }`}
                    >
                      {eventStatusLabel(
                        selected.registration_status,
                        selected.event_status
                      )}
                    </span>

                    <span
                      className={`attendee-pill ${
                        selected.event_status === "CANCELLED"
                          ? "attendee-pill-cancelled"
                          : selected.event_status === "COMPLETED"
                          ? "attendee-pill-completed"
                          : "attendee-pill-published"
                      }`}
                    >
                      EVENT: {selected.event_status}
                    </span>
                  </div>

                  <h2>{selected.title}</h2>

                  <small>
                    Published {formatDate(selected.published_at)}
                  </small>

                  <div className="announcement-detail-content">
                    {selected.content}
                  </div>
                </>
              )}

              {detailError && (
                <div
                  className="inline-message error-message"
                  role="alert"
                >
                  {detailError}
                </div>
              )}
            </aside>
          )}
        </div>
      )}
    </>
  );

  if (embedded) {
    return announcementContent;
  }

  return (
    <div className="dashboard-shell attendee-shell">
      <header className="dashboard-header">
        <div className="header-brand">
          <div
            className="brand-mark compact"
            aria-hidden="true"
          >
            <span />
            <span />
            <span />
          </div>

          <div>
            <strong>EVENT MANAGER AI</strong>
            <span>Attendee workspace</span>
          </div>
        </div>

        <div className="user-actions">
          <div className="user-copy">
            <strong>{currentUser.full_name}</strong>
            <span className="role-badge">ATTENDEE</span>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-main attendee-main">
        {announcementContent}
      </main>

      <footer>
        Event Manager AI · Published announcements for your registered events.
      </footer>
    </div>
  );
}

export default MyAnnouncementsPage;