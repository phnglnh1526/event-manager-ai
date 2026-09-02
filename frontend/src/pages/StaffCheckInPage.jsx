import React, { useEffect, useRef, useState } from "react";

import EventAIChat from "../components/EventAIChat";
import QRScanner from "../components/QRScanner";
import { checkInTicket, getCheckInEvents } from "../services/api";

const literal = (value) => typeof value === "string" ? value.slice(0, 16) : "";
const dateLabel = (value) => { const item = literal(value); return item ? `${item.slice(8, 10)}/${item.slice(5, 7)}/${item.slice(0, 4)}` : "—"; };
const clock = (value) => literal(value).slice(11, 16) || "—";

function StaffCheckInPage({ token, currentUser, onLogout, onUnauthorized }) {
  const [events, setEvents] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [ticketCode, setTicketCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState("");
  const [result, setResult] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const inputRef = useRef(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    getCheckInEvents(token, controller.signal)
      .then((items) => { setEvents(items); setSelectedId(items.length ? String(items[0].id) : ""); })
      .catch((error) => { if (error.name === "AbortError") return; if (error.status === 401) onUnauthorized(); else setPageError(error.status === 403 ? "You do not have permission to check in attendees." : error.status === 0 ? "Unable to connect to the server." : "Unable to load events for check-in."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, onUnauthorized]);
  useEffect(() => { if (!loading && !scannerOpen) inputRef.current?.focus(); }, [loading, scannerOpen]);

  const selectedEvent = events.find((item) => String(item.id) === selectedId) || null;
  const changeEvent = (value) => { if (scannerOpen || submitting) return; setSelectedId(value); setTicketCode(""); setResult(null); setTimeout(() => inputRef.current?.focus(), 0); };
  const mapError = (error) => {
    if (error.status === 401) return "Your session has expired. Please sign in again.";
    if (error.status === 403) return "You do not have permission to check in attendees.";
    if (error.status === 404) return "Ticket not found for the selected event.";
    if (error.status === 422) return "Invalid ticket code.";
    if (error.status === 0) return "Unable to connect to the server.";
    if (error.status === 409) {
      if (error.message === "Ticket already checked in") return "This ticket has already been checked in.";
      if (error.message === "Ticket is not active") return "This ticket is no longer active.";
      if (error.message === "Registration is not active") return "Registration is not active for this event.";
      if (error.message === "Event is not open for check-in") return "This event is not open for check-in.";
    }
    return "Check-in could not be completed.";
  };
  const performCheckIn = async (candidate) => {
    if (inFlight.current) return;
    const code = candidate.trim(); const event = selectedEvent;
    if (!event) { setResult({ type: "error", message: "Select an event before checking in a ticket." }); return; }
    if (!code) { setResult({ type: "error", message: "Enter a ticket code." }); inputRef.current?.focus(); return; }
    inFlight.current = true; setSubmitting(true); setResult(null);
    try { const data = await checkInTicket(event.id, code, token); setTicketCode(""); setResult({ type: "success", data }); }
    catch (error) { if (error.status === 401) onUnauthorized(); else setResult({ type: "error", message: mapError(error) }); }
    finally { inFlight.current = false; setSubmitting(false); setTimeout(() => inputRef.current?.focus(), 0); }
  };
  const submit = (event) => { event.preventDefault(); void performCheckIn(ticketCode); };
  const openScanner = () => {
    if (!selectedEvent) { setResult({ type: "error", message: "Select an event before scanning a ticket." }); return; }
    if (submitting) return;
    setResult(null); setScannerOpen(true);
  };
  const handleQrScan = (code) => { setScannerOpen(false); void performCheckIn(code); };

  return (
    <div className="staff-checkin-shell">
      <header className="staff-header"><div className="header-brand"><div className="brand-mark compact" aria-hidden="true"><span/><span/><span/></div><div><strong>EVENT MANAGER AI</strong><span>Check-in Workspace</span></div></div><div className="user-actions"><div className="user-copy"><strong>{currentUser.full_name}</strong><span className="role-badge">STAFF</span></div><button type="button" className="secondary-button" onClick={onLogout}>Logout</button></div></header>
      <main className="staff-checkin-main">
        <section className="staff-checkin-card">
          <div><p className="eyebrow">VENUE OPERATIONS</p><h1>Event Check-in</h1><p>Verify attendee tickets at the venue.</p></div>
          {loading ? <div className="compact-state"><div className="app-loader"/><p>Loading published events...</p></div> : pageError ? <div className="inline-message error-message">{pageError}</div> : events.length === 0 ? <div className="compact-state"><strong>No published events available.</strong></div> : <><div className="editor-field"><label htmlFor="checkin-event">Event</label><select id="checkin-event" value={selectedId} onChange={(event) => changeEvent(event.target.value)} disabled={submitting || scannerOpen}>{events.map((item) => <option key={item.id} value={item.id}>{item.title} · {dateLabel(item.start_time)}</option>)}</select></div>{selectedEvent && <div className="checkin-event-context"><p className="eyebrow">SELECTED EVENT</p><h2>{selectedEvent.title}</h2><strong>{selectedEvent.location}</strong><span>{dateLabel(selectedEvent.start_time)} · {clock(selectedEvent.start_time)} – {clock(selectedEvent.end_time)}</span></div>}<div className="scanner-entry"><button type="button" className="primary-button scan-qr-button" onClick={openScanner} disabled={submitting || scannerOpen || !selectedEvent}>Scan QR</button>{!selectedEvent && <small>Select an event before scanning a ticket.</small>}</div><div className="manual-divider"><span>or enter manually</span></div><form className="checkin-form" onSubmit={submit}><div className="editor-field"><label htmlFor="ticket-code">Ticket code</label><input ref={inputRef} id="ticket-code" type="text" autoComplete="off" spellCheck={false} placeholder="EVT_xxxxxxxxxxxxxxxxx" value={ticketCode} onChange={(event) => { setTicketCode(event.target.value); setResult(null); }} disabled={submitting} maxLength={64}/></div><button type="submit" className="primary-button checkin-button" disabled={submitting || !selectedEvent}>{submitting ? "Checking in..." : "Check In"}</button></form><div className="checkin-result" aria-live="polite">{result?.type === "success" && <div className="checkin-success"><p className="eyebrow">CHECK-IN SUCCESSFUL</p><h3>✓ Check-in successful</h3><p>The ticket has been verified and attendance was recorded.</p><span>Checked in at: {literal(result.data.checked_in_at).replace("T", " ")}</span><button type="button" className="primary-button result-scan-button" onClick={openScanner}>Scan Next Ticket</button></div>}{result?.type === "error" && <div className="checkin-error"><strong>Check-in unsuccessful</strong><p>{result.message}</p><button type="button" className="secondary-button result-scan-button" onClick={openScanner} disabled={!selectedEvent}>Scan Again</button></div>}</div></>}
        </section>
        {selectedEvent && <div className="staff-event-ai"><EventAIChat key={`staff-ai-${selectedEvent.id}`} event={selectedEvent} token={token} onUnauthorized={onUnauthorized}/></div>}
      </main>
      {scannerOpen && <QRScanner onScan={handleQrScan} onClose={() => setScannerOpen(false)}/>}</div>
  );
}

export default StaffCheckInPage;
