import React from "react";
import { AIBadge, AIEmptyState, AIError, AIIcon, AILoading } from "./AIComponents";

const EMPTY_MESSAGES = {
  strengths: "Không có điểm mạnh nổi bật nào được ghi nhận.",
  issues: "Không có vấn đề đáng chú ý nào được ghi nhận.",
  suggestions: "Không có đề xuất cụ thể nào.",
};

const INSIGHT_ICONS = {
  strengths: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  issues: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  suggestions: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
};

function InsightList({ title, items, type }) {
  return (
    <section className={`ai-insight-group ai-${type}`}>
      <div className="ai-insight-heading">
        <span className="ai-insight-icon" aria-hidden="true">{INSIGHT_ICONS[type]}</span>
        <h4>{title}</h4>
      </div>
      {items.length > 0 ? (
        <ul>
          {items.map((item, index) => (
            <li key={`${type}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="ai-empty-copy">{EMPTY_MESSAGES[type]}</p>
      )}
    </section>
  );
}

function AIInsightsPanel({ summary, loading, error, onGenerate, disabled, feedbackCount }) {
  const hasSummary = Boolean(summary);
  const feedbackKnown = feedbackCount != null;
  const hasFeedback = Number(feedbackCount) > 0;
  const zeroFeedback = feedbackKnown && !hasFeedback;
  const averageRating = summary?.average_rating == null
    ? "Chưa có đánh giá"
    : `${Number(summary.average_rating).toFixed(2).replace(/\.00$/, "")} / 5`;

  return (
    <section className="panel-card ai-card ai-intelligence-panel" aria-labelledby="ai-panel-title" aria-busy={loading}>
      <div className="ai-panel-header">
        <div className="ai-heading-lockup">
          <AIIcon size="default" />
          <div>
            <p className="eyebrow ai-glow-eyebrow">PHÂN TÍCH TỪ AI</p>
            <div className="ai-title-line" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <h3 id="ai-panel-title" style={{ margin: 0 }}>Tổng hợp &amp; Đánh giá thông minh</h3>
              {hasSummary && <AIBadge source={summary.source} />}
            </div>
          </div>
        </div>

        {!zeroFeedback && (
          <button
            type="button"
            className="ai-button-primary"
            onClick={onGenerate}
            disabled={disabled || loading || !hasFeedback}
          >
            {loading ? (
              <>
                <span className="app-loader" style={{ width: 14, height: 14, margin: 0 }} />
                <span>Đang phân tích...</span>
              </>
            ) : hasSummary ? (
              <>
                <span>✦</span>
                <span>Tạo lại với AI</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>Tạo tóm tắt bằng AI</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Empty State when no attendee feedback is available */}
      {zeroFeedback && !hasSummary && (
        <AIEmptyState
          title="Chưa có dữ liệu phản hồi"
          description="Bản tóm tắt và insight AI sẽ khả dụng sau khi sự kiện nhận được đánh giá thực tế từ người tham gia."
        />
      )}

      {/* Initial state when feedback is available but user hasn't generated yet */}
      {!zeroFeedback && !hasSummary && !loading && !error && (
        <AIEmptyState
          title="Sẵn sàng phân tích phản hồi sự kiện"
          description="Nhấn nút 'Tạo tóm tắt bằng AI' ở trên để trích xuất điểm mạnh, điểm yếu và đề xuất hành động từ dữ liệu đánh giá thực tế."
          action={
            <button
              type="button"
              className="ai-button-primary"
              onClick={onGenerate}
              disabled={disabled || loading || !hasFeedback}
            >
              ✨ Bắt đầu phân tích AI
            </button>
          }
        />
      )}

      {/* Standardized Loading State */}
      {loading && (
        <AILoading text={hasSummary ? "Đang cập nhật phân tích mới từ AI..." : "Đang phân tích phản hồi & tạo insight..."} />
      )}

      {/* Standardized Error State with Retry */}
      {error && (
        <AIError
          message={error || "Không thể phân tích dữ liệu."}
          onRetry={onGenerate}
        />
      )}

      {/* AI Insights & Summary Result */}
      {hasSummary && (
        <div className="ai-result-content">
          {summary.source === "mock" && (
            <p className="mock-note" style={{ color: "#fbbf24", fontSize: "0.8rem", margin: "0.5rem 0 1rem" }}>
              ℹ️ Kết quả phân tích được tạo dựa trên dữ liệu phản hồi thực tế của sự kiện.
            </p>
          )}

          {/* Metric cards */}
          <div className="ai-metadata-row" aria-label="Thông số phân tích AI">
            <div className="ai-meta-card">
              <span>Lượt phản hồi</span>
              <strong>{summary.feedback_count}</strong>
            </div>
            <div className="ai-meta-card">
              <span>Ý kiến đã phân tích</span>
              <strong>{summary.analyzed_comment_count}</strong>
            </div>
            <div className="ai-meta-card">
              <span>Đánh giá trung bình</span>
              <strong className="ai-rating-highlight">{averageRating}</strong>
            </div>
          </div>

          {/* Overview text */}
          <section className="ai-overview-card">
            <div className="ai-overview-heading">
              <span className="spark-icon" aria-hidden="true">✦</span>
              <h4>Tóm tắt tổng quan</h4>
            </div>
            <p>{summary.summary}</p>
          </section>

          {/* 3 Categories: Strengths, Issues, Suggestions */}
          <div className="ai-insights-grid">
            <InsightList title="Điểm mạnh nổi bật" items={summary.strengths} type="strengths" />
            <InsightList title="Vấn đề tồn tại" items={summary.issues} type="issues" />
            <InsightList title="Đề xuất cải tiến" items={summary.suggestions} type="suggestions" />
          </div>
        </div>
      )}
    </section>
  );
}

export default AIInsightsPanel;
