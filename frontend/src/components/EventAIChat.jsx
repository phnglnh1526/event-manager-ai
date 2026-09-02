import React, { useEffect, useRef, useState } from "react";

import { askEventAI } from "../services/api";

const SUGGESTIONS = [
  "Thời gian bắt đầu sự kiện là bao giờ?",
  "Sự kiện được tổ chức ở đâu?",
  "Có những diễn giả nào?",
  "Lịch trình sự kiện gồm những gì?",
];

function friendlyError(error) {
  if (error.status === 401) return "Your session has expired. Please sign in again.";
  if (error.status === 403) return "You are not allowed to ask about this event.";
  if (error.status === 404) return "This event is no longer available.";
  if (error.status === 422) return "Please enter a valid question of up to 500 characters.";
  if (error.status === 502) return "The AI service is temporarily unavailable. Please try again.";
  if (error.status === 503) return "AI is not configured for this environment.";
  if (error.status === 0) return "Unable to connect to the server.";
  return "Unable to answer this question right now.";
}

function EventAIChat({ event, token, onUnauthorized, onClose }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controllerRef = useRef(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    inFlightRef.current = false;
    setQuestion("");
    setMessages([]);
    setLoading(false);
    setError("");
    return () => controllerRef.current?.abort();
  }, [event.id]);

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

  const submit = (submitEvent) => {
    submitEvent.preventDefault();
    void sendQuestion(question);
  };

  return (
    <section className="event-ai-chat" aria-labelledby={`event-ai-title-${event.id}`}>
      <div className="event-ai-heading">
        <div>
          <p className="eyebrow">EVENT AI ASSISTANT</p>
          <h3 id={`event-ai-title-${event.id}`}>Ask AI about this event</h3>
          <div className="event-ai-context">
            <span>ASK AI ABOUT</span>
            <strong>{event.title}</strong>
          </div>
        </div>
        {onClose && <button type="button" className="text-button" onClick={onClose} disabled={loading}>Close</button>}
      </div>

      <div className="event-ai-conversation" aria-live="polite" aria-busy={loading}>
        <article className="event-ai-message ai">
          <span>AI</span>
          <p>Bạn có thể hỏi tôi về thời gian, địa điểm, diễn giả và lịch trình của sự kiện này.</p>
        </article>
        {messages.map((message) => (
          <article className={`event-ai-message ${message.role}`} key={message.id}>
            <span>{message.role === "user" ? "You" : "AI"}</span>
            <p>{message.text}</p>
            {message.source && (
              <small className={`event-ai-source source-${message.source}`} title={`Answer source: ${message.source}`}>
                {message.source === "openai" ? "OpenAI" : "Mock Mode"}
              </small>
            )}
          </article>
        ))}
        {loading && <div className="event-ai-thinking"><span className="app-loader" />AI is thinking...</div>}
      </div>

      <div className="event-ai-suggestions" aria-label="Suggested questions">
        <p>Try a suggested question</p>
        {SUGGESTIONS.map((suggestion) => (
          <button type="button" key={suggestion} onClick={() => void sendQuestion(suggestion)} disabled={loading}>
            {suggestion}
          </button>
        ))}
      </div>

      {error && <div className="inline-message error-message event-ai-error" role="alert">{error}</div>}

      <form className="event-ai-form" onSubmit={submit}>
        <label className="sr-only" htmlFor={`event-ai-question-${event.id}`}>Ask a question about {event.title}</label>
        <input
          id={`event-ai-question-${event.id}`}
          type="text"
          value={question}
          onChange={(inputEvent) => { setQuestion(inputEvent.target.value); setError(""); }}
          placeholder="Ask a question..."
          maxLength={500}
          disabled={loading}
        />
        <button type="submit" className="primary-button" disabled={loading || !question.trim()}>
          {loading ? "Sending..." : "Send"}
        </button>
      </form>
    </section>
  );
}

export default EventAIChat;
