import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AttendeeEventDetailModal from "../components/AttendeeEventDetailModal";
import EventAIChat from "../components/EventAIChat";
import EventCoverImage from "../components/EventCoverImage";
import MyFeedback from "../components/MyFeedback";
import MyTickets from "../components/MyTickets";
import WorkspaceHeader from "../components/WorkspaceHeader";
import {
  cancelMyRegistration,
  getAttendeeEvents,
  getMyRegistrations,
  registerForEvent,
} from "../services/api";
import MyAnnouncementsPage from "./MyAnnouncementsPage";

const display = (value) => {
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

const formatDateOnly = (value) => {
  if (typeof value !== "string" || !value) return "—";
  const parts = value.split("T");
  const sub = parts[0].split("-");
  if (sub.length === 3) return `${sub[2]}/${sub[1]}/${sub[0]}`;
  return parts[0];
};

const formatTimeOnly = (value) => {
  if (typeof value !== "string" || !value) return "";
  const parts = value.split("T");
  return parts.length === 2 ? parts[1].slice(0, 5) : "";
};

const registrationStatusLabel = (registration, issue = "") => {
  if (issue === "already-registered" || registration?.status === "REGISTERED") return "Đã đăng ký";
  if (registration?.status === "CANCELLED") return "Đã hủy";
  return "Chưa đăng ký";
};

const mapRegistrationError = (requestError) => {
  const detail = String(requestError?.message || "").toLowerCase();
  if (requestError?.status === 401) return { issue: "unauthorized", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };
  if (requestError?.status === 403) return { issue: "forbidden", message: "Bạn không có quyền đăng ký sự kiện này." };
  if (requestError?.status === 404) return { issue: "unavailable", message: "Sự kiện không tồn tại hoặc không còn khả dụng." };
  if (requestError?.status === 409 && detail.includes("already registered")) return { issue: "already-registered", message: "Bạn đã đăng ký sự kiện này." };
  if (requestError?.status === 409 && detail.includes("full")) return { issue: "full", message: "Sự kiện đã đủ số lượng người tham dự." };
  if (requestError?.status === 409 && detail.includes("not open")) return { issue: "unavailable", message: "Sự kiện hiện không mở đăng ký." };
  if (requestError?.status === 409) return { issue: "unavailable", message: "Không thể đăng ký do trạng thái sự kiện đã thay đổi." };
  if (requestError?.status === 422) return { issue: "invalid", message: "Yêu cầu đăng ký không hợp lệ. Vui lòng kiểm tra và thử lại." };
  if (requestError?.status >= 500) return { issue: "system", message: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau." };
  if (requestError?.status === 0) return { issue: "network", message: "Không thể kết nối tới máy chủ. Vui lòng thử lại." };
  return { issue: "error", message: "Không thể hoàn tất đăng ký. Vui lòng thử lại." };
};

const mapCancellationError = (requestError) => {
  const detail = String(requestError?.message || "").toLowerCase();
  if (requestError?.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (requestError?.status === 403) return "Bạn không có quyền hủy đăng ký này.";
  if (requestError?.status === 404) return "Không tìm thấy đăng ký đang hoạt động cho sự kiện này.";
  if (requestError?.status === 409 && detail.includes("checked-in")) return "Không thể hủy đăng ký sau khi bạn đã check-in.";
  if (requestError?.status === 422) return "Yêu cầu hủy đăng ký không hợp lệ.";
  if (requestError?.status >= 500) return "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.";
  if (requestError?.status === 0) return "Không thể kết nối tới máy chủ. Vui lòng thử lại.";
  return "Không thể hủy đăng ký. Vui lòng thử lại.";
};

function RegistrationActionDialog({ mode, event, registration, busy, error, issue, returnFocus, onClose, onConfirm }) {
  const dialogRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const confirmButtonRef = useRef(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;
  const isRegistration = mode === "register";
  const effectiveStatus = issue === "already-registered" ? "REGISTERED" : registration?.status;
  const blockingIssue = ["already-registered", "full", "unavailable", "forbidden"].includes(issue);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (isRegistration ? confirmButtonRef : cancelButtonRef).current?.focus();

    const handleKeyDown = (keyboardEvent) => {
      if (keyboardEvent.key === "Escape") {
        keyboardEvent.preventDefault();
        if (!busyRef.current) closeRef.current();
        return;
      }
      if (keyboardEvent.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) {
        keyboardEvent.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (keyboardEvent.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        keyboardEvent.preventDefault();
        last.focus();
      } else if (!keyboardEvent.shiftKey && document.activeElement === last) {
        keyboardEvent.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => {
        if (returnFocus?.isConnected) returnFocus.focus();
      });
    };
  }, [isRegistration, returnFocus]);

  const statusClass = effectiveStatus ? `status-${effectiveStatus.toLowerCase()}` : "status-unregistered";
  const descriptionId = error ? "registration-confirm-description registration-confirm-error" : "registration-confirm-description";

  return (
    <div className="registration-dialog-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <section
        ref={dialogRef}
        className={`registration-confirm-dialog ${issue ? `state-${issue}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="registration-confirm-title"
        aria-describedby={descriptionId}
        aria-busy={busy}
        tabIndex={-1}
      >
        <header className="registration-dialog-header">
          <div>
            <p className="eyebrow">{isRegistration ? "XÁC NHẬN ĐĂNG KÝ" : "CẬP NHẬT ĐĂNG KÝ"}</p>
            <h2 id="registration-confirm-title">{isRegistration ? "Xác nhận đăng ký" : "Xác nhận hủy đăng ký"}</h2>
          </div>
          <button type="button" className="registration-dialog-close" onClick={onClose} disabled={busy} aria-label="Đóng hộp thoại">×</button>
        </header>
        <p id="registration-confirm-description" className="registration-dialog-intro">
          {isRegistration ? "Vui lòng kiểm tra thông tin sự kiện trước khi xác nhận." : "Vé của bạn sẽ không còn hiệu lực sau khi hủy đăng ký."}
        </p>
        <dl className="registration-confirm-details">
          <div><dt>Sự kiện</dt><dd>{event.title}</dd></div>
          <div><dt>Ngày giờ</dt><dd>{display(event.start_time)} – {display(event.end_time)}</dd></div>
          <div><dt>Địa điểm</dt><dd>{event.location || "Chưa cập nhật"}</dd></div>
          {event.max_attendees != null && <div><dt>Sức chứa</dt><dd>{event.max_attendees} người</dd></div>}
          <div><dt>Trạng thái đăng ký</dt><dd><span className={`registration-status ${statusClass}`}>{registrationStatusLabel(registration, issue)}</span></dd></div>
        </dl>
        {error && <div id="registration-confirm-error" className="inline-message error-message registration-dialog-error" role="alert">{error}</div>}
        <div className="registration-confirm-actions">
          <button ref={cancelButtonRef} type="button" className="secondary-button" onClick={onClose} disabled={busy}>Hủy</button>
          <button
            ref={confirmButtonRef}
            type="button"
            className={isRegistration ? "primary-button" : "danger-button"}
            onClick={onConfirm}
            disabled={busy || (isRegistration && (blockingIssue || effectiveStatus === "REGISTERED"))}
          >
            {busy ? (isRegistration ? "Đang đăng ký..." : "Đang hủy...") : (isRegistration ? "Xác nhận đăng ký" : "Xác nhận hủy đăng ký")}
          </button>
        </div>
      </section>
    </div>
  );
}

function AttendeeWorkspace({ token, currentUser, onLogout, onUnauthorized, onProfile }) {
  const [view, setView] = useState("events");
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [registrationsLoading, setRegistrationsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [ticketReady, setTicketReady] = useState(false);
  const [actionEventId, setActionEventId] = useState(null);
  const [chatEvent, setChatEvent] = useState(null);
  const [detailEvent, setDetailEvent] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("all"); // "all" | "upcoming" | "registered"
  const [confirmation, setConfirmation] = useState(null);
  const [confirmationError, setConfirmationError] = useState("");
  const [confirmationIssue, setConfirmationIssue] = useState("");
  const [reload, setReload] = useState(0);
  const inFlight = useRef(false);
  const returnFocusRef = useRef(null);

  const handleError = useCallback((requestError, fallback) => {
    if (requestError.status === 401) onUnauthorized("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    else setError(requestError.status === 403 ? "Bạn không có quyền thực hiện thao tác này." : requestError.status === 404 ? "Sự kiện này không còn khả dụng." : requestError.status === 0 ? "Không thể kết nối đến máy chủ." : fallback);
  }, [onUnauthorized]);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setEventsLoading(true);
    setRegistrationsLoading(true);

    getAttendeeEvents(token, controller.signal)
      .then((items) => {
        setEvents(items);
        setChatEvent((current) => current && items.some((item) => item.id === current.id) ? current : null);
        setDetailEvent((current) => current && items.some((item) => item.id === current.id) ? items.find((item) => item.id === current.id) : null);
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") handleError(requestError, "Không thể tải danh sách sự kiện.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setEventsLoading(false);
      });

    getMyRegistrations(token, controller.signal)
      .then(setRegistrations)
      .catch((requestError) => {
        if (requestError.name !== "AbortError") handleError(requestError, "Không thể tải danh sách đăng ký.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setRegistrationsLoading(false);
      });

    return () => controller.abort();
  }, [token, reload, handleError]);

  const registrationMap = useMemo(() => new Map(registrations.map((item) => [item.event_id, item])), [registrations]);
  const eventMap = useMemo(() => new Map(events.map((item) => [item.id, item])), [events]);

  const activeRegistrations = useMemo(() => registrations.filter((r) => r.status === "REGISTERED"), [registrations]);

  const closeConfirmation = useCallback(() => {
    if (inFlight.current) return;
    setConfirmation(null);
    setConfirmationError("");
    setConfirmationIssue("");
  }, []);

  const openConfirmation = (mode, event, registration, trigger) => {
    if (inFlight.current || currentUser.role !== "ATTENDEE") return;
    returnFocusRef.current = trigger;
    setConfirmation({ mode, event, registration });
    setConfirmationError("");
    setConfirmationIssue("");
    setError("");
    setSuccess("");
    setTicketReady(false);
  };

  const confirmRegistrationAction = async () => {
    if (!confirmation || inFlight.current || currentUser.role !== "ATTENDEE") return;
    const { mode, event } = confirmation;
    inFlight.current = true;
    setActionEventId(event.id);
    setConfirmationError("");
    setConfirmationIssue("");

    try {
      if (mode === "register") {
        const savedRegistration = await registerForEvent(event.id, token);
        setRegistrations((items) => {
          const exists = items.some((item) => item.event_id === savedRegistration.event_id);
          return exists ? items.map((item) => item.event_id === savedRegistration.event_id ? savedRegistration : item) : [savedRegistration, ...items];
        });
        setSuccess(`Đăng ký thành công tham gia sự kiện "${event.title}".`);
        setTicketReady(true);
      } else {
        await cancelMyRegistration(event.id, token);
        setRegistrations((items) => items.map((item) => item.event_id === event.id ? { ...item, status: "CANCELLED" } : item));
        setSuccess(`Đã hủy đăng ký sự kiện "${event.title}".`);
        setTicketReady(false);
      }
      setConfirmation(null);
      setReload((value) => value + 1);
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      } else if (mode === "register") {
        const mapped = mapRegistrationError(requestError);
        setConfirmationError(mapped.message);
        setConfirmationIssue(mapped.issue);
        if (mapped.issue === "already-registered" || mapped.issue === "unavailable") setReload((value) => value + 1);
      } else {
        setConfirmationError(mapCancellationError(requestError));
        setConfirmationIssue(requestError.status === 404 ? "unavailable" : "error");
        if (requestError.status === 404) setReload((value) => value + 1);
      }
    } finally {
      inFlight.current = false;
      setActionEventId(null);
    }
  };

  // Filtered & Featured Events
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      const q = searchQuery.trim().toLowerCase();
      const matchQuery = !q || evt.title?.toLowerCase().includes(q) || evt.location?.toLowerCase().includes(q) || evt.description?.toLowerCase().includes(q);
      if (!matchQuery) return false;

      if (filterTab === "registered") {
        const reg = registrationMap.get(evt.id);
        return reg && reg.status === "REGISTERED";
      }
      if (filterTab === "upcoming") {
        const now = new Date();
        return !evt.start_time || new Date(evt.start_time) >= now;
      }
      return true;
    });
  }, [events, searchQuery, filterTab, registrationMap]);

  // Top featured event (the first upcoming published event)
  const featuredEvent = useMemo(() => {
    if (events.length === 0) return null;
    return events[0];
  }, [events]);

  const confirmationRegistration = confirmation ? registrationMap.get(confirmation.event.id) || confirmation.registration : null;

  const eventForRegistration = (registration, event) => event || {
    id: registration.event_id,
    title: `Sự kiện #${registration.event_id}`,
    start_time: null,
    end_time: null,
    location: "Không còn thông tin sự kiện",
    max_attendees: null,
  };

  // Sub-views
  if (view === "tickets") {
    return (
      <div className="dashboard-shell attendee-workspace">
        <WorkspaceHeader currentUser={currentUser} activeView={view} onNavigate={setView} onProfile={onProfile} onLogout={onLogout} workspaceLabel="Cổng thông tin người tham dự" />
        <main className="dashboard-main attendee-portal-main">
          <MyTickets token={token} events={events} registrations={registrations} onUnauthorized={onUnauthorized} onBrowseEvents={() => setView("events")} />
        </main>
      </div>
    );
  }

  if (view === "feedback") {
    return (
      <div className="dashboard-shell attendee-workspace">
        <WorkspaceHeader currentUser={currentUser} activeView={view} onNavigate={setView} onProfile={onProfile} onLogout={onLogout} workspaceLabel="Cổng thông tin người tham dự" />
        <main className="dashboard-main attendee-portal-main">
          <MyFeedback token={token} events={events} registrations={registrations} onUnauthorized={onUnauthorized} />
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-shell attendee-workspace">
      <WorkspaceHeader currentUser={currentUser} activeView={view} onNavigate={setView} onProfile={onProfile} onLogout={onLogout} workspaceLabel="Cổng thông tin người tham dự" />

      {view === "announcements" ? (
        <MyAnnouncementsPage embedded token={token} currentUser={currentUser} onLogout={onLogout} onUnauthorized={onUnauthorized} />
      ) : (
        <main className="dashboard-main attendee-portal-main">
          {error && <div className="inline-message error-message" role="alert">{error}</div>}
          {success && (
            <div className="inline-message success-message attendee-success-toast" role="status" aria-live="polite">
              <span>{success}</span>
              {ticketReady && (
                <button type="button" className="text-button" onClick={() => { setSuccess(""); setView("tickets"); }}>
                  Xem vé điện tử ngay →
                </button>
              )}
            </div>
          )}

          {view === "events" ? (
            <>
              {/* --- ATTENDEE HOME: HERO NHỎ & QUICK STATS --- */}
              <section className="attendee-hero">
                <div className="attendee-hero-top">
                  <div>
                    <span className="attendee-hero-badge">Cổng sự kiện thông minh</span>
                    <h1>Xin chào, {currentUser?.full_name || "Bạn"}!</h1>
                    <p>
                      Khám phá các sự kiện công nghệ và hội thảo AI đỉnh cao. Đăng ký tham dự, nhận vé điện tử kèm mã QR và tương tác với Trợ lý sự kiện AI.
                    </p>
                  </div>
                </div>

                <div className="attendee-quick-stats">
                  <div
                    className={`attendee-stat-card ${filterTab === "all" ? "active" : ""}`}
                    onClick={() => setFilterTab("all")}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="attendee-stat-icon">📅</div>
                    <div className="attendee-stat-meta">
                      <span>Sự kiện đang mở</span>
                      <strong>{events.length}</strong>
                    </div>
                  </div>

                  <div
                    className={`attendee-stat-card ${filterTab === "registered" ? "active" : ""}`}
                    onClick={() => setFilterTab("registered")}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="attendee-stat-icon">📋</div>
                    <div className="attendee-stat-meta">
                      <span>Đã đăng ký</span>
                      <strong>{activeRegistrations.length}</strong>
                    </div>
                  </div>

                  <div
                    className="attendee-stat-card"
                    onClick={() => setView("tickets")}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="attendee-stat-icon">🎟️</div>
                    <div className="attendee-stat-meta">
                      <span>Vé của tôi</span>
                      <strong>{activeRegistrations.length}</strong>
                    </div>
                  </div>
                </div>
              </section>

              {/* --- SEARCH & FILTER BAR --- */}
              <div className="attendee-search-bar">
                <div className="attendee-search-input-wrap">
                  <span className="attendee-search-icon" aria-hidden="true">🔍</span>
                  <input
                    type="text"
                    className="attendee-search-input"
                    placeholder="Tìm sự kiện theo tên, địa điểm, từ khóa..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="attendee-filter-chips">
                  <button
                    type="button"
                    className={`attendee-chip ${filterTab === "all" ? "active" : ""}`}
                    onClick={() => setFilterTab("all")}
                  >
                    Tất cả ({events.length})
                  </button>
                  <button
                    type="button"
                    className={`attendee-chip ${filterTab === "upcoming" ? "active" : ""}`}
                    onClick={() => setFilterTab("upcoming")}
                  >
                    Sắp tới
                  </button>
                  <button
                    type="button"
                    className={`attendee-chip ${filterTab === "registered" ? "active" : ""}`}
                    onClick={() => setFilterTab("registered")}
                  >
                    Đã đăng ký ({activeRegistrations.length})
                  </button>
                </div>
              </div>

              {/* --- SỰ KIỆN NỔI BẬT (FEATURED EVENT) --- */}
              {featuredEvent && !searchQuery && filterTab === "all" && (
                <section aria-labelledby="featured-event-title">
                  <div className="attendee-section-heading">
                    <h2 id="featured-event-title">
                      ⭐ Sự kiện nổi bật
                    </h2>
                  </div>

                  <article className="attendee-featured-card">
                    <div className="attendee-featured-media">
                      <EventCoverImage src={featuredEvent.cover_image_url} alt={featuredEvent.title} />
                      <span className="attendee-featured-overlay-badge">Nổi bật</span>
                    </div>

                    <div className="attendee-featured-body">
                      <div>
                        <h3>{featuredEvent.title}</h3>
                        <p className="attendee-featured-desc">
                          {featuredEvent.description || "Sự kiện công nghệ hàng đầu với sự góp mặt của các chuyên gia uy tín."}
                        </p>
                      </div>

                      <div>
                        <div className="attendee-meta-row">
                          <div className="attendee-meta-item">
                            <span>📅</span>
                            <strong>{formatDateOnly(featuredEvent.start_time)}</strong>
                            <span>({formatTimeOnly(featuredEvent.start_time)} – {formatTimeOnly(featuredEvent.end_time)})</span>
                          </div>
                          <div className="attendee-meta-item">
                            <span>📍</span>
                            <strong>{featuredEvent.location || "Đang cập nhật"}</strong>
                          </div>
                          <div className="attendee-meta-item">
                            <span>👥</span>
                            <strong>{featuredEvent.max_attendees ? `${featuredEvent.max_attendees} người` : "Mở rộng"}</strong>
                          </div>
                        </div>

                        <div className="attendee-card-actions">
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => setDetailEvent(featuredEvent)}
                          >
                            Xem chi tiết
                          </button>

                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => setChatEvent(featuredEvent)}
                            style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
                          >
                            <span>🤖</span> Hỏi AI
                          </button>

                          {registrationMap.get(featuredEvent.id)?.status === "REGISTERED" ? (
                            <button
                              type="button"
                              className="danger-button"
                              disabled={actionEventId === featuredEvent.id}
                              onClick={(e) => openConfirmation("cancel", featuredEvent, registrationMap.get(featuredEvent.id), e.currentTarget)}
                            >
                              {actionEventId === featuredEvent.id ? "Đang hủy..." : "Hủy đăng ký"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="primary-button"
                              disabled={actionEventId === featuredEvent.id}
                              onClick={(e) => openConfirmation("register", featuredEvent, registrationMap.get(featuredEvent.id), e.currentTarget)}
                            >
                              {actionEventId === featuredEvent.id ? "Đang đăng ký..." : "Đăng ký sự kiện"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                </section>
              )}

              {/* --- SỰ KIỆN SẮP TỚI / DISCOVERY GRID --- */}
              <section aria-labelledby="all-events-title">
                <div className="attendee-section-heading">
                  <h2 id="all-events-title">
                    📅 Sự kiện sắp tới & Đang mở
                  </h2>
                  <span className="attendee-section-badge">{filteredEvents.length} sự kiện</span>
                </div>

                {eventsLoading || registrationsLoading ? (
                  <div className="state-panel"><div className="app-loader" /><p>Đang tải sự kiện...</p></div>
                ) : filteredEvents.length === 0 ? (
                  <div className="state-panel">
                    <strong>Không tìm thấy sự kiện nào phù hợp.</strong>
                    <p>Hãy thử tìm kiếm với từ khóa khác hoặc quay lại bộ lọc "Tất cả".</p>
                    <button type="button" className="secondary-button" onClick={() => { setSearchQuery(""); setFilterTab("all"); }}>
                      Đặt lại bộ lọc
                    </button>
                  </div>
                ) : (
                  <div className="attendee-grid">
                    {filteredEvents.map((evt) => {
                      const reg = registrationMap.get(evt.id);
                      const isRegistered = reg?.status === "REGISTERED";

                      return (
                        <article className="attendee-card" key={evt.id}>
                          <div className="attendee-card-media">
                            <EventCoverImage src={evt.cover_image_url} alt={evt.title} />
                            <span className={`attendee-card-badge ${isRegistered ? "status-registered" : "status-open"}`}>
                              {isRegistered ? "ĐÃ ĐĂNG KÝ" : "ĐANG MỞ"}
                            </span>
                          </div>

                          <div className="attendee-card-body">
                            <h3>{evt.title}</h3>
                            <p className="attendee-card-desc">
                              {evt.description || "Chưa có mô tả chi tiết."}
                            </p>

                            <div className="attendee-card-meta">
                              <div className="attendee-card-meta-item">
                                <span>📅</span>
                                <strong>{formatDateOnly(evt.start_time)}</strong>
                                <span>· {formatTimeOnly(evt.start_time)} – {formatTimeOnly(evt.end_time)}</span>
                              </div>
                              <div className="attendee-card-meta-item">
                                <span>📍</span>
                                <span>{evt.location || "Đang cập nhật"}</span>
                              </div>
                              <div className="attendee-card-meta-item">
                                <span>👥</span>
                                <span>Sức chứa: <strong>{evt.max_attendees ? `${evt.max_attendees} người` : "Không giới hạn"}</strong></span>
                              </div>
                            </div>

                            <div className="attendee-card-footer">
                              <button
                                type="button"
                                className="secondary-button compact-button"
                                onClick={() => setDetailEvent(evt)}
                              >
                                Xem chi tiết
                              </button>

                              <div style={{ display: "flex", gap: "0.4rem" }}>
                                <button
                                  type="button"
                                  className="secondary-button compact-button"
                                  onClick={() => setChatEvent(evt)}
                                  title="Hỏi Trợ lý sự kiện AI"
                                >
                                  🤖 AI
                                </button>

                                {isRegistered ? (
                                  <button
                                    type="button"
                                    className="danger-button compact-button"
                                    disabled={actionEventId === evt.id}
                                    onClick={(e) => openConfirmation("cancel", evt, reg, e.currentTarget)}
                                  >
                                    {actionEventId === evt.id ? "Đang hủy..." : "Hủy đăng ký"}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="primary-button compact-button"
                                    disabled={actionEventId === evt.id}
                                    onClick={(e) => openConfirmation("register", evt, reg, e.currentTarget)}
                                  >
                                    {actionEventId === evt.id ? "Đang đăng ký..." : "Đăng ký"}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : (
            /* --- MY REGISTRATIONS VIEW --- */
            <>
              <section className="dashboard-title-row">
                <div>
                  <p className="eyebrow">SỰ KIỆN CỦA TÔI</p>
                  <h1>Sự kiện đã đăng ký</h1>
                  <p>Quản lý các sự kiện bạn đã đăng ký tham gia và tra cứu trạng thái vé.</p>
                </div>
              </section>

              {registrationsLoading ? (
                <div className="state-panel"><div className="app-loader" /><p>Đang tải đăng ký...</p></div>
              ) : registrations.length === 0 ? (
                <div className="state-panel">
                  <strong>Bạn chưa đăng ký tham gia sự kiện nào.</strong>
                  <p>Khám phá các sự kiện đang mở và đăng ký ngay hôm nay.</p>
                  <button className="primary-button" onClick={() => setView("events")}>Khám phá sự kiện</button>
                </div>
              ) : (
                <div className="my-registrations-container">
                  {registrations.map((item) => {
                    const event = eventMap.get(item.event_id);
                    const actionEvent = eventForRegistration(item, event);
                    const isRegistered = item.status === "REGISTERED";

                    return (
                      <article className="my-registration-card" key={item.id}>
                        <div className="my-registration-info">
                          <h3>{actionEvent.title}</h3>
                          <div className="my-registration-meta">
                            <span>📅 Ngày đăng ký: <strong>{display(item.created_at)}</strong></span>
                            <span className={`registration-status status-${item.status.toLowerCase()}`}>
                              {registrationStatusLabel(item)}
                            </span>
                          </div>
                        </div>

                        <div className="my-registration-actions">
                          {isRegistered && (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => setView("tickets")}
                            >
                              Xem vé
                            </button>
                          )}

                          {isRegistered ? (
                            <button
                              type="button"
                              className="danger-button"
                              disabled={actionEventId === item.event_id}
                              onClick={(e) => openConfirmation("cancel", actionEvent, item, e.currentTarget)}
                            >
                              {actionEventId === item.event_id ? "Đang hủy..." : "Hủy đăng ký"}
                            </button>
                          ) : event ? (
                            <button
                              type="button"
                              className="primary-button"
                              disabled={actionEventId === item.event_id}
                              onClick={(e) => openConfirmation("register", event, item, e.currentTarget)}
                            >
                              {actionEventId === item.event_id ? "Đang đăng ký..." : "Đăng ký lại"}
                            </button>
                          ) : (
                            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Sự kiện đã đóng</span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      )}

      {/* --- EVENT DETAIL MODAL --- */}
      {detailEvent && (
        <AttendeeEventDetailModal
          event={detailEvent}
          registration={registrationMap.get(detailEvent.id)}
          token={token}
          busy={actionEventId === detailEvent.id}
          onClose={() => setDetailEvent(null)}
          onRegister={(evt, reg) => openConfirmation("register", evt, reg, null)}
          onCancelRegistration={(evt, reg) => openConfirmation("cancel", evt, reg, null)}
          onAskAI={(evt) => setChatEvent(evt)}
        />
      )}

      {/* --- AI CHATBOT (TRỢ LÝ SỰ KIỆN AI MODAL) --- */}
      {chatEvent && (
        <div
          className="attendee-detail-backdrop"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setChatEvent(null)}
        >
          <div
            style={{ maxWidth: 620, width: "100%", margin: "auto" }}
            role="dialog"
            aria-modal="true"
          >
            <EventAIChat
              event={chatEvent}
              token={token}
              onUnauthorized={onUnauthorized}
              onClose={() => setChatEvent(null)}
            />
          </div>
        </div>
      )}

      {/* --- REGISTRATION CONFIRMATION DIALOG --- */}
      {confirmation && (
        <RegistrationActionDialog
          key={`${confirmation.mode}-${confirmation.event.id}`}
          mode={confirmation.mode}
          event={confirmation.event}
          registration={confirmationRegistration}
          busy={actionEventId === confirmation.event.id}
          error={confirmationError}
          issue={confirmationIssue}
          returnFocus={returnFocusRef.current}
          onClose={closeConfirmation}
          onConfirm={confirmRegistrationAction}
        />
      )}
    </div>
  );
}

export default AttendeeWorkspace;
