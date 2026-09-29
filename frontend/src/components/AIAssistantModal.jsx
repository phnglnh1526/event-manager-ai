import React, { useEffect, useRef, useState } from "react";
import { getAttendeeEvents, getMyTickets, sendPersonalAssistantMessage } from "../services/api";

const QUICK_PROMPTS = [
  { icon: "🔍", label: "Sự kiện sắp diễn ra" },
  { icon: "🎫", label: "Mã QR vé của tôi" },
  { icon: "📅", label: "Lịch trình sự kiện" },
  { icon: "❓", label: "Hướng dẫn check-in" },
];

const INITIAL_MESSAGE = {
  id: "assistant-welcome",
  role: "assistant",
  content: "Xin chào! Mình có thể giúp bạn tìm sự kiện, xem lịch trình và hướng dẫn sử dụng vé điện tử.",
};

function renderInlineMarkdown(text, keyPrefix) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${keyPrefix}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={`${keyPrefix}-${index}`}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function AssistantMarkdown({ content }) {
  const blocks = [];
  let paragraph = [];
  let list = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", lines: paragraph });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ type: "list", lines: list });
    list = [];
  };

  content.split("\n").forEach((line) => {
    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph();
      list.push(line.replace(/^\s*[-*]\s+/, ""));
    } else {
      flushList();
      paragraph.push(line);
    }
  });
  flushParagraph();
  flushList();

  return blocks.map((block, blockIndex) => block.type === "list" ? (
    <ul key={`list-${blockIndex}`}>
      {block.lines.map((line, lineIndex) => (
        <li key={`item-${lineIndex}`}>
          {renderInlineMarkdown(line, `list-${blockIndex}-${lineIndex}`)}
        </li>
      ))}
    </ul>
  ) : (
    <p key={`paragraph-${blockIndex}`}>
      {block.lines.map((line, lineIndex) => (
        <React.Fragment key={`line-${lineIndex}`}>
          {lineIndex > 0 && <br />}
          {renderInlineMarkdown(line, `paragraph-${blockIndex}-${lineIndex}`)}
        </React.Fragment>
      ))}
    </p>
  ));
}

function formatEventDate(value) {
  if (!value) return "Thời gian đang cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Thời gian đang cập nhật";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const MOCK_UPCOMING_EVENTS = [
  {
    id: "mock-ai-conference",
    title: "Hội nghị Công nghệ Trí tuệ Nhân tạo 2026",
    start_time: "2026-10-11T13:30:00",
    location: "ICTU - Tòa nhà A",
  },
  {
    id: "mock-web-workshop",
    title: "Web Development Workshop 2026",
    start_time: "2026-10-12T08:00:00",
    location: "ICTU - Web Lab",
  },
  {
    id: "mock-cloud-seminar",
    title: "Cloud Computing & AI Seminar",
    start_time: "2026-10-13T14:00:00",
    location: "ICTU - Cloud Lab",
  },
];

function extractEventContext(question) {
  const titleMatch = question.match(/sự kiện\s+["“”']([^"“”']+)["“”']/i);
  const timeMatch = question.match(/Thời gian:\s*([^\.]+(?:\.[^ ]+)?)/i);
  const locationMatch = question.match(/Địa điểm:\s*([^\.]+(?:\.[^ ]+)?)/i);
  return {
    title: titleMatch?.[1]?.trim() || "sự kiện bạn đang quan tâm",
    time: timeMatch?.[1]?.trim() || "Đang cập nhật",
    location: locationMatch?.[1]?.trim() || "Đang cập nhật",
  };
}

function findEventInContext(question, events, eventContext) {
  if (eventContext?.id) return eventContext;
  const normalizedQuestion = question.toLowerCase();
  return events
    .filter((event) => event?.title)
    .sort((left, right) => right.title.length - left.title.length)
    .find((event) => normalizedQuestion.includes(event.title.toLowerCase())
      || event.title.toLowerCase().split(/\s+/).filter((word) => word.length > 3).some((word) => normalizedQuestion.includes(word)));
}

function createDynamicAssistantPayload(question, { events = [], registrations = [], tickets = [], eventContext = null } = {}) {
  const safeEvents = Array.isArray(events) ? events.filter(Boolean) : [];
  const matchingEvent = findEventInContext(question, safeEvents, eventContext);
  if (matchingEvent && (eventContext?.id || /(tóm tắt|thông tin|chi tiết|lịch trình|địa điểm|sự kiện)/i.test(question))) {
    const title = matchingEvent.title || "Sự kiện đang cập nhật";
    const time = matchingEvent.start_time
      ? `${formatEventDate(matchingEvent.start_time)}${matchingEvent.end_time ? ` - ${formatEventDate(matchingEvent.end_time)}` : ""}`
      : "Đang cập nhật";
    const description = matchingEvent.description || "Sự kiện chưa có mô tả chi tiết.";
    return {
      answer: `📌 **${title}**\n\n- **Thời gian:** ${time}\n- **Địa điểm:** ${matchingEvent.location || "Đang cập nhật"}\n- **Vé còn lại:** ${matchingEvent.max_attendees ? `${matchingEvent.max_attendees} suất theo sức chứa công bố` : "Đang cập nhật"}\n- **Diễn giả:** ${matchingEvent.speakers?.map((speaker) => speaker.full_name || speaker.name).filter(Boolean).join(", ") || "Đang cập nhật"}\n\n**Mô tả:** ${description}\n\n🎯 **Lịch trình mẫu:**\n\n- **07:30 - 08:00:** Đón khách & Check-in QR\n- **08:00 - 09:30:** Phiên khai mạc & Trình bày chuyên đề\n- **09:30 - 10:30:** Thảo luận Q&A cùng diễn giả`,
      events: [matchingEvent],
    };
  }

  if (/sự kiện sắp diễn ra|sắp diễn ra/i.test(question)) {
    const upcoming = safeEvents
      .filter((event) => !event.start_time || new Date(event.start_time) >= new Date())
      .sort((left, right) => new Date(left.start_time || 0) - new Date(right.start_time || 0))
      .slice(0, 3);
    return {
      ...createMockAssistantPayload(question),
      events: upcoming.length ? upcoming : MOCK_UPCOMING_EVENTS,
    };
  }

  if (/mã qr|vé của tôi|ticket/i.test(question)) {
    const ownedTickets = Array.isArray(tickets) && tickets.length ? tickets : registrations.filter((item) => item?.status === "REGISTERED");
    const firstTicket = ownedTickets[0];
    return {
      ...createMockAssistantPayload("Mã QR vé của tôi"),
      answer: ownedTickets.length
        ? `**Vé của bạn**\n\n${ownedTickets.slice(0, 3).map((ticket) => `- **${ticket.ticket_code || ticket.code || `Vé #${ticket.id || "đang cập nhật"}`}**: ${ticket.event_title || "Sự kiện đã đăng ký"}`).join("\n")}\n\nMở mã QR bên dưới để xem bản xem trước.`
        : createMockAssistantPayload("Mã QR vé của tôi").answer,
      qrCode: firstTicket?.ticket_code || firstTicket?.code || "TICKET-2026-AI-8899",
    };
  }

  return null;
}

function createMockAssistantPayload(question) {
  if (/(tóm tắt|thông tin|hội nghị)/i.test(question)) {
    const event = extractEventContext(question);
    return {
      answer: `📌 **Tổng quan:** Trợ lý AI xin tóm tắt sự kiện **${event.title}**.\n\n⏰ **Thời gian:** ${event.time}\n\n📍 **Địa điểm:** ${event.location}\n\n🎯 **Lịch trình dự kiến:**\n\n- **07:30 - 08:00:** Đón khách & Check-in QR\n- **08:00 - 09:30:** Phiên khai mạc & Trình bày chuyên đề\n- **09:30 - 10:30:** Thảo luận Q&A cùng diễn giả\n\nHãy đến sớm khoảng 15 phút, mở vé điện tử và xuất trình mã QR tại quầy check-in.`,
    };
  }
  if (/sự kiện sắp diễn ra/i.test(question)) {
    return {
      answer: "**Sự kiện sắp diễn ra**\n\nDưới đây là một số sự kiện nổi bật bạn có thể quan tâm. Chọn **Xem chi tiết** để xem thêm lịch trình hoặc **Đăng ký** để giữ chỗ.",
      events: MOCK_UPCOMING_EVENTS,
    };
  }
  if (/mã qr vé của tôi/i.test(question)) {
    return {
      answer: "**Mã QR vé của bạn**\n\nĐây là mã vé giả lập để xem trước giao diện. Khi check-in, hãy dùng mã QR thật trong mục **Vé của tôi** hoặc **Đã đăng ký**.",
      qrCode: "TICKET-2026-AI-8899",
    };
  }
  if (/lịch trình sự kiện/i.test(question)) {
    return { answer: "**Lịch trình sự kiện**\n\nMở chi tiết sự kiện để xem các phiên theo thời gian, địa điểm và diễn giả. Mình có thể tiếp tục tóm tắt từng phiên nếu bạn gửi tên sự kiện." };
  }
  if (/hướng dẫn check-in/i.test(question)) {
    return { answer: "**Hướng dẫn check-in**\n\n1. Mở vé điện tử của sự kiện.\n2. Đưa mã QR cho nhân viên tại quầy.\n3. Kiểm tra trạng thái vé sau khi quét thành công." };
  }
  if (/(sự kiện|event|tìm|gợi ý|khám phá)/i.test(question)) {
    return { answer: "Hiện mình chưa kết nối được với trợ lý AI. Bạn có thể xem danh sách sự kiện sắp diễn ra trong mục Sự kiện; mình cũng sẽ hiển thị các sự kiện phù hợp bên dưới nếu tải được dữ liệu." };
  }
  if (/(qr|mã vé|vé của tôi|vé điện tử)/i.test(question)) {
    return { answer: "Bạn có thể mở mục Vé hoặc Đăng ký của tôi để xem vé điện tử và mã QR. Khi check-in, hãy mở mã QR của đúng sự kiện để nhân viên quét." };
  }
  if (/(lịch trình|schedule|timeline)/i.test(question)) {
    return { answer: "Bạn hãy mở trang chi tiết sự kiện và chọn Lịch trình để xem các phiên theo thời gian, địa điểm và diễn giả." };
  }
  if (/(check.?in|điểm danh|vào cổng)/i.test(question)) {
    return { answer: "Khi đến sự kiện, mở vé điện tử có mã QR trong mục Vé hoặc Đăng ký của tôi và xuất trình mã để nhân viên check-in." };
  }
  return { answer: "Hiện mình chưa kết nối được với trợ lý AI. Bạn có thể hỏi mình về sự kiện, vé điện tử, lịch trình hoặc hướng dẫn check-in; trong lúc này, hãy mở mục tương ứng trên ứng dụng để xem thông tin mới nhất." };
}

const isImmediateMockQuestion = (question) => (
  /(tóm tắt|thông tin|hội nghị)/i.test(question)
  || QUICK_PROMPTS.some((prompt) => prompt.label.toLowerCase() === question.toLowerCase())
);

function AIAssistantModal({ token, onClose, onEventAction, eventContext, assistantData = {} }) {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [minimized, setMinimized] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState("");
  const [myTickets, setMyTickets] = useState([]);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const requestRef = useRef(null);
  const sendingRef = useRef(false);
  const eventCacheRef = useRef(null);
  const messageIdRef = useRef(0);
  const events = Array.isArray(assistantData.events) ? assistantData.events : [];
  const registrations = Array.isArray(assistantData.registrations) ? assistantData.registrations : [];

  const nextMessageId = (role) => `${role}-${Date.now()}-${messageIdRef.current++}`;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (!minimized) inputRef.current?.focus();
  }, [minimized]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    const controller = new AbortController();
    getMyTickets(token, controller.signal)
      .then((items) => setMyTickets(Array.isArray(items) ? items : []))
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setMyTickets([]);
      });
    return () => controller.abort();
  }, [token]);

  const sendMessage = async (content) => {
    const question = content.trim();
    if (!question || sendingRef.current) return;

    const history = messages.slice(-8).map(({ role, content: messageContent }) => ({
      role,
      content: messageContent,
    }));
    const controller = new AbortController();
    requestRef.current = controller;
    sendingRef.current = true;
    setMessages((current) => [...current, { id: nextMessageId("user"), role: "user", content: question }]);
    setDraft("");
    setError("");
    setSending(true);

    try {
      const useImmediateMock = isImmediateMockQuestion(question);
      const dynamicPayload = createDynamicAssistantPayload(question, {
        events,
        registrations,
        tickets: myTickets,
        eventContext,
      });
      const useDynamicMock = Boolean(dynamicPayload);
      const wantsEvents = !useImmediateMock && !useDynamicMock && /(tìm|gợi ý|sắp diễn ra|sự kiện nào|khám phá)/i.test(question);
      const responsePromise = useImmediateMock
        ? new Promise((resolve) => window.setTimeout(() => resolve(dynamicPayload || createMockAssistantPayload(question)), 500))
        : useDynamicMock
          ? new Promise((resolve) => window.setTimeout(() => resolve(dynamicPayload), 500))
        : (async () => {
          try {
            return await sendPersonalAssistantMessage(question, history, token, controller.signal);
          } catch (requestError) {
            if (requestError.name === "AbortError" || controller.signal.aborted) throw requestError;
            return createMockAssistantPayload(question);
          }
        })();
      const [response, events] = await Promise.all([
        responsePromise,
        wantsEvents
          ? eventCacheRef.current
            ? Promise.resolve(eventCacheRef.current)
            : getAttendeeEvents(token, controller.signal).then((items) => {
              eventCacheRef.current = items;
              return items;
            }).catch(() => [])
          : Promise.resolve([]),
      ]);
      if (controller.signal.aborted) return;
      const upcomingEvents = events
        .filter((event) => !event.start_time || new Date(event.start_time) >= new Date())
        .sort((left, right) => new Date(left.start_time || 0) - new Date(right.start_time || 0))
        .slice(0, 3);
      setMessages((current) => [...current, {
        id: nextMessageId("assistant"),
        role: "assistant",
        content: response?.answer || dynamicPayload?.answer || createMockAssistantPayload(question).answer,
        events: response?.events || dynamicPayload?.events || upcomingEvents,
        qrCode: response?.qrCode,
      }]);
    } catch (requestError) {
      if (requestError.name !== "AbortError" && !controller.signal.aborted) {
        setMessages((current) => [...current, {
          id: nextMessageId("assistant"),
          role: "assistant",
          content: createMockAssistantPayload(question).answer,
        }]);
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        sendingRef.current = false;
        setSending(false);
      }
    }
  };

  useEffect(() => {
    if (!eventContext?.id) return;
    const eventTime = eventContext.start_time
      ? `${eventContext.start_time}${eventContext.end_time ? ` đến ${eventContext.end_time}` : ""}`
      : "chưa cập nhật thời gian";
    const eventLocation = eventContext.location || "chưa cập nhật địa điểm";
    void sendMessage(
      `Hãy tóm tắt chi tiết lịch trình và địa điểm của sự kiện "${eventContext.title}". Thời gian: ${eventTime}. Địa điểm: ${eventLocation}.`,
    );
  }, [eventContext?.id]);

  const clearChat = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    sendingRef.current = false;
    setSending(false);
    setMessages([INITIAL_MESSAGE]);
    setDraft("");
    setError("");
    setCopiedMessageId("");
  };

  const copyMessage = async (message) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId(""), 1600);
    } catch {
      setError("Không thể sao chép câu trả lời trên trình duyệt này.");
    }
  };

  const handleEventAction = (action, event) => {
    onClose();
    onEventAction?.(action, event);
  };

  if (minimized) {
    return (
      <button
        type="button"
        className="assistant-restore-button"
        onClick={() => setMinimized(false)}
        aria-label="Mở lại Trợ lý AI sự kiện"
      >
        <span aria-hidden="true">✦</span> Trợ lý AI
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className="assistant-backdrop"
        onClick={onClose}
        aria-label="Đóng trợ lý AI"
      />
      <section className="assistant-chat-panel" role="dialog" aria-modal="true" aria-labelledby="assistant-chat-title">
        <header className="assistant-chat-header">
          <span className="assistant-chat-mark" aria-hidden="true">✦</span>
          <div className="assistant-chat-heading">
            <h2 id="assistant-chat-title">Trợ lý AI sự kiện</h2>
            <span className="assistant-status"><i aria-hidden="true" /> AI Active</span>
          </div>
          <div className="assistant-chat-actions">
            <button type="button" onClick={clearChat} aria-label="Xóa lịch sử chat" title="Xóa lịch sử chat">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18M8 6V4h8v2m3 0-.8 14H5.8L5 6m4 4v6m6-6v6" />
              </svg>
            </button>
            <button type="button" onClick={() => setMinimized(true)} aria-label="Thu nhỏ trợ lý" title="Thu nhỏ">−</button>
            <button type="button" onClick={onClose} aria-label="Đóng trợ lý" title="Đóng">×</button>
          </div>
        </header>

        <div className="assistant-chat-messages" ref={listRef} aria-live="polite">
          {messages.map((message) => (
            <div className={`assistant-message assistant-message-${message.role}`} key={message.id}>
              {message.role === "assistant" && <span className="assistant-message-avatar" aria-hidden="true">✦</span>}
              <div className="assistant-message-body">
                <div className="assistant-message-content">
                  {message.role === "assistant" ? <AssistantMarkdown content={message.content} /> : <p>{message.content}</p>}
                </div>
                {message.qrCode && (
                  <div className="assistant-qr-card" style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.6rem", padding: "0.7rem", border: "1px solid rgba(167, 139, 250, 0.35)", borderRadius: 10, background: "rgba(30, 25, 50, 0.82)" }}>
                    <div aria-label="Mã QR giả lập" role="img" style={{ display: "grid", gridTemplateColumns: "repeat(7, 5px)", gap: 2, padding: 6, borderRadius: 5, background: "#fff" }}>
                      {Array.from({ length: 49 }, (_, index) => {
                        const row = Math.floor(index / 7);
                        const column = index % 7;
                        const finder = (row < 3 && column < 3) || (row < 3 && column > 3) || (row > 3 && column < 3);
                        const filled = finder ? (row === 0 || row === 2 || column === 0 || column === 2 || (row === 1 && column === 1)) : (index * 11 + row * 3) % 5 < 2;
                        return <span key={index} style={{ width: 5, height: 5, background: filled ? "#171321" : "#fff" }} />;
                      })}
                    </div>
                    <div>
                      <strong style={{ display: "block", color: "#f4f2ff", fontSize: "0.78rem" }}>Mã vé giả lập</strong>
                      <span style={{ color: "#c4b5fd", fontSize: "0.76rem" }}>{message.qrCode}</span>
                    </div>
                  </div>
                )}
                {message.events?.length > 0 && (
                  <div className="assistant-event-list">
                    {message.events.map((event) => (
                      <article className="assistant-event-card" key={event.id}>
                        <h3>{event.title}</h3>
                        <p><span aria-hidden="true">◷</span>{formatEventDate(event.start_time)}</p>
                        <p><span aria-hidden="true">⌖</span>{event.location || "Địa điểm đang cập nhật"}</p>
                        <div>
                          <button type="button" onClick={() => handleEventAction("details", event)}>Xem chi tiết</button>
                          <button type="button" onClick={() => handleEventAction("register", event)}>Đăng ký</button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                {message.role === "assistant" && message.id !== INITIAL_MESSAGE.id && (
                  <button
                    type="button"
                    className="assistant-copy-button"
                    onClick={() => void copyMessage(message)}
                    aria-label="Sao chép câu trả lời"
                    title={copiedMessageId === message.id ? "Đã sao chép" : "Sao chép câu trả lời"}
                  >
                    {copiedMessageId === message.id ? "Đã sao chép" : (
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="assistant-message assistant-message-assistant" role="status">
              <span className="assistant-message-avatar" aria-hidden="true">✦</span>
              <div className="assistant-message-content assistant-typing" aria-label="AI đang trả lời">
                <i /><i /><i />
              </div>
            </div>
          )}
        </div>

        <div className="assistant-quick-prompts" aria-label="Gợi ý câu hỏi">
          {QUICK_PROMPTS.map((prompt) => (
            <button type="button" key={prompt.label} onClick={() => sendMessage(prompt.label)} disabled={sending}>
              <span aria-hidden="true">{prompt.icon}</span>{prompt.label}
            </button>
          ))}
        </div>

        <form
          className="assistant-chat-composer"
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage(draft);
          }}
        >
          {error && <p className="assistant-chat-error" role="alert">{error}</p>}
          <label className="sr-only" htmlFor="assistant-chat-input">Nhập câu hỏi cho trợ lý</label>
          <textarea
            id="assistant-chat-input"
            ref={inputRef}
            rows="1"
            maxLength="500"
            placeholder="Hỏi về sự kiện, vé hoặc lịch trình..."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage(draft);
              }
            }}
          />
          <button type="submit" disabled={sending || !draft.trim()} aria-label="Gửi câu hỏi" title="Gửi">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
            </svg>
          </button>
        </form>
        <p className="assistant-chat-disclaimer">AI có thể nhầm lẫn. Hãy kiểm tra lại thông tin quan trọng.</p>
      </section>
    </>
  );
}

export default AIAssistantModal;