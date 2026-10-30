import React, { useEffect, useRef, useState } from "react";
import { getMyTicket, getMyTicketQr, getMyTickets } from "../services/api";
import { TICKET_STATUS_LABELS } from "../locales/vi";

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

const mask = (code) =>
  !code ? "—" : code.length <= 8 ? code : `${code.slice(0, 4)}••••••••${code.slice(-4)}`;

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
    getMyTickets(token, controller.signal)
      .then(setTickets)
      .catch((e) => {
        if (e.name === "AbortError") return;
        if (e.status === 401) onUnauthorized();
        else
          setError(
            e.status === 403
              ? "Bạn không có quyền truy cập vé."
              : e.status === 0
              ? "Không thể kết nối đến máy chủ."
              : "Không thể tải danh sách vé."
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, onUnauthorized]);

  useEffect(() => () => { if (qrUrl) URL.revokeObjectURL(qrUrl); }, [qrUrl]);
  useEffect(() => () => qrController.current?.abort(), []);

  const registrationMap = new Map(registrations.map((item) => [item.id, item]));
  const eventMap = new Map(events.map((item) => [item.id, item]));
  const eventName = (ticket) => {
    const registration = registrationMap.get(ticket.registration_id);
    return registration
      ? eventMap.get(registration.event_id)?.title || `Sự kiện #${registration.event_id}`
      : "Sự kiện không còn khả dụng";
  };

  const closeQr = () => {
    qrController.current?.abort();
    setQrUrl(null);
    setQrTicketId(null);
    setQrError("");
    setQrLoading(false);
  };

  const openDetail = async (id) => {
    const seq = ++detailSeq.current;
    setDetailLoading(true);
    setDetailError("");
    try {
      const item = await getMyTicket(id, token);
      if (seq === detailSeq.current) setDetail(item);
    } catch (e) {
      if (seq !== detailSeq.current) return;
      if (e.status === 401) onUnauthorized();
      else
        setDetailError(
          e.status === 404
            ? "Không tìm thấy vé."
            : e.status === 403
            ? "Bạn không có quyền truy cập vé này."
            : "Không thể tải thông tin vé."
        );
    } finally {
      if (seq === detailSeq.current) setDetailLoading(false);
    }
  };

  const showQr = async (ticket) => {
    if (ticket.status !== "ACTIVE") return;
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
      else
        setQrError(
          e.status === 404
            ? "Không tìm thấy vé."
            : e.status === 403
            ? "Bạn không có quyền truy cập vé này."
            : e.status === 409
            ? "Vé này không còn hoạt động."
            : e.status === 0
            ? "Không thể kết nối đến máy chủ."
            : "Không thể tải mã QR."
        );
    } finally {
      if (seq === qrSeq.current) setQrLoading(false);
    }
  };

  if (loading)
    return (
      <div className="state-panel">
        <div className="app-loader" />
        <p>Đang tải danh sách vé sự kiện...</p>
      </div>
    );

  if (error)
    return (
      <div className="state-panel error-panel">
        <strong>Không thể tải vé</strong>
        <p>{error}</p>
      </div>
    );

  return (
    <section className="my-tickets" aria-label="Vé sự kiện của tôi">
      <div className="attendee-page-header">
        <div className="attendee-page-header-content">
          <span className="eyebrow">QUYỀN TRUY CẬP SỰ KIỆN</span>
          <h1>Vé của tôi</h1>
          <p>Xem vé điện tử và xuất trình mã QR hợp lệ cho nhân viên soát vé tại sự kiện.</p>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="state-panel">
          <div className="ai-sparkle-icon" style={{ margin: "0 auto 0.75rem", width: 44, height: 44 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <circle cx="12" cy="12" r="2" />
              <path d="M6 12h.01M18 12h.01" />
            </svg>
          </div>
          <strong>Bạn chưa sở hữu vé sự kiện nào.</strong>
          <p>Đăng ký tham gia các sự kiện đang mở để nhận vé điện tử kèm mã QR check-in.</p>
          <button className="primary-button" onClick={onBrowseEvents} style={{ marginTop: "0.5rem" }}>
            Khám phá sự kiện ngay
          </button>
        </div>
      ) : (
        <div className="ticket-layout">
          {/* Digital Tickets Grid */}
          <div className="digital-ticket-container">
            {tickets.map((ticket) => {
              const statusClass = `ticket-status-${ticket.status.toLowerCase()}`;
              const isSelected = detail?.id === ticket.id;

              return (
                <article
                  key={ticket.id}
                  className={`digital-ticket-card ${isSelected ? "selected" : ""}`}
                >
                  {/* Top Glow Bar */}
                  <div className="ticket-card-top">
                    <span className="ticket-brand">EVENT MANAGER AI · PASS</span>
                    <span className={`ticket-status-pill ${statusClass}`}>
                      {TICKET_STATUS_LABELS[ticket.status] || ticket.status}
                    </span>
                  </div>

                  {/* Main Ticket Content */}
                  <div className="ticket-card-content">
                    <h3 className="ticket-event-title">{eventName(ticket)}</h3>

                    <div className="ticket-meta-grid">
                      <div className="ticket-meta-block">
                        <span>Ngày cấp</span>
                        <strong>{display(ticket.issued_at)}</strong>
                      </div>
                      <div className="ticket-meta-block">
                        <span>Mã vé</span>
                        <strong style={{ fontFamily: "monospace" }}>{mask(ticket.ticket_code)}</strong>
                      </div>
                    </div>

                    {ticket.status === "VOID" && (
                      <div className="inline-message error-message" style={{ margin: 0, padding: "0.4rem 0.65rem", fontSize: "0.75rem" }}>
                        Vé này đã bị vô hiệu hóa (VOID).
                      </div>
                    )}
                    {ticket.status === "USED" && (
                      <div className="inline-message success-message" style={{ margin: 0, padding: "0.4rem 0.65rem", fontSize: "0.75rem" }}>
                        ✓ Vé đã được check-in thành công.
                      </div>
                    )}
                  </div>

                  {/* Perforation Cutouts */}
                  <div className="ticket-perforation" aria-hidden="true">
                    <div className="ticket-notch-left" />
                    <div className="ticket-dash-line" />
                    <div className="ticket-notch-right" />
                  </div>

                  {/* Stub Bottom with Actions */}
                  <div className="ticket-card-footer">
                    <div className="ticket-barcode-box">
                      <span style={{ fontSize: "0.68rem", color: "#64748b", textTransform: "uppercase" }}>
                        Pass ID
                      </span>
                      <span className="ticket-code-mono">#{ticket.id}</span>
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        onClick={() => openDetail(ticket.id)}
                      >
                        Chi tiết
                      </button>
                      {ticket.status === "ACTIVE" && (
                        <button
                          type="button"
                          className="primary-button compact-button"
                          onClick={() => showQr(ticket)}
                          disabled={qrLoading && qrTicketId === ticket.id}
                        >
                          {qrLoading && qrTicketId === ticket.id ? "Đang tải QR..." : "Mã QR"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Ticket Detail / QR Preview Drawer / Panel */}
          {(detail || detailLoading || detailError || qrTicketId) && (
            <aside className="ticket-detail-panel" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.4rem", boxShadow: "var(--shadow-md)" }}>
              {detailLoading ? (
                <div className="compact-state"><div className="app-loader" /><p>Đang tải thông tin vé...</p></div>
              ) : detail ? (
                <>
                  <div className="editor-heading" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem", marginBottom: "1rem" }}>
                    <div>
                      <p className="hero-eyebrow" style={{ margin: 0 }}>CHI TIẾT VÉ ĐIỆN TỬ</p>
                      <h3 style={{ margin: "0.2rem 0 0", color: "var(--text-primary)" }}>{eventName(detail)}</h3>
                    </div>
                    <button type="button" className="event-modal-close-btn" onClick={() => setDetail(null)}>
                      ✕
                    </button>
                  </div>

                  <dl className="speaker-detail-grid" style={{ marginBottom: "1.25rem" }}>
                    <div className="speaker-detail-item">
                      <dt>Trạng thái vé</dt>
                      <dd>
                        <span className={`ticket-status-pill ticket-status-${detail.status.toLowerCase()}`}>
                          {TICKET_STATUS_LABELS[detail.status] || detail.status}
                        </span>
                      </dd>
                    </div>
                    <div className="speaker-detail-item">
                      <dt>Ngày phát hành</dt>
                      <dd>{display(detail.issued_at)}</dd>
                    </div>
                    <div className="speaker-detail-item" style={{ gridColumn: "1 / -1" }}>
                      <dt>Mã vé bảo mật (Full Code)</dt>
                      <dd style={{ fontFamily: "monospace", color: "var(--primary)", fontWeight: 700, wordBreak: "break-all" }}>
                        {detail.ticket_code}
                      </dd>
                    </div>
                    <div className="speaker-detail-item">
                      <dt>Cập nhật lần cuối</dt>
                      <dd>{display(detail.updated_at)}</dd>
                    </div>
                  </dl>
                </>
              ) : null}

              {detailError && <div className="inline-message error-message">{detailError}</div>}

              {/* QR Code Panel */}
              {qrTicketId && (
                <div className="qr-panel" style={{ marginTop: "1rem", textAlign: "center", background: "var(--surface-muted)", border: "1px solid var(--border)", borderRadius: 12, padding: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <strong style={{ color: "var(--text-primary)", fontSize: "0.95rem" }}>Mã QR Check-in</strong>
                    <button type="button" className="event-modal-close-btn" onClick={closeQr}>✕</button>
                  </div>

                  {qrLoading && (
                    <div className="compact-state"><div className="app-loader" /><p>Đang tạo mã QR bảo mật...</p></div>
                  )}

                  {qrError && (
                    <div className="inline-message error-message">{qrError}</div>
                  )}

                  {qrUrl && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{ background: "#ffffff", padding: "12px", borderRadius: "12px", boxShadow: "var(--shadow-md)" }}>
                        <img src={qrUrl} alt="Mã QR vé sự kiện" style={{ width: 180, height: 180, display: "block" }} />
                      </div>
                      <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0, maxWidth: 260 }}>
                        Xuất trình mã QR này cho nhân viên soát vé tại cửa sự kiện.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>
      )}
    </section>
  );
}

export default MyTickets;
