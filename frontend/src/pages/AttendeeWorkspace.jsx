import React, { useCallback, useEffect, useRef, useState } from "react";

import EventAIChat from "../components/EventAIChat";
import MyFeedback from "../components/MyFeedback";
import MyTickets from "../components/MyTickets";
import AttendeeShell from "../components/attendee/AttendeeShell";
import ProfilePage from "./ProfilePage";
import { cancelMyRegistration, getAttendeeEvents, getMyRegistrations, registerForEvent } from "../services/api";
import MyAnnouncementsPage from "./MyAnnouncementsPage";

const literal = (value) => typeof value === "string" ? value.slice(0, 16) : "";
const display = (value) => literal(value).replace("T", " ") || "—";

const registrationStatusLabel = (registration, issue = "") => {
  if (issue === "already-registered" || registration?.status === "REGISTERED") return "Đã đăng ký";
  if (registration?.status === "CHECKED_IN") return "Đã check-in";
  if (registration?.status === "CANCELLED") return "Đã hủy";
  return "Chưa đăng ký";
};

const mapRegistrationError = (requestError) => {
  const detail = String(requestError?.message || "").toLowerCase();
  if (requestError?.status === 401) return { issue: "unauthorized", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };
  if (requestError?.status === 403) return { issue: "forbidden", message: "Bạn không có quyền đăng ký sự kiện này." };
  if (requestError?.status === 404) return { issue: "unavailable", message: "Sự kiện không tồn tại hoặc không còn khả dụng." };
  if (requestError?.status === 409 && detail.includes("already checked in")) return { issue: "already-checked-in", message: "Bạn đã check-in sự kiện này. Bạn không thể đăng ký lại." };
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
  const blockingIssue = ["already-registered", "already-checked-in", "full", "unavailable", "forbidden"].includes(issue);

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
    <div className="registration-dialog-backdrop" role="presentation" onMouseDown={(mouseEvent) => mouseEvent.target === mouseEvent.currentTarget && !busy && onClose()}>
      <section ref={dialogRef} className={`registration-confirm-dialog ${issue ? `state-${issue}` : ""}`} role="dialog" aria-modal="true" aria-labelledby="registration-confirm-title" aria-describedby={descriptionId} aria-busy={busy} tabIndex={-1}>
        <header className="registration-dialog-header">
          <div>
            <p className="eyebrow">{isRegistration ? "REGISTRATION CONFIRMATION" : "REGISTRATION UPDATE"}</p>
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
          <button ref={confirmButtonRef} type="button" className={isRegistration ? "primary-button" : "danger-button"} onClick={onConfirm} disabled={busy || (isRegistration && (blockingIssue || effectiveStatus === "REGISTERED" || effectiveStatus === "CHECKED_IN")) || (!isRegistration && effectiveStatus === "CHECKED_IN")}>
            {busy ? (isRegistration ? "Đang đăng ký..." : "Đang hủy...") : (isRegistration ? "Xác nhận đăng ký" : "Xác nhận hủy đăng ký")}
          </button>
        </div>
      </section>
    </div>
  );
}

function AttendeeWorkspace({ token, currentUser, onLogout, onUnauthorized, onProfile, onUserUpdated }) {
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
  const [confirmation, setConfirmation] = useState(null);
  const [confirmationError, setConfirmationError] = useState("");
  const [confirmationIssue, setConfirmationIssue] = useState("");
  const [reload, setReload] = useState(0);
  const inFlight = useRef(false);
  const returnFocusRef = useRef(null);

  const handleError = useCallback((requestError, fallback) => {
    if (requestError.status === 401) onUnauthorized("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    else setError(requestError.status === 403 ? "You do not have permission to perform this action." : requestError.status === 404 ? "This event is no longer available." : requestError.status === 0 ? "Unable to connect to the server." : fallback);
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
      })
      .catch((requestError) => { if (requestError.name !== "AbortError") handleError(requestError, "Unable to load events."); })
      .finally(() => { if (!controller.signal.aborted) setEventsLoading(false); });
    getMyRegistrations(token, controller.signal)
      .then(setRegistrations)
      .catch((requestError) => { if (requestError.name !== "AbortError") handleError(requestError, "Unable to load registrations."); })
      .finally(() => { if (!controller.signal.aborted) setRegistrationsLoading(false); });
    return () => controller.abort();
  }, [token, reload, handleError]);

  const registrationMap = new Map(registrations.map((item) => [item.event_id, item]));
  const eventMap = new Map(events.map((item) => [item.id, item]));
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
        setSuccess("Đăng ký sự kiện thành công");
        setTicketReady(true);
      } else {
        await cancelMyRegistration(event.id, token);
        setRegistrations((items) => items.map((item) => item.event_id === event.id ? { ...item, status: "CANCELLED" } : item));
        setSuccess("Đã hủy đăng ký sự kiện.");
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
  const registrationAction = (event, registration) => {
    if (currentUser.role !== "ATTENDEE") return null;
    if (registration?.status === "CHECKED_IN") return (
      <span className="registration-status status-checked_in">✓ Đã check-in</span>
    );
    if (registration?.status === "REGISTERED") return (
      <><span className="registration-status status-registered">Đã đăng ký</span><button type="button" className="danger-button" disabled={actionEventId === event.id} onClick={(clickEvent) => openConfirmation("cancel", event, registration, clickEvent.currentTarget)}>{actionEventId === event.id ? "Đang hủy..." : "Hủy đăng ký"}</button></>
    );
    return (
      <>{registration && <span className="registration-status status-cancelled">Đã hủy</span>}<button type="button" className="primary-button" disabled={actionEventId === event.id} onClick={(clickEvent) => openConfirmation("register", event, registration, clickEvent.currentTarget)}>{actionEventId === event.id ? "Đang đăng ký..." : registration ? "Đăng ký lại" : "Đăng ký"}</button></>
    );
  };
  const confirmationRegistration = confirmation ? registrationMap.get(confirmation.event.id) || confirmation.registration : null;
  const eventForRegistration = (registration, event) => event || {
    id: registration.event_id,
    title: `Event #${registration.event_id}`,
    start_time: null,
    end_time: null,
    location: "Không còn thông tin sự kiện",
    max_attendees: null,
  };

  const [searchValue, setSearchValue] = useState("");

  const filteredEvents = !searchValue.trim()
    ? events
    : events.filter((event) => {
        const query = searchValue.trim().toLowerCase();
        return [event.title, event.description, event.location]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      });

  const shellContent = (
    <>
      {view === "home" && (
        <section>
          <div className="attendee-welcome">
            <div>
              <p className="attendee-eyebrow">ATTENDEE PORTAL</p>
              <h1>Xin chào, {currentUser.full_name} 👋</h1>
              <p>Theo dõi sự kiện, vé, thông báo và trải nghiệm tham dự của bạn.</p>
            </div>
            <button type="button" className="attendee-primary-btn" onClick={() => setView("events")}>Khám phá sự kiện</button>
          </div>
          <div className="attendee-stat-grid">
            <article className="attendee-stat-card"><span className="attendee-stat-icon blue">◎</span><div><strong>{registrations.filter((r) => r.status === "REGISTERED").length}</strong><span>Upcoming registrations</span></div></article>
            <article className="attendee-stat-card"><span className="attendee-stat-icon green">✓</span><div><strong>{registrations.filter((r) => r.status === "CHECKED_IN").length}</strong><span>Checked in</span></div></article>
            <article className="attendee-stat-card"><span className="attendee-stat-icon purple">▤</span><div><strong>{registrations.length}</strong><span>Total registrations</span></div></article>
          </div>
          <div className="attendee-panel attendee-home-callout" style={{ padding: "24px" }}>
            <div className="panel-heading"><div><p className="attendee-eyebrow">YOUR JOURNEY</p><h2>Event journey</h2></div></div>
            <div className="registration-card-list">
              {registrations.slice(0, 4).map((item) => {
                const event = eventMap.get(item.event_id);
                return (
                  <article className="registration-card" key={item.id}>
                    <div className="registration-card-copy">
                      <div className="registration-card-title"><h3>{event?.title || item.event_title || `Event #${item.event_id}`}</h3><span className={`attendee-pill attendee-pill-${String(item.status).toLowerCase()}`}>{registrationStatusLabel(item)}</span></div>
                      <small>{event?.location || "Event location unavailable"}</small>
                    </div>
                    {item.status === "CHECKED_IN" && <span className="locked-note">✓ Feedback available</span>}
                  </article>
                );
              })}
              {registrations.length === 0 && <div className="attendee-empty"><h3>Chưa có sự kiện</h3><p>Khám phá và đăng ký sự kiện đầu tiên của bạn.</p><button type="button" className="attendee-primary-btn" onClick={() => setView("events")}>Discover Events</button></div>}
            </div>
          </div>
        </section>
      )}

      {view === "tickets" && (
        <MyTickets token={token} events={events} registrations={registrations} onUnauthorized={onUnauthorized} onBrowseEvents={() => setView("events")}/>
      )}

      {view === "feedback" && (
        <MyFeedback token={token} events={events} registrations={registrations} onUnauthorized={onUnauthorized}/>
      )}

      {view === "announcements" && (
        <MyAnnouncementsPage embedded token={token} currentUser={currentUser} onLogout={onLogout} onUnauthorized={onUnauthorized}/>
      )}

      {view === "profile" && (
        <ProfilePage
          token={token}
          currentUser={currentUser}
          onUserUpdated={onUserUpdated}
          onBack={() => setView("home")}
          onLogout={onLogout}
          onUnauthorized={onUnauthorized}
        />
      )}

      {view === "events" && (
        <>
          {error && <div className="inline-message error-message" role="alert">{error}</div>}
          {success && <div className="inline-message success-message attendee-success-toast" role="status" aria-live="polite"><span>{success}</span>{ticketReady && <button type="button" className="text-button" onClick={() => { setSuccess(""); setView("tickets"); }}>Xem vé của tôi</button>}</div>}
          <section className="attendee-section-header">
            <div>
              <p className="attendee-eyebrow">DISCOVER EVENTS</p>
              <h1>Events</h1>
              <p>Published events currently open for registration.</p>
            </div>
          </section>
          {eventsLoading || registrationsLoading ? <div className="state-panel"><div className="app-loader"/><p>Loading events...</p></div> : filteredEvents.length === 0 ? <div className="attendee-panel attendee-empty"><h3>Không tìm thấy sự kiện</h3><p>Thử tìm kiếm bằng tên sự kiện, mô tả hoặc địa điểm khác.</p></div> : (
            <div className="event-discovery-grid">
              {filteredEvents.map((event) => <article className={`event-discovery-card ${chatEvent?.id === event.id ? "selected" : ""}`} key={event.id} onClick={() => setChatEvent(event)}>
                <div className="event-card-media">
                  <div className="event-art art-navy"><div className="event-art-grid" aria-hidden="true"/><span className="event-art-mark">EM</span></div>
                </div>
                <div className="event-card-body">
                  <div className="event-card-meta"><span>{display(event.start_time)}</span><span className="attendee-pill attendee-pill-published">PUBLISHED</span></div>
                  <h3>{event.title}</h3>
                  <p>{event.description || "No description provided."}</p>
                  <div className="event-card-location"><span>⌖</span><span>{event.location || "Location unavailable"}</span></div>
                  <div className="event-discovery-actions">
                    {registrationAction(event, registrationMap.get(event.id))}
                    <button type="button" className="attendee-outline-btn" onClick={(e) => { e.stopPropagation(); setChatEvent(event); }}>Ask AI</button>
                  </div>
                </div>
              </article>)}
              {chatEvent && <div className="attendee-ai-modal"><div className="attendee-ai-modal-inner"><button type="button" className="attendee-ai-close" onClick={() => setChatEvent(null)}>×</button><EventAIChat key={`attendee-ai-${chatEvent.id}`} event={chatEvent} token={token} onUnauthorized={onUnauthorized} onClose={() => setChatEvent(null)}/></div></div>}
            </div>
          )}
        </>
      )}

      {view === "registrations" && (
        <>
          {error && <div className="inline-message error-message" role="alert">{error}</div>}
          {success && <div className="inline-message success-message attendee-success-toast" role="status" aria-live="polite"><span>{success}</span>{ticketReady && <button type="button" className="text-button" onClick={() => { setSuccess(""); setView("tickets"); }}>Xem vé của tôi</button>}</div>}
          <section className="attendee-section-header"><div><p className="attendee-eyebrow">MY EVENTS</p><h1>My Registrations</h1><p>The events you registered for, with their current status.</p></div></section>
          {registrationsLoading ? <div className="state-panel"><div className="app-loader"/><p>Loading registrations...</p></div> : registrations.length === 0 ? <div className="attendee-panel attendee-empty"><h3>You have not registered for any events yet.</h3><button className="attendee-primary-btn" onClick={() => setView("events")}>Browse Events</button></div> : <div className="registration-card-list">{registrations.map((item) => { const event = eventMap.get(item.event_id); const actionEvent = eventForRegistration(item, event); return <article className="registration-card" key={item.id}><div className="registration-card-copy"><div className="registration-card-title"><h3>{actionEvent.title}</h3><span className={`attendee-pill attendee-pill-${String(item.status).toLowerCase()}`}>{registrationStatusLabel(item)}</span></div><p>Registered: {display(item.created_at)}</p></div>{item.status === "CHECKED_IN" ? <span className="locked-note">✓ Đã check-in · Không thể hủy hoặc đăng ký lại</span> : item.status === "REGISTERED" ? <button type="button" className="attendee-danger-outline" disabled={actionEventId === item.event_id} onClick={(e) => openConfirmation("cancel", actionEvent, item, e.currentTarget)}>{actionEventId === item.event_id ? "Đang hủy..." : "Hủy đăng ký"}</button> : event ? <button type="button" className="attendee-primary-btn" disabled={actionEventId === item.event_id} onClick={(e) => openConfirmation("register", event, item, e.currentTarget)}>{actionEventId === item.event_id ? "Đang đăng ký..." : "Đăng ký lại"}</button> : <span>Registration is currently closed.</span>}</article>; })}</div>}
        </>
      )}
    </>
  );

  return (
    <AttendeeShell
      currentUser={currentUser}
      activeView={view}
      onNavigate={setView}
      onLogout={onLogout}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
    >
      {shellContent}
      {confirmation && <RegistrationActionDialog key={`${confirmation.mode}-${confirmation.event.id}`} mode={confirmation.mode} event={confirmation.event} registration={confirmationRegistration} busy={actionEventId === confirmation.event.id} error={confirmationError} issue={confirmationIssue} returnFocus={returnFocusRef.current} onClose={closeConfirmation} onConfirm={confirmRegistrationAction} />}
    </AttendeeShell>
  );
}


export default AttendeeWorkspace;
