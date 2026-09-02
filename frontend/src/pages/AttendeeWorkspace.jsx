import React, { useCallback, useEffect, useRef, useState } from "react";

import EventAIChat from "../components/EventAIChat";
import MyFeedback from "../components/MyFeedback";
import MyTickets from "../components/MyTickets";
import { cancelMyRegistration, getAttendeeEvents, getMyRegistrations, registerForEvent } from "../services/api";
import MyAnnouncementsPage from "./MyAnnouncementsPage";

const literal = (value) => typeof value === "string" ? value.slice(0, 16) : "";
const display = (value) => literal(value).replace("T", " ") || "—";

function AttendeeWorkspace({ token, currentUser, onLogout, onUnauthorized }) {
  const [view, setView] = useState("events");
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [registrationsLoading, setRegistrationsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionEventId, setActionEventId] = useState(null);
  const [chatEvent, setChatEvent] = useState(null);
  const [reload, setReload] = useState(0);
  const inFlight = useRef(false);

  const handleError = useCallback((requestError, fallback) => {
    if (requestError.status === 401) onUnauthorized();
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
  const actionError = (requestError, type) => {
    if (requestError.status === 409) {
      if (requestError.message === "Already registered for this event") return "You are already registered for this event.";
      if (requestError.message === "Event is full") return "This event has reached its registration capacity.";
      if (requestError.message === "Event is not open for registration") return "This event is not currently open for registration.";
      if (requestError.message === "Checked-in registration cannot be cancelled") return "This registration cannot be cancelled because you have already checked in.";
    }
    if (requestError.status === 403) return "You do not have permission to perform this action.";
    if (requestError.status === 404) return "This event is no longer available.";
    if (requestError.status === 0) return "Unable to connect to the server.";
    return type === "register" ? "Registration request could not be completed." : "Cancellation request could not be completed.";
  };
  const register = async (eventId) => {
    if (inFlight.current) return;
    inFlight.current = true; setActionEventId(eventId); setError(""); setSuccess("");
    try { await registerForEvent(eventId, token); setSuccess("Registration successful. Your registration has been confirmed."); setReload((value) => value + 1); }
    catch (requestError) { if (requestError.status === 401) onUnauthorized(); else setError(actionError(requestError, "register")); }
    finally { inFlight.current = false; setActionEventId(null); }
  };
  const cancel = async (eventId) => {
    if (inFlight.current || !window.confirm("Cancel your registration for this event?")) return;
    inFlight.current = true; setActionEventId(eventId); setError(""); setSuccess("");
    try { await cancelMyRegistration(eventId, token); setSuccess("Registration cancelled."); setReload((value) => value + 1); }
    catch (requestError) { if (requestError.status === 401) onUnauthorized(); else setError(actionError(requestError, "cancel")); }
    finally { inFlight.current = false; setActionEventId(null); }
  };
  const registrationAction = (event, registration) => registration?.status === "REGISTERED" ? (
    <><span className="registration-status status-registered">REGISTERED</span><button type="button" className="danger-button" disabled={actionEventId === event.id} onClick={() => cancel(event.id)}>{actionEventId === event.id ? "Cancelling..." : "Cancel registration"}</button></>
  ) : (
    <><span className={registration ? "registration-status status-cancelled" : ""}>{registration?.status || ""}</span><button type="button" className="primary-button" disabled={actionEventId === event.id} onClick={() => register(event.id)}>{actionEventId === event.id ? "Registering..." : registration ? "Register again" : "Register"}</button></>
  );

  const header = (active) => (
    <header className="dashboard-header">
      <div className="header-brand"><div className="brand-mark compact"><span/><span/><span/></div><div><strong>EVENT MANAGER AI</strong><span>Attendee Portal</span></div></div>
      <nav className="attendee-nav">
        <button className={active === "events" ? "active" : ""} onClick={() => setView("events")}>Events</button>
        <button className={active === "registrations" ? "active" : ""} onClick={() => setView("registrations")}>My Registrations</button>
        <button className={active === "tickets" ? "active" : ""} onClick={() => setView("tickets")}>My Tickets</button>
        <button className={active === "feedback" ? "active" : ""} onClick={() => setView("feedback")}>Feedback</button>
        <button className={active === "announcements" ? "active" : ""} onClick={() => setView("announcements")}>Announcements</button>
      </nav>
      <div className="user-actions"><div className="user-copy"><strong>{currentUser.full_name}</strong><span className="role-badge">ATTENDEE</span></div><button className="secondary-button" onClick={onLogout}>Logout</button></div>
    </header>
  );

  if (view === "tickets") return <div className="dashboard-shell attendee-workspace">{header("tickets")}<main className="dashboard-main attendee-portal-main"><MyTickets token={token} events={events} registrations={registrations} onUnauthorized={onUnauthorized} onBrowseEvents={() => setView("events")}/></main></div>;
  if (view === "feedback") return <div className="dashboard-shell attendee-workspace">{header("feedback")}<main className="dashboard-main attendee-portal-main"><MyFeedback token={token} events={events} registrations={registrations} onUnauthorized={onUnauthorized}/></main></div>;

  return (
    <div className="dashboard-shell attendee-workspace">
      {header(view)}
      {view === "announcements" ? (
        <MyAnnouncementsPage embedded token={token} currentUser={currentUser} onLogout={onLogout} onUnauthorized={onUnauthorized}/>
      ) : (
        <main className="dashboard-main attendee-portal-main">
          {error && <div className="inline-message error-message">{error}</div>}
          {success && <div className="inline-message success-message">{success}</div>}
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
              {registrationsLoading ? <div className="state-panel"><div className="app-loader"/><p>Loading registrations...</p></div> : registrations.length === 0 ? <div className="state-panel"><strong>You have not registered for any events yet.</strong><button className="primary-button" onClick={() => setView("events")}>Browse Events</button></div> : <div className="my-registration-list">{registrations.map((item) => { const event = eventMap.get(item.event_id); return <article key={item.id}><div><h2>{event?.title || `Event #${item.event_id}`}</h2><span className={`registration-status status-${item.status.toLowerCase()}`}>{item.status}</span><p>Registered: {display(item.created_at)}</p></div>{item.status === "REGISTERED" ? <button className="danger-button" disabled={actionEventId === item.event_id} onClick={() => cancel(item.event_id)}>Cancel registration</button> : event ? <button className="primary-button" disabled={actionEventId === item.event_id} onClick={() => register(item.event_id)}>Register again</button> : <span>Registration is currently closed.</span>}</article>; })}</div>}
            </>
          )}
        </main>
      )}
    </div>
  );
}

export default AttendeeWorkspace;
