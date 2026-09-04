import React, { useCallback, useEffect, useRef, useState } from "react";

import EventAIChat from "../components/EventAIChat";
import MyFeedback from "../components/MyFeedback";
import MyTickets from "../components/MyTickets";
import WorkspaceHeader from "../components/WorkspaceHeader";
import { cancelMyRegistration, getAttendeeEvents, getMyRegistrations, registerForEvent } from "../services/api";
import MyAnnouncementsPage from "./MyAnnouncementsPage";

const literal = (value) => typeof value === "string" ? value.slice(0, 16) : "";
const display = (value) => literal(value).replace("T", " ") || "—";

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
          <button ref={confirmButtonRef} type="button" className={isRegistration ? "primary-button" : "danger-button"} onClick={onConfirm} disabled={busy || (isRegistration && (blockingIssue || effectiveStatus === "REGISTERED"))}>
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

  if (view === "tickets") return <div className="dashboard-shell attendee-workspace"><WorkspaceHeader currentUser={currentUser} activeView={view} onNavigate={setView} onProfile={onProfile} onLogout={onLogout} workspaceLabel="Attendee portal" /><main className="dashboard-main attendee-portal-main"><MyTickets token={token} events={events} registrations={registrations} onUnauthorized={onUnauthorized} onBrowseEvents={() => setView("events")}/></main></div>;
  if (view === "feedback") return <div className="dashboard-shell attendee-workspace"><WorkspaceHeader currentUser={currentUser} activeView={view} onNavigate={setView} onProfile={onProfile} onLogout={onLogout} workspaceLabel="Attendee portal" /><main className="dashboard-main attendee-portal-main"><MyFeedback token={token} events={events} registrations={registrations} onUnauthorized={onUnauthorized}/></main></div>;

  return (
    <div className="dashboard-shell attendee-workspace">
      <WorkspaceHeader currentUser={currentUser} activeView={view} onNavigate={setView} onProfile={onProfile} onLogout={onLogout} workspaceLabel="Attendee portal" />
      {view === "announcements" ? (
        <MyAnnouncementsPage embedded token={token} currentUser={currentUser} onLogout={onLogout} onUnauthorized={onUnauthorized}/>
      ) : (
        <main className="dashboard-main attendee-portal-main">
          {error && <div className="inline-message error-message" role="alert">{error}</div>}
          {success && <div className="inline-message success-message attendee-success-toast" role="status" aria-live="polite"><span>{success}</span>{ticketReady && <button type="button" className="text-button" onClick={() => { setSuccess(""); setView("tickets"); }}>Xem vé của tôi</button>}</div>}
          {view === "events" ? (
            <>
              <section className="dashboard-title-row"><div><p className="eyebrow">DISCOVER EVENTS</p><h1>Events</h1><p>Published events currently open for registration.</p></div></section>
              {eventsLoading || registrationsLoading ? <div className="state-panel"><div className="app-loader"/><p>Loading events...</p></div> : events.length === 0 ? <div className="state-panel"><strong>No published events available.</strong></div> : (
                <div className="attendee-event-grid">
                  {events.map((event) => <article className={`attendee-event-card ${chatEvent?.id === event.id ? "selected" : ""}`} key={event.id}><span className="status-badge status-published">PUBLISHED</span><h2>{event.title}</h2><p>{event.description || "No description provided."}</p><dl><div><dt>Location</dt><dd>{event.location}</dd></div><div><dt>Schedule</dt><dd>{display(event.start_time)} – {display(event.end_time)}</dd></div><div><dt>Capacity</dt><dd>{event.max_attendees}</dd></div></dl><div className="attendee-event-actions"><button type="button" className="secondary-button" onClick={() => setChatEvent(event)}>Ask AI</button>{registrationAction(event, registrationMap.get(event.id))}</div></article>)}
                  {chatEvent && <div className="attendee-ai-panel"><EventAIChat key={`attendee-ai-${chatEvent.id}`} event={chatEvent} token={token} onUnauthorized={onUnauthorized} onClose={() => setChatEvent(null)}/></div>}
                </div>
              )}
            </>
          ) : (
            <>
              <section className="dashboard-title-row"><div><p className="eyebrow">MY EVENTS</p><h1>My Registrations</h1></div></section>
              {registrationsLoading ? <div className="state-panel"><div className="app-loader"/><p>Loading registrations...</p></div> : registrations.length === 0 ? <div className="state-panel"><strong>You have not registered for any events yet.</strong><button className="primary-button" onClick={() => setView("events")}>Browse Events</button></div> : <div className="my-registration-list">{registrations.map((item) => { const event = eventMap.get(item.event_id); const actionEvent = eventForRegistration(item, event); return <article key={item.id}><div><h2>{actionEvent.title}</h2><span className={`registration-status status-${item.status.toLowerCase()}`}>{registrationStatusLabel(item)}</span><p>Registered: {display(item.created_at)}</p></div>{currentUser.role !== "ATTENDEE" ? null : item.status === "REGISTERED" ? <button type="button" className="danger-button" disabled={actionEventId === item.event_id} onClick={(clickEvent) => openConfirmation("cancel", actionEvent, item, clickEvent.currentTarget)}>{actionEventId === item.event_id ? "Đang hủy..." : "Hủy đăng ký"}</button> : event ? <button type="button" className="primary-button" disabled={actionEventId === item.event_id} onClick={(clickEvent) => openConfirmation("register", event, item, clickEvent.currentTarget)}>{actionEventId === item.event_id ? "Đang đăng ký..." : "Đăng ký lại"}</button> : <span>Registration is currently closed.</span>}</article>; })}</div>}
            </>
          )}
        </main>
      )}
      {confirmation && <RegistrationActionDialog key={`${confirmation.mode}-${confirmation.event.id}`} mode={confirmation.mode} event={confirmation.event} registration={confirmationRegistration} busy={actionEventId === confirmation.event.id} error={confirmationError} issue={confirmationIssue} returnFocus={returnFocusRef.current} onClose={closeConfirmation} onConfirm={confirmRegistrationAction} />}
    </div>
  );
}

export default AttendeeWorkspace;
