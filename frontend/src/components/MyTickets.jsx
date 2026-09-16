import React, { useEffect, useRef, useState } from "react";
import { getMyTicket, getMyTicketQr, getMyTickets } from "../services/api";

const display = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};
const mask = (code) => !code ? "—" : code.length <= 8 ? code : `${code.slice(0, 4)}••••••••${code.slice(-4)}`;

function MyTickets({ token, events, registrations, onUnauthorized, onBrowseEvents }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [qrUrl, setQrUrl] = useState(null);
  const [qrTicketId, setQrTicketId] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const detailSeq = useRef(0);
  const qrSeq = useRef(0);
  const qrController = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getMyTickets(token, controller.signal)
      .then(setTickets)
      .catch((e) => {
        if (e.name === "AbortError") return;
        if (e.status === 401) onUnauthorized();
        else setError(e.status === 403 ? "You do not have permission to access tickets." : e.status === 0 ? "Unable to connect to the server." : "Unable to load tickets.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, onUnauthorized]);

  useEffect(() => () => qrController.current?.abort(), []);
  useEffect(() => () => { if (qrUrl) URL.revokeObjectURL(qrUrl); }, [qrUrl]);

  const registrationMap = new Map(registrations.map((item) => [item.id, item]));
  const eventMap = new Map(events.map((item) => [item.id, item]));

  const getRegistration = (ticket) => registrationMap.get(ticket.registration_id);
  const eventName = (ticket) => {
    const registration = getRegistration(ticket);
    if (!registration) return "Event unavailable";
    return registration.event_title || eventMap.get(registration.event_id)?.title || `Event #${registration.event_id}`;
  };
  const isCheckedIn = (ticket) => getRegistration(ticket)?.status === "CHECKED_IN";

  const closeModal = () => {
    detailSeq.current += 1;
    qrSeq.current += 1;
    qrController.current?.abort();
    setDetail(null);
    setDetailError("");
    setDetailLoading(false);
    if (qrUrl) URL.revokeObjectURL(qrUrl);
    setQrUrl(null);
    setQrTicketId(null);
    setQrLoading(false);
    setQrError("");
  };

  const openDetail = async (ticketId) => {
    const seq = ++detailSeq.current;
    setDetail(null);
    setDetailLoading(true);
    setDetailError("");
    try {
      const item = await getMyTicket(ticketId, token);
      if (seq === detailSeq.current) setDetail(item);
    } catch (e) {
      if (seq !== detailSeq.current) return;
      if (e.status === 401) onUnauthorized();
      else setDetailError(e.status === 404 ? "Ticket not found." : e.status === 403 ? "You do not have permission to access this ticket." : e.message || "Unable to load ticket information.");
    } finally {
      if (seq === detailSeq.current) setDetailLoading(false);
    }
  };

  const showQr = async (ticket) => {
    if (ticket.status !== "ACTIVE" || isCheckedIn(ticket)) return;
    qrController.current?.abort();
    setQrUrl(null);
    setQrTicketId(ticket.id);
    setQrError("");
    setQrLoading(true);
    const controller = new AbortController();
    qrController.current = controller;
    const seq = ++qrSeq.current;
    try {
      const blob = await getMyTicketQr(ticket.id, token, controller.signal);
      if (seq !== qrSeq.current || controller.signal.aborted) return;
      setQrUrl(URL.createObjectURL(blob));
    } catch (e) {
      if (e.name === "AbortError" || seq !== qrSeq.current) return;
      if (e.status === 401) onUnauthorized();
      else setQrError(e.status === 404 ? "Ticket not found." : e.status === 403 ? "You do not have permission to access this ticket." : e.status === 409 ? "This ticket is no longer active." : e.message || "Unable to load the QR code.");
    } finally {
      if (seq === qrSeq.current) setQrLoading(false);
    }
  };

  if (loading) return <div className="state-panel"><div className="app-loader" /><p>Loading tickets...</p></div>;
  if (error) return <div className="state-panel error-panel"><strong>Unable to load tickets</strong><p>{error}</p></div>;

  return (
    <section className="my-tickets">
      <div className="dashboard-title-row">
        <div>
          <p className="eyebrow">EVENT ACCESS</p>
          <h1>My Tickets</h1>
          <p>All your event tickets stay in one place. Open a ticket to see its full details or show an active QR code.</p>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="state-panel">
          <strong>You do not have any tickets yet.</strong>
          <button className="primary-button" onClick={onBrowseEvents}>Browse Events</button>
        </div>
      ) : (
        <div className="ticket-wallet-grid">
          {tickets.map((ticket) => {
            const checkedIn = isCheckedIn(ticket);
            return (
              <article className="ticket-wallet-card" key={ticket.id}>
                <div className="ticket-wallet-cover">
                  <div className="ticket-wallet-pattern" aria-hidden="true" />
                  <div className="ticket-wallet-brand">EVENT MANAGER AI</div>
                  <span className={`ticket-status status-${checkedIn ? "checked_in" : ticket.status.toLowerCase()}`}>
                    {checkedIn ? "✓ CHECKED IN" : ticket.status}
                  </span>
                </div>

                <div className="ticket-wallet-body">
                  <p className="eyebrow">EVENT TICKET</p>
                  <h2>{eventName(ticket)}</h2>
                  <p className="ticket-wallet-date">Issued {display(ticket.issued_at)}</p>
                  <div className="ticket-wallet-meta">
                    <span>Ticket</span>
                    <strong className="ticket-code">{mask(ticket.ticket_code)}</strong>
                  </div>
                  {checkedIn && (
                    <div className="ticket-checkin-note">
                      <strong>✓ Attendance recorded</strong>
                      <span>This ticket has already been checked in. QR check-in is no longer available.</span>
                    </div>
                  )}
                  {ticket.status === "VOID" && !checkedIn && (
                    <div className="ticket-void-note">This ticket is no longer active.</div>
                  )}
                </div>

                <div className="ticket-wallet-actions">
                  <button className="secondary-button" onClick={() => openDetail(ticket.id)}>View Ticket</button>
                  {ticket.status === "ACTIVE" && !checkedIn && (
                    <button className="primary-button" onClick={() => showQr(ticket)} disabled={qrLoading && qrTicketId === ticket.id}>
                      {qrLoading && qrTicketId === ticket.id ? "Loading QR..." : "Show QR"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {(detail || detailLoading || detailError || qrTicketId) && (
        <div className="ticket-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <section className="ticket-modal" role="dialog" aria-modal="true" aria-labelledby="ticket-modal-title">
            <div className="ticket-modal-header">
              <div>
                <p className="eyebrow">TICKET DETAILS</p>
                {detail && <span className={`ticket-status status-${detail.status.toLowerCase()}`}>{isCheckedIn(detail) ? "✓ CHECKED IN" : detail.status}</span>}
              </div>
              <button className="icon-button" type="button" aria-label="Close ticket details" onClick={closeModal}>×</button>
            </div>

            {detailLoading && <div className="compact-state"><div className="app-loader" /><p>Loading ticket...</p></div>}
            {detailError && <div className="inline-message error-message">{detailError}</div>}

            {detail && (
              <>
                <h2 id="ticket-modal-title">{eventName(detail)}</h2>
                <div className="ticket-detail-highlight">
                  <span>{isCheckedIn(detail) ? "✓ CHECKED IN" : detail.status}</span>
                  <strong>{isCheckedIn(detail) ? "Attendance recorded" : "Ticket ready"}</strong>
                </div>
                <dl className="ticket-detail-list">
                  <div><dt>Ticket code</dt><dd className="ticket-code full">{detail.ticket_code}</dd></div>
                  <div><dt>Issued</dt><dd>{display(detail.issued_at)}</dd></div>
                  <div><dt>Updated</dt><dd>{display(detail.updated_at)}</dd></div>
                </dl>
                {isCheckedIn(detail) && <div className="inline-message success-message">This ticket has already been checked in. It cannot be used for another check-in.</div>}
              </>
            )}

            {qrTicketId && (
              <div className="qr-panel">
                <div className="editor-heading"><h3>QR Code</h3><button className="text-button" onClick={() => { qrController.current?.abort(); if (qrUrl) URL.revokeObjectURL(qrUrl); setQrUrl(null); setQrTicketId(null); setQrError(""); setQrLoading(false); }}>Close QR</button></div>
                {qrLoading && <div className="compact-state"><div className="app-loader" /><p>Loading QR code...</p></div>}
                {qrError && <div className="inline-message error-message">{qrError}</div>}
                {qrUrl && <><img src={qrUrl} alt="QR code for event ticket" /><p>Present this QR code to event staff for check-in.</p></>}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

export default MyTickets;
