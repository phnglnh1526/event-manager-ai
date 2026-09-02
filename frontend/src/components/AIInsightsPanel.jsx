import React from "react";

const EMPTY_MESSAGES = {
  strengths: "Chưa xác định được điểm mạnh nổi bật.",
  issues: "Không ghi nhận vấn đề nổi bật.",
  suggestions: "Chưa có đề xuất cụ thể.",
};

function InsightList({ title, items, type }) {
  return (
    <section className={`ai-insight-group ai-${type}`}>
      <h4>{title}</h4>
      {items.length > 0 ? (
        <ul>
          {items.map((item, index) => <li key={`${type}-${index}`}>{item}</li>)}
        </ul>
      ) : <p className="ai-empty-copy">{EMPTY_MESSAGES[type]}</p>}
    </section>
  );
}

function AIInsightsPanel({ summary, loading, error, onGenerate, disabled }) {
  const hasSummary = Boolean(summary);
  const sourceLabel = summary?.source === "openai" ? "OpenAI" : "Mock Mode";
  const averageRating = summary?.average_rating == null
    ? "No rating data"
    : `${Number(summary.average_rating).toFixed(2).replace(/\.00$/, "")} / 5`;

  return (
    <section className="ai-panel" aria-labelledby="ai-panel-title" aria-busy={loading}>
      <div className="ai-panel-header">
        <div>
          <p className="eyebrow">ON-DEMAND ANALYSIS</p>
          <div className="ai-title-line">
            <h3 id="ai-panel-title">AI Feedback Insights</h3>
            {hasSummary && <span className={`ai-source-badge source-${summary.source}`}>{sourceLabel}</span>}
          </div>
        </div>
        <button
          type="button"
          className="primary-button ai-generate-button"
          onClick={onGenerate}
          disabled={disabled || loading}
        >
          {loading ? "Analyzing feedback..." : hasSummary ? "Regenerate Summary" : "Generate AI Summary"}
        </button>
      </div>

      {!hasSummary && !loading && !error && (
        <div className="ai-initial-state">
          <strong>Generate a summary of attendee feedback for this event.</strong>
          <p>AI analysis is generated on demand and is not saved.</p>
        </div>
      )}

      {loading && (
        <div className="ai-loading-state" role="status">
          <span className="ai-loading-dot" aria-hidden="true" />
          <span>{hasSummary ? "Updating analysis..." : "Analyzing attendee feedback..."}</span>
        </div>
      )}

      {error && <div className="ai-error" role="alert">{error}</div>}

      {hasSummary && (
        <div className="ai-result">
          {summary.source === "mock" && <p className="mock-note">Demo result generated in mock mode.</p>}
          <div className="ai-metadata" aria-label="AI analysis metadata">
            <div><span>Feedback</span><strong>{summary.feedback_count}</strong></div>
            <div><span>Comments analyzed</span><strong>{summary.analyzed_comment_count}</strong></div>
            <div><span>Average rating</span><strong>{averageRating}</strong></div>
          </div>
          <section className="ai-overview">
            <h4>Tổng quan</h4>
            <p>{summary.summary}</p>
          </section>
          <div className="ai-insights-grid">
            <InsightList title="Điểm mạnh" items={summary.strengths} type="strengths" />
            <InsightList title="Vấn đề cần chú ý" items={summary.issues} type="issues" />
            <InsightList title="Đề xuất cải thiện" items={summary.suggestions} type="suggestions" />
          </div>
        </div>
      )}
    </section>
  );
}

export default AIInsightsPanel;
