import React, { useEffect, useRef, useState } from "react";

import EventAIChat from "../components/EventAIChat";
import QRScanner from "../components/QRScanner";
import WorkspaceHeader from "../components/WorkspaceHeader";
import useAutoRefresh from "../hooks/useAutoRefresh";
import { checkInTicket, getCheckInEvents } from "../services/api";

const literal = (value) => (typeof value === "string" ? value.slice(0, 16) : "");
const dateLabel = (value) => {
  const item = literal(value);
  return item ? `${item.slice(8, 10)}/${item.slice(5, 7)}/${item.slice(0, 4)}` : "—";
};
const clock = (value) => literal(value).slice(11, 16) || "—";

function StaffCheckInPage({ token, currentUser, onLogout, onUnauthorized, onProfile }) {
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
      .then((items) => {
        setEvents(items);
        setSelectedId(items.length ? String(items[0].id) : "");
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        if (error.status === 401) onUnauthorized();
        else
          setPageError(
            error.status === 403
              ? "Bạn không có quyền check-in người tham dự."
              : error.status === 0
              ? "Không thể kết nối đến máy chủ."
              : "Không thể tải danh sách sự kiện cho check-in."
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, onUnauthorized]);

  // Near real-time auto-refresh: re-fetches check-in events list periodically and on tab focus
  useAutoRefresh(
    () => {
      if (submitting || inFlight.current) return;
      getCheckInEvents(token)
        .then((items) => {
          setEvents(items);
          setSelectedId((current) => (items.some((i) => String(i.id) === current) ? current : items.length ? String(items[0].id) : ""));
        })
        .catch(() => {});
    },
    { interval: 20000, enabled: !submitting }
  );

  // Keep input focused for instant barcode/keyboard scanning
  useEffect(() => {
    if (!loading && !scannerOpen) {
      inputRef.current?.focus();
    }
  }, [loading, scannerOpen]);

  const selectedEvent = events.find((item) => String(item.id) === selectedId) || null;

  const changeEvent = (value) => {
    if (scannerOpen || submitting) return;
    setSelectedId(value);
    setTicketCode("");
    setResult(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const mapError = (error) => {
    if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    if (error.status === 403) return "Bạn không có quyền thực hiện check-in cho sự kiện này.";
    if (error.status === 404) return "Vé không hợp lệ hoặc vé không thuộc sự kiện này.";
    if (error.status === 422) return "Mã vé không đúng định dạng.";
    if (error.status === 0) return "Lỗi kết nối mạng: Không thể kết nối đến máy chủ.";
    if (error.status === 409) {
      if (error.message === "Ticket already checked in") return "Vé này đã được check-in trước đó.";
      if (error.message === "Ticket is not active") return "Vé đã bị vô hiệu hóa (VOID) hoặc không còn hoạt động.";
      if (error.message === "Registration is not active") return "Đăng ký của người tham dự đã bị hủy.";
      if (error.message === "Event is not open for check-in") return "Sự kiện hiện chưa mở cổng soát vé.";
    }
    return error.message || "Không thể hoàn tất check-in.";
  };

  const performCheckIn = async (candidate) => {
    if (inFlight.current) return;
    const code = candidate.trim();
    const event = selectedEvent;

    if (!event) {
      setResult({ type: "error", title: "Chưa chọn sự kiện", message: "Vui lòng chọn sự kiện trước khi soát vé." });
      return;
    }
    if (!code) {
      setResult({ type: "error", title: "Thiếu mã vé", message: "Vui lòng quét hoặc nhập mã vé." });
      inputRef.current?.focus();
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setResult(null);

    try {
      const data = await checkInTicket(event.id, code, token);
      setTicketCode("");
      setResult({
        type: "success",
        ticketCode: code,
        data,
      });
    } catch (error) {
      if (error.status === 401) onUnauthorized();
      else {
        setResult({
          type: "error",
          title: "Check-in không thành công",
          message: mapError(error),
          failedCode: code,
        });
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    void performCheckIn(ticketCode);
  };

  const openScanner = () => {
    if (!selectedEvent) {
      setResult({ type: "error", title: "Chưa chọn sự kiện", message: "Vui lòng chọn sự kiện trước khi quét mã vé." });
      return;
    }
    if (submitting) return;
    setResult(null);
    setScannerOpen(true);
  };

  const handleQrScan = (code) => {
    setScannerOpen(false);
    void performCheckIn(code);
  };

  const focusInputNext = () => {
    setResult(null);
    setTicketCode("");
    inputRef.current?.focus();
  };

  return (
    <div className="staff-checkin-shell dashboard-shell">
      <WorkspaceHeader
        currentUser={currentUser}
        activeView="checkin"
        onProfile={onProfile}
        onLogout={onLogout}
        workspaceLabel="Trạm soát vé & Check-in"
      />

      <main className="dashboard-main staff-checkin-main" style={{ maxWidth: 1180, margin: "0 auto", padding: "1.5rem 1rem" }}>
        <section className="events-page-header">
          <div>
            <p className="hero-eyebrow">VẬN HÀNH ĐỊA ĐIỂM · TỐC ĐỘ CAO</p>
            <h1>Check-in Sự kiện</h1>
            <p>Hệ thống quét mã QR và xác thực vé người tham dự theo thời gian thực.</p>
          </div>
        </section>

        {loading ? (
          <div className="state-panel">
            <div className="app-loader" />
            <p>Đang tải danh sách sự kiện mở cổng check-in...</p>
          </div>
        ) : pageError ? (
          <div className="state-panel error-panel">
            <strong>Không thể tải dữ liệu check-in</strong>
            <p>{pageError}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="state-panel">
            <strong>Chưa có sự kiện nào mở cổng check-in.</strong>
            <p>Chỉ các sự kiện ở trạng thái Đã công bố (PUBLISHED) mới có thể soát vé.</p>
          </div>
        ) : (
          <div className="checkin-workspace-grid">
            {/* Left Control Card: Event picker, QR Scanner, Fast Input, Result */}
            <div className="checkin-control-card">
              {/* Event Picker */}
              <div className="checkin-event-picker">
                <label htmlFor="checkin-event-select">1. Chọn sự kiện soát vé</label>
                <select
                  id="checkin-event-select"
                  className="checkin-event-select"
                  value={selectedId}
                  onChange={(e) => changeEvent(e.target.value)}
                  disabled={submitting || scannerOpen}
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} · {dateLabel(ev.start_time)} ({ev.location})
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Event Context Bar */}
              {selectedEvent && (
                <div className="checkin-selected-event-bar">
                  <div className="checkin-event-meta-items">
                    <span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {dateLabel(selectedEvent.start_time)}
                    </span>
                    <span>•</span>
                    <span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {clock(selectedEvent.start_time)} – {clock(selectedEvent.end_time)}
                    </span>
                    <span>•</span>
                    <span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {selectedEvent.location}
                    </span>
                  </div>
                  <span className="status-badge status-active" style={{ fontSize: "0.72rem" }}>
                    Cổng check-in mở
                  </span>
                </div>
              )}

              {/* QR Scanner Trigger */}
              <div className="checkin-input-hero-group">
                <button
                  type="button"
                  className="checkin-scanner-trigger-btn"
                  onClick={openScanner}
                  disabled={submitting || scannerOpen || !selectedEvent}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  Bật Camera Quét Mã QR
                </button>

                <div className="manual-divider" style={{ textAlign: "center", margin: "0.25rem 0", color: "var(--text-muted)", fontSize: "0.78rem" }}>
                  <span>— HOẶC QUÉT BẰNG MÁY BARCODE / NHẬP TAY —</span>
                </div>

                {/* Big Fast Input for Handheld Scanner or Manual typing */}
                <form onSubmit={submit}>
                  <label htmlFor="ticket-code-input" style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.4rem", display: "block" }}>
                    2. Mã vé người tham dự (Ticket Code)
                  </label>
                  <div className="checkin-fast-input-wrapper">
                    <input
                      ref={inputRef}
                      id="ticket-code-input"
                      type="text"
                      className="checkin-ticket-code-input"
                      placeholder="EVT_xxxxxxxxxxxxxxxxx"
                      autoComplete="off"
                      spellCheck={false}
                      value={ticketCode}
                      onChange={(e) => {
                        setTicketCode(e.target.value);
                        setResult(null);
                      }}
                      disabled={submitting}
                      maxLength={64}
                    />
                    <button
                      type="submit"
                      className="checkin-submit-btn"
                      disabled={submitting || !selectedEvent || !ticketCode.trim()}
                    >
                      {submitting ? "Đang xử lý..." : "Check-in (Enter)"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Check-In Result Area */}
              {result && (
                <div className="checkin-result-display" aria-live="polite">
                  {/* SUCCESS STATE */}
                  {result.type === "success" && (
                    <div className="checkin-success-hero">
                      <div className="checkin-success-head">
                        <div className="checkin-success-icon">✓</div>
                        <div>
                          <p className="hero-eyebrow" style={{ color: "var(--success)", borderColor: "var(--success)" }}>
                            XÁC THỰC THÀNH CÔNG
                          </p>
                          <h3 className="checkin-success-title">Check-in Hợp lệ!</h3>
                        </div>
                      </div>

                      <div className="checkin-success-details">
                        <div>
                          <span>Sự kiện</span>
                          <strong>{selectedEvent?.title}</strong>
                        </div>
                        <div>
                          <span>Thời gian ghi nhận</span>
                          <strong>{literal(result.data.checked_in_at).replace("T", " ")}</strong>
                        </div>
                        <div>
                          <span>Mã vé đã quét</span>
                          <strong style={{ fontFamily: "monospace", color: "var(--success)" }}>
                            {result.ticketCode}
                          </strong>
                        </div>
                        <div>
                          <span>Lượt check-in ID</span>
                          <strong>#{result.data.id} (Hợp lệ)</strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="primary-button"
                        onClick={focusInputNext}
                        style={{ alignSelf: "flex-start", background: "var(--success)", color: "#ffffff", fontWeight: 800 }}
                      >
                        Quét vé tiếp theo (Phím cách / Click)
                      </button>
                    </div>
                  )}

                  {/* ERROR STATE */}
                  {result.type === "error" && (
                    <div className="checkin-error-hero">
                      <div className="checkin-error-head">
                        <div className="checkin-error-icon">✕</div>
                        <div>
                          <p className="hero-eyebrow" style={{ color: "var(--error)", borderColor: "var(--error)" }}>
                            TỪ CHỐI CHECK-IN
                          </p>
                          <h3 className="checkin-error-title">{result.title}</h3>
                        </div>
                      </div>

                      <p className="checkin-error-msg">{result.message}</p>

                      {result.failedCode && (
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          Mã vé vừa nhập: <code style={{ color: "var(--error)" }}>{result.failedCode}</code>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={focusInputNext}
                        >
                          Nhập lại
                        </button>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={openScanner}
                          disabled={!selectedEvent}
                        >
                          Quét mã khác
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Helper: AI Event Chatbot for Staff */}
            {selectedEvent && (
              <div className="staff-event-ai" style={{ position: "sticky", top: "1.5rem" }}>
                <EventAIChat
                  key={`staff-ai-${selectedEvent.id}`}
                  event={selectedEvent}
                  token={token}
                  onUnauthorized={onUnauthorized}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* QR Scanner Modal Overlay */}
      {scannerOpen && (
        <QRScanner onScan={handleQrScan} onClose={() => setScannerOpen(false)} />
      )}
    </div>
  );
}

export default StaffCheckInPage;
