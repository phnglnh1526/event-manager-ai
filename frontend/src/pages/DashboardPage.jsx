import React, { useCallback, useEffect, useRef, useState } from "react";

import AIInsightsPanel from "../components/AIInsightsPanel";
import AttendanceOverview from "../components/AttendanceOverview";
import EventSelector, { SelectedEventCard } from "../components/EventSelector";
import KpiCard from "../components/KpiCard";
import RatingDistribution from "../components/RatingDistribution";
import WorkspaceHeader from "../components/WorkspaceHeader";
import { generateFeedbackSummary, getEvents, getEventStatistics } from "../services/api";

const friendlyError = (error, fallback) =>
  error.status === 403 ? "Bạn không có quyền truy cập vào tài nguyên này." : error.message || fallback;

const formatRate = (value) => `${Number(value || 0).toFixed(1).replace(/\.0$/, "")}%`;

const aiErrorMessage = (error) => {
  if (error.status === 409 && error.message === "No feedback available for AI summary")
    return "Chưa có phản hồi nào để AI phân tích.";
  if (error.status === 409 && error.message === "No written feedback available for AI summary")
    return "Chưa có nhận xét văn bản nào để tổng hợp.";
  if (error.status === 403) return "Bạn không có quyền tạo phân tích AI cho sự kiện này.";
  if (error.status === 404) return "Không tìm thấy sự kiện.";
  if (error.status === 502) return "Không thể phân tích dữ liệu. Vui lòng thử lại.";
  if (error.status === 503) return "Dịch vụ AI hiện không khả dụng.";
  if (error.status === 0) return "Không thể kết nối tới dịch vụ AI.";
  return "Không thể phân tích dữ liệu.";
};

const normalizeAiSummary = (data) => {
  if (
    !data ||
    typeof data.summary !== "string" ||
    !Array.isArray(data.strengths) ||
    !Array.isArray(data.issues) ||
    !Array.isArray(data.suggestions) ||
    !["mock", "openai"].includes(data.source)
  )
    return null;
  return {
    ...data,
    strengths: data.strengths.filter((item) => typeof item === "string"),
    issues: data.issues.filter((item) => typeof item === "string"),
    suggestions: data.suggestions.filter((item) => typeof item === "string"),
  };
};

function DashboardPage({ token, currentUser, onLogout, onUnauthorized, activeView, onViewChange }) {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [statistics, setStatistics] = useState(null);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [statisticsLoading, setStatisticsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [statisticsError, setStatisticsError] = useState("");
  const [eventsReload, setEventsReload] = useState(0);
  const [statisticsReload, setStatisticsReload] = useState(0);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const aiRequestSequence = useRef(0);
  const aiInFlight = useRef(false);

  const handleApiError = useCallback(
    (error, setter, fallback) => {
      if (error.status === 401) {
        onUnauthorized();
        return;
      }
      setter(friendlyError(error, fallback));
    },
    [onUnauthorized],
  );

  // Load events list
  useEffect(() => {
    const controller = new AbortController();
    setEventsLoading(true);
    setEventsError("");
    getEvents(token, controller.signal)
      .then((data) => {
        setEvents(data);
        setSelectedEventId((current) => (data.some((event) => event.id === current) ? current : data[0]?.id || ""));
      })
      .catch((error) => {
        if (error.name !== "AbortError") handleApiError(error, setEventsError, "Không thể tải danh sách sự kiện.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setEventsLoading(false);
      });
    return () => controller.abort();
  }, [token, eventsReload, handleApiError]);

  // Load statistics when selected event changes
  useEffect(() => {
    setStatistics(null);
    setStatisticsError("");
    if (!selectedEventId) {
      setStatisticsLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setStatisticsLoading(true);
    getEventStatistics(selectedEventId, token, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setStatistics(data);
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError" && !controller.signal.aborted) {
          handleApiError(error, setStatisticsError, "Không thể tải số liệu phân tích.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setStatisticsLoading(false);
        }
      });
    return () => controller.abort();
  }, [selectedEventId, token, statisticsReload, handleApiError]);

  // Reset AI state when selected event changes
  useEffect(() => {
    aiRequestSequence.current += 1;
    aiInFlight.current = false;
    setAiSummary(null);
    setAiError("");
    setAiLoading(false);
  }, [selectedEventId]);

  const handleEventChange = (eventId) => {
    aiRequestSequence.current += 1;
    aiInFlight.current = false;
    setAiSummary(null);
    setAiError("");
    setAiLoading(false);
    setStatistics(null);
    setStatisticsError("");
    setSelectedEventId(eventId);
  };

  const handleGenerateAiSummary = async () => {
    if (!selectedEventId || aiInFlight.current || !statistics || Number(statistics.feedback.total) <= 0) return;
    aiInFlight.current = true;
    const requestedEventId = selectedEventId;
    const requestSequence = aiRequestSequence.current + 1;
    aiRequestSequence.current = requestSequence;
    setAiError("");
    setAiLoading(true);
    try {
      const data = await generateFeedbackSummary(requestedEventId, token);
      if (aiRequestSequence.current !== requestSequence) return;
      const normalized = normalizeAiSummary(data);
      if (!normalized) {
        setAiError("Không thể hiển thị kết quả từ AI.");
        return;
      }
      setAiSummary(normalized);
    } catch (error) {
      if (aiRequestSequence.current !== requestSequence) return;
      if (error.status === 401) {
        onUnauthorized();
        return;
      }
      setAiError(aiErrorMessage(error));
    } finally {
      if (aiRequestSequence.current === requestSequence) {
        aiInFlight.current = false;
        setAiLoading(false);
      }
    }
  };

  const selectedEvent = events.find((event) => event.id === selectedEventId);

  // Safe capacity calculations (handle capacity = 0 without NaN)
  const maxCapacity = Math.max(0, Number(statistics?.capacity?.max_attendees) || 0);
  const registeredCount = Math.max(0, Number(statistics?.capacity?.registered) || 0);
  const remainingSlots = Math.max(0, maxCapacity - registeredCount);
  const usagePercentage = maxCapacity > 0 ? Math.min(100, (registeredCount / maxCapacity) * 100) : 0;
  const formattedCapacityRate = Number(usagePercentage.toFixed(1)).toString().replace(/\.0$/, "") + "%";

  return (
    <div className="dashboard-shell">
      <WorkspaceHeader currentUser={currentUser} activeView={activeView} onNavigate={onViewChange} onLogout={onLogout} />

      <main className="dashboard-main analytics-dashboard-main">
        {/* =========================================================================
            1. HERO ANALYTICS / BANNER + EVENT SELECTOR
            ========================================================================= */}
        <section className="dashboard-hero-banner">
          <div className="hero-banner-content">
            <div className="hero-banner-headings">
              <span className="hero-eyebrow">
                <span className="eyebrow-spark" aria-hidden="true">✦</span>
                PHÂN TÍCH SỰ KIỆN
              </span>
              <h1>Tổng quan phân tích</h1>
              <p>Theo dõi hiệu quả sự kiện từ đăng ký, tham dự đến phản hồi của người tham gia.</p>
            </div>
            {!eventsLoading && !eventsError && (
              <div className="hero-event-selector">
                <EventSelector
                  events={events}
                  selectedEventId={selectedEventId}
                  onChange={handleEventChange}
                  disabled={eventsLoading}
                />
              </div>
            )}
          </div>
        </section>

        {/* Loading / Error States for Events */}
        {eventsLoading && (
          <div className="state-panel">
            <div className="app-loader" />
            <p>Đang tải danh sách sự kiện...</p>
          </div>
        )}
        {eventsError && (
          <div className="state-panel error-panel">
            <strong>Không thể tải sự kiện</strong>
            <p>{eventsError}</p>
            <button type="button" className="secondary-button" onClick={() => setEventsReload((x) => x + 1)}>
              Thử lại
            </button>
          </div>
        )}
        {!eventsLoading && !eventsError && events.length === 0 && (
          <div className="state-panel">
            <strong>Chưa có sự kiện nào.</strong>
            <p>Hãy tạo một sự kiện để bắt đầu theo dõi số liệu phân tích.</p>
          </div>
        )}

        {/* =========================================================================
            2. EVENT HERO CARD (Real Event Details & Cover)
            ========================================================================= */}
        {selectedEvent && !eventsLoading && !eventsError && (
          <SelectedEventCard event={selectedEvent} />
        )}

        {/* Statistics Loading / Error */}
        {statisticsLoading && (
          <div className="state-panel">
            <div className="app-loader" />
            <p>Đang tải số liệu phân tích...</p>
          </div>
        )}
        {statisticsError && (
          <div className="state-panel error-panel">
            <strong>Không thể tải số liệu phân tích</strong>
            <p>{statisticsError}</p>
            <button type="button" className="secondary-button" onClick={() => setStatisticsReload((x) => x + 1)}>
              Thử lại
            </button>
          </div>
        )}

        {/* =========================================================================
            3. ANALYTICS METRICS CONTENT (KPIs, Charts, Capacity, AI)
            ========================================================================= */}
        {statistics && !statisticsLoading && (
          <div className="analytics-content-grid">
            {/* 4 KPI CARDS */}
            <section className="analytics-kpi-grid" aria-label="Chỉ số hiệu quả sự kiện">
              <KpiCard
                label="ĐĂNG KÝ NGƯỜI THAM DỰ"
                value={statistics.registrations.registered}
                detail={`${statistics.registrations.total} tổng lượt đăng ký`}
                icon="registrations"
                tone="accent"
              />
              <KpiCard
                label="ĐÃ CHECK-IN"
                value={statistics.attendance.checked_in}
                detail={`trên tổng số ${statistics.registrations.registered} đăng ký`}
                icon="checkIn"
                tone="success"
              />
              <KpiCard
                label="TỶ LỆ THAM DỰ"
                value={formatRate(statistics.attendance.attendance_rate)}
                detail={`còn ${statistics.attendance.not_checked_in} người chưa check-in`}
                icon="attendance"
                tone="warning"
              />
              <KpiCard
                label="ĐÁNH GIÁ TRUNG BÌNH"
                value={statistics.feedback.average_rating == null ? "—" : `${statistics.feedback.average_rating} / 5`}
                detail={`${statistics.feedback.total} lượt phản hồi`}
                icon="rating"
                tone="rating"
              />
            </section>

            {/* VISUAL CHARTS ROW (Donut + Rating Distribution) */}
            <section className="analytics-charts-grid">
              <AttendanceOverview attendance={statistics.attendance} />
              <RatingDistribution
                distribution={statistics.feedback.rating_distribution}
                feedbackCount={statistics.feedback.total}
              />
            </section>

            {/* CAPACITY & REGISTRATION PANEL */}
            <section className="panel-card capacity-panel" aria-labelledby="capacity-panel-title">
              <div className="capacity-panel-header">
                <div>
                  <p className="eyebrow">SỨC CHỨA SỰ KIỆN</p>
                  <h3 id="capacity-panel-title">Sức chứa &amp; Đăng ký</h3>
                </div>
                <div className="capacity-badge">
                  <span>Tỷ lệ lấp đầy: <strong>{maxCapacity > 0 ? formattedCapacityRate : "Không giới hạn"}</strong></span>
                </div>
              </div>

              {/* Progress bar */}
              <div
                className="capacity-track"
                role="progressbar"
                aria-label="Tỷ lệ sức chứa đã dùng"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={maxCapacity > 0 ? usagePercentage : 0}
              >
                <span
                  className="capacity-bar-fill"
                  style={{ width: `${maxCapacity > 0 ? usagePercentage : 0}%` }}
                />
              </div>

              {/* 4 Capacity Metrics Grid */}
              <div className="capacity-metrics-grid">
                <div className="capacity-metric-item">
                  <span className="metric-label">Sức chứa tối đa</span>
                  <strong className="metric-val">
                    {maxCapacity > 0 ? `${maxCapacity} người` : "Không giới hạn"}
                  </strong>
                </div>
                <div className="capacity-metric-item">
                  <span className="metric-label">Đã đăng ký</span>
                  <strong className="metric-val">{registeredCount} người</strong>
                </div>
                <div className="capacity-metric-item">
                  <span className="metric-label">Còn trống</span>
                  <strong className="metric-val">
                    {maxCapacity > 0 ? `${remainingSlots} chỗ` : "Còn chỗ"}
                  </strong>
                </div>
                <div className="capacity-metric-item">
                  <span className="metric-label">Tỷ lệ đăng ký</span>
                  <strong className="metric-val highlight">
                    {maxCapacity > 0 ? formattedCapacityRate : "—"}
                  </strong>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* =========================================================================
            4. AI INSIGHTS PANEL (Real API Integration)
            ========================================================================= */}
        {selectedEvent && !eventsLoading && !eventsError && (
          <AIInsightsPanel
            summary={aiSummary}
            loading={aiLoading}
            error={aiError}
            onGenerate={handleGenerateAiSummary}
            disabled={!selectedEventId || !statistics}
            feedbackCount={statistics?.feedback?.total}
          />
        )}
      </main>

      <footer className="dashboard-footer">
        Event Manager AI · Dữ liệu phân tích được cập nhật trực tiếp theo thời gian thực.
      </footer>
    </div>
  );
}

export default DashboardPage;
