import React from "react";

const EMPTY_MESSAGES = {
  strengths: "No standout strengths were identified.",
  issues: "No notable issues were identified.",
  suggestions: "No specific suggestions were provided.",
};

const INSIGHT_ICONS = {
  strengths: "✓",
  issues: "!",
  suggestions: "→",
};

function InsightList({ title, items, type }) {
  return (
    <section className={`ai-insight-group ai-${type}`}>
      <div className="ai-insight-heading"><span aria-hidden="true">{INSIGHT_ICONS[type]}</span><h4>{title}</h4></div>
      {items.length > 0 ? (
        <ul>{items.map((item, index) => <li key={`${type}-${index}`}>{item}</li>)}</ul>
      ) : <p className="ai-empty-copy">{EMPTY_MESSAGES[type]}</p>}
    </section>
  );
}

function AIInsightsPanel({ summary, loading, error, onGenerate, disabled, feedbackCount }) {
  const hasSummary = Boolean(summary);
  const feedbackKnown = feedbackCount != null;
  const hasFeedback = Number(feedbackCount) > 0;
  const zeroFeedback = feedbackKnown && !hasFeedback;
  const sourceLabel = summary?.source === "openai" ? "OpenAI" : "Mock";
  const averageRating = summary?.average_rating == null
    ? "No rating data"
    : `${Number(summary.average_rating).toFixed(2).replace(/\.00$/, "")} / 5`;

  return (
    <section className="ai-panel" aria-labelledby="ai-panel-title" aria-busy={loading}>
      <div className="ai-panel-header">
        <div className="ai-heading-lockup">
          <span className="ai-panel-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z" /><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14ZM5 14l.7 1.8 1.8.7-1.8.7L5 19l-.7-1.8-1.8-.7 1.8-.7L5 14Z" /></svg></span>
          <div>
            <p className="eyebrow">ATTENDEE FEEDBACK</p>
            <div className="ai-title-line">
              <h3 id="ai-panel-title">AI Insights</h3>
              {hasSummary && <span className={`ai-source-badge source-${summary.source}`}>{sourceLabel}</span>}
            </div>
          </div>
        </div>
        {!zeroFeedback && (
          <button type="button" className="primary-button ai-generate-button" onClick={onGenerate} disabled={disabled || loading || !hasFeedback}>
            {loading ? "Analyzing feedback..." : hasSummary ? "Regenerate Summary" : "Generate AI Summary"}
          </button>
        )}
      </div>

      {zeroFeedback && !hasSummary && (
        <div className="ai-zero-state">
          <span aria-hidden="true">✦</span>
          <div><strong>AI insights will be available after the event receives attendee feedback.</strong><p>Feedback summaries are generated only from real attendee responses.</p></div>
        </div>
      )}

      {!zeroFeedback && !hasSummary && !loading && !error && (
        <div className="ai-initial-state">
          <strong>Generate a summary of attendee feedback for this event.</strong>
          <p>AI analysis is generated on demand and is not saved.</p>
        </div>
      )}

      {loading && <div className="ai-loading-state" role="status"><span className="ai-loading-dot" aria-hidden="true" /><span>{hasSummary ? "Updating analysis..." : "Analyzing attendee feedback..."}</span></div>}
      {error && <div className="ai-error" role="alert">{error}</div>}

      {hasSummary && (
        <div className="ai-result">
          {summary.source === "mock" && <p className="mock-note">Demo result generated in mock mode.</p>}
          <div className="ai-metadata" aria-label="AI analysis metadata">
            <div><span>Feedback</span><strong>{summary.feedback_count}</strong></div>
            <div><span>Comments analyzed</span><strong>{summary.analyzed_comment_count}</strong></div>
            <div><span>Average rating</span><strong>{averageRating}</strong></div>
          </div>
          <section className="ai-overview"><div className="ai-section-label"><span aria-hidden="true">✦</span><h4>Summary</h4></div><p>{summary.summary}</p></section>
          <div className="ai-insights-grid">
            <InsightList title="Strengths" items={summary.strengths} type="strengths" />
            <InsightList title="Issues" items={summary.issues} type="issues" />
            <InsightList title="Suggestions" items={summary.suggestions} type="suggestions" />
          </div>
        </div>
      )}
    </section>
  );
}

export default AIInsightsPanel;
