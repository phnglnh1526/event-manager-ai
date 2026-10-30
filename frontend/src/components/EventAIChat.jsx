import React, { useEffect, useRef, useState } from "react";
import { AIBadge, AIError, AIIcon, AILoading } from "./AIComponents";
import { askEventAI } from "../services/api";

const SUGGESTIONS = [
  "Thời gian bắt đầu sự kiện là bao giờ?",
  "Sự kiện được tổ chức ở đâu?",
  "Có những diễn giả nào tham gia?",
  "Lịch trình chi tiết sự kiện gồm những gì?",
];

function friendlyError(error) {
  if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (error.status === 403) return "Bạn không có quyền hỏi về sự kiện này.";
  if (error.status === 404) return "Sự kiện này không còn khả dụng.";
  if (error.status === 422) return "Vui lòng nhập câu hỏi hợp lệ không quá 500 ký tự.";
  if (error.status === 502) return "Dịch vụ AI tạm thời không phản hồi. Vui lòng thử lại.";
  if (error.status === 503) return "Dịch vụ AI chưa được cấu hình cho môi trường này.";
  if (error.status === 0) return "Không thể kết nối đến máy chủ.";
  return "Không thể phân tích dữ liệu.";
}

function EventAIChat({ event, token, onUnauthorized, onClose }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const controllerRef = useRef(null);
  const inFlightRef = useRef(false);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    inFlightRef.current = false;
    setQuestion("");
    setMessages([
      {
        id: "initial-ai",
        role: "ai",
        text: `Xin chào! Tôi là Trợ lý sự kiện AI. Tôi có thể giải đáp cho bạn về thời gian, địa điểm, các diễn giả và toàn bộ lịch trình của sự kiện "${event.title}". Bạn muốn tìm hiểu thông tin gì?`,
        source: "system",
      },
    ]);
    setLoading(false);
    setError("");
    setLastQuestion("");
    return () => controllerRef.current?.abort();
  }, [event.id, event.title]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, error]);

  const sendQuestion = async (candidate) => {
    const cleanQuestion = candidate.trim();
    if (!cleanQuestion || inFlightRef.current) return;
    const requestedEventId = event.id;
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    inFlightRef.current = true;
    setLoading(true);
    setError("");
    setLastQuestion(cleanQuestion);
    setQuestion("");
    setMessages((current) => [
      ...current,
      { id: `${Date.now()}-user`, role: "user", text: cleanQuestion },
    ]);

    try {
      const response = await askEventAI(
        requestedEventId,
        cleanQuestion,
        token,
        controller.signal,
      );
      if (controller.signal.aborted || requestedEventId !== event.id) return;
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-ai`,
          role: "ai",
          text: response.answer,
          source: response.source,
        },
      ]);
    } catch (requestError) {
      if (requestError.name === "AbortError" || controller.signal.aborted) return;
      if (requestError.status === 401) onUnauthorized();
      else setError(friendlyError(requestError));
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        inFlightRef.current = false;
        setLoading(false);
      }
    }
  };

  const handleRetry = () => {
    if (lastQuestion && !inFlightRef.current) {
      setError("");
      void sendQuestion(lastQuestion);
    }
  };

  const submit = (submitEvent) => {
    submitEvent.preventDefault();
    void sendQuestion(question);
  };

  return (
    <section className="event-ai-chat ai-card" aria-labelledby={`event-ai-title-${event.id}`}>
      {/* Header */}
      <div className="event-ai-heading">
        <div className="event-ai-title-wrap">
          <AIIcon size="default" />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h3 id={`event-ai-title-${event.id}`} style={{ margin: 0, fontSize: "0.95rem", color: "var(--text-primary)", fontWeight: 700 }}>
                Trợ lý sự kiện AI
              </h3>
              <AIBadge label="Online" />
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Hỏi về: <strong style={{ color: "var(--primary)" }}>{event.title}</strong>
            </span>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            className="attendee-detail-close"
            style={{ position: "static", width: 32, height: 32 }}
            onClick={onClose}
            disabled={loading}
            aria-label="Đóng Trợ lý AI"
          >
            ✕
          </button>
        )}
      </div>

      {/* Conversation Area */}
      <div className="event-ai-conversation" aria-live="polite" aria-busy={loading}>
        {messages.map((message) => (
          <article className={`event-ai-message ${message.role}`} key={message.id}>
            <div className="event-ai-avatar-badge" aria-hidden="true">
              {message.role === "user" ? "Bạn" : "AI"}
            </div>
            <div className="event-ai-bubble">
              <p>{message.text}</p>
              {message.source && message.source !== "system" && (
                <div style={{ marginTop: "0.45rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Nguồn:</span>
                  <AIBadge source={message.source} />
                </div>
              )}
            </div>
          </article>
        ))}

        {/* Standardized Typing State */}
        {loading && (
          <AILoading text="Đang phân tích dữ liệu sự kiện..." />
        )}

        {/* Standardized Error State with Retry */}
        {error && (
          <AIError
            message={error}
            onRetry={lastQuestion ? handleRetry : undefined}
          />
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Suggestion Chips */}
      <div className="event-ai-suggestions" aria-label="Gợi ý câu hỏi">
        <p>Gợi ý:</p>
        {SUGGESTIONS.map((suggestion) => (
          <button
            type="button"
            key={suggestion}
            className="event-ai-suggestion-btn"
            onClick={() => void sendQuestion(suggestion)}
            disabled={loading || inFlightRef.current}
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* Input Form with Anti-double-click protection */}
      <form className="event-ai-form" onSubmit={submit}>
        <label className="sr-only" htmlFor={`event-ai-question-${event.id}`}>
          Đặt câu hỏi về {event.title}
        </label>
        <input
          id={`event-ai-question-${event.id}`}
          type="text"
          value={question}
          onChange={(inputEvent) => {
            setQuestion(inputEvent.target.value);
            setError("");
          }}
          placeholder="Nhập câu hỏi về lịch trình, diễn giả, địa điểm..."
          maxLength={500}
          disabled={loading}
        />
        <button
          type="submit"
          className="ai-button-primary"
          disabled={loading || inFlightRef.current || !question.trim()}
          style={{ minWidth: 64, padding: "0.6rem 1rem", justifyContent: "center" }}
        >
          {loading ? (
            <span className="app-loader" style={{ width: 14, height: 14, margin: 0 }} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </form>
    </section>
  );
}

export default EventAIChat;
