import React from "react";

export function AIIcon({ size = "default", className = "" }) {
  const sizeClass = size === "compact" ? "compact" : size === "large" ? "large" : "";
  const iconSize = size === "compact" ? 14 : size === "large" ? 24 : 18;

  return (
    <div className={`ai-icon-box ${sizeClass} ${className}`} aria-hidden="true">
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z" />
        <path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14ZM5 14l.7 1.8 1.8.7-1.8.7L5 19l-.7-1.8-1.8-.7 1.8-.7L5 14Z" />
      </svg>
    </div>
  );
}

export function AIBadge({ source, label, className = "" }) {
  const isMock = source === "mock";
  const isOpenAI = source === "openai";
  const badgeClass = isOpenAI ? "source-openai" : isMock ? "source-mock" : "";
  const defaultLabel = isOpenAI ? "OpenAI GPT" : isMock ? "Mô phỏng AI" : "Trí tuệ AI";

  return (
    <span className={`ai-badge ${badgeClass} ${className}`}>
      {label || defaultLabel}
    </span>
  );
}

export function AILoading({ text = "Đang phân tích...", className = "" }) {
  return (
    <div className={`ai-loading-container ${className}`} role="status" aria-live="polite">
      <div className="ai-dots-bounce" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <span>{text}</span>
    </div>
  );
}

export function AIError({ message = "Không thể phân tích dữ liệu.", onRetry, className = "" }) {
  return (
    <div className={`ai-error-container ${className}`} role="alert">
      <div className="ai-error-content">
        <span className="ai-error-icon" aria-hidden="true">⚠️</span>
        <span>{message}</span>
      </div>
      {onRetry && (
        <button type="button" className="ai-error-retry-btn" onClick={onRetry}>
          Thử lại
        </button>
      )}
    </div>
  );
}

export function AIEmptyState({
  title = "Chưa có dữ liệu phân tích",
  description = "Tính năng AI sẽ tự động phân tích và đưa ra đề xuất khi có đủ dữ liệu từ sự kiện.",
  action,
  className = "",
}) {
  return (
    <div className={`ai-empty-container ${className}`}>
      <div className="ai-empty-icon-wrap" aria-hidden="true">
        ✦
      </div>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action && <div style={{ marginTop: "1rem" }}>{action}</div>}
    </div>
  );
}
