import React, { useCallback, useEffect, useRef, useState } from "react";

import AIInsightsPanel from "../components/AIInsightsPanel";
import AttendanceOverview from "../components/AttendanceOverview";
import EventSelector from "../components/EventSelector";
import KpiCard from "../components/KpiCard";
import ManagementNav from "../components/ManagementNav";
import RatingDistribution from "../components/RatingDistribution";
import { generateFeedbackSummary, getEvents, getEventStatistics } from "../services/api";

const friendlyError = (error, fallback) => error.status === 403 ? "You do not have permission to access this resource." : error.message || fallback;
const formatRate = (value) => `${Number(value || 0).toFixed(2).replace(/\.00$/, "")}%`;

const aiErrorMessage = (error) => {
  if (error.status === 409 && error.message === "No feedback available for AI summary") return "No feedback is available for AI analysis yet.";
  if (error.status === 409 && error.message === "No written feedback available for AI summary") return "No written feedback is available to summarize.";
  if (error.status === 403) return "You do not have permission to generate AI analysis for this event.";
  if (error.status === 404) return "Event not found.";
  if (error.status === 502) return "AI analysis could not be generated. Please try again.";
  if (error.status === 503) return "AI service is currently unavailable.";
  if (error.status === 0) return "Unable to connect to the AI service.";
  return "AI analysis could not be generated. Please try again.";
};

const normalizeAiSummary = (data) => {
  if (
    !data
    || typeof data.summary !== "string"
    || !Array.isArray(data.strengths)
    || !Array.isArray(data.issues)
    || !Array.isArray(data.suggestions)
    || !["mock", "openai"].includes(data.source)
  ) return null;
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

  const handleApiError = useCallback((error, setter, fallback) => {
    if (error.status === 401) { onUnauthorized(); return; }
    setter(friendlyError(error, fallback));
  }, [onUnauthorized]);

  useEffect(() => {
    const controller = new AbortController();
    setEventsLoading(true); setEventsError("");
    getEvents(token, controller.signal)
      .then((data) => {
        setEvents(data);
        setSelectedEventId((current) => data.some((event) => event.id === current) ? current : (data[0]?.id || ""));
      })
      .catch((error) => { if (error.name !== "AbortError") handleApiError(error, setEventsError, "Unable to load events."); })
      .finally(() => { if (!controller.signal.aborted) setEventsLoading(false); });
    return () => controller.abort();
  }, [token, eventsReload, handleApiError]);

  useEffect(() => {
    setStatistics(null); setStatisticsError("");
    if (!selectedEventId) { setStatisticsLoading(false); return undefined; }
    const controller = new AbortController();
    setStatisticsLoading(true);
    getEventStatistics(selectedEventId, token, controller.signal)
      .then(setStatistics)
      .catch((error) => { if (error.name !== "AbortError") handleApiError(error, setStatisticsError, "Unable to load analytics."); })
      .finally(() => { if (!controller.signal.aborted) setStatisticsLoading(false); });
    return () => controller.abort();
  }, [selectedEventId, token, statisticsReload, handleApiError]);

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
    setSelectedEventId(eventId);
  };

  const handleGenerateAiSummary = async () => {
    if (!selectedEventId || aiInFlight.current) return;
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
        setAiError("AI response could not be displayed.");
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

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div className="header-brand"><div className="brand-mark compact" aria-hidden="true"><span /><span /><span /></div><div><strong>EVENT MANAGER AI</strong><span>Analytics workspace</span></div></div>
        <ManagementNav activeView={activeView} onChange={onViewChange} />
        <div className="user-actions"><div className="user-copy"><strong>{currentUser.full_name}</strong><span className="role-badge">{currentUser.role}</span></div><button type="button" className="secondary-button" onClick={onLogout}>Logout</button></div>
      </header>

      <main className="dashboard-main">
        <section className="dashboard-title-row">
          <div><p className="eyebrow">EVENT INTELLIGENCE</p><h1>Analytics Dashboard</h1><p>Monitor event performance from registrations through attendee feedback.</p></div>
          {!eventsLoading && !eventsError && <EventSelector events={events} selectedEventId={selectedEventId} onChange={handleEventChange} disabled={eventsLoading} />}
        </section>

        {eventsLoading && <div className="state-panel"><div className="app-loader" /><p>Loading events...</p></div>}
        {eventsError && <div className="state-panel error-panel"><strong>Unable to load events</strong><p>{eventsError}</p><button type="button" className="secondary-button" onClick={() => setEventsReload((x) => x + 1)}>Retry</button></div>}
        {!eventsLoading && !eventsError && events.length === 0 && <div className="state-panel"><strong>No events available.</strong><p>Create an event through the API to begin tracking analytics.</p></div>}

        {selectedEvent && <div className="selected-event-line"><span className={`status-badge status-${selectedEvent.status.toLowerCase()}`}>{selectedEvent.status}</span><span>{selectedEvent.title}</span></div>}
        {statisticsLoading && <div className="state-panel"><div className="app-loader" /><p>Loading analytics...</p></div>}
        {statisticsError && <div className="state-panel error-panel"><strong>Unable to load analytics</strong><p>{statisticsError}</p><button type="button" className="secondary-button" onClick={() => setStatisticsReload((x) => x + 1)}>Retry</button></div>}

        {statistics && !statisticsLoading && (
          <div className="analytics-content">
            <section className="kpi-grid" aria-label="Event key performance indicators">
              <KpiCard label="Active Registrations" value={statistics.registrations.registered} detail={`${statistics.registrations.total} total registrations`} />
              <KpiCard label="Checked In" value={statistics.attendance.checked_in} detail={`of ${statistics.registrations.registered} active registrations`} tone="success" />
              <KpiCard label="Attendance Rate" value={formatRate(statistics.attendance.attendance_rate)} detail={`${statistics.attendance.not_checked_in} still expected`} tone="warning" />
              <KpiCard label="Average Rating" value={statistics.feedback.average_rating == null ? "—" : `${statistics.feedback.average_rating} / 5`} detail={`${statistics.feedback.total} feedback responses`} tone="rating" />
            </section>

            <section className="visual-grid"><AttendanceOverview attendance={statistics.attendance} /><RatingDistribution distribution={statistics.feedback.rating_distribution} /></section>

            <section className="summary-panel">
              <div className="summary-heading"><div><p className="eyebrow">EVENT HEALTH</p><h3>Capacity &amp; registrations</h3></div><strong>{formatRate(statistics.capacity.usage_rate)} used</strong></div>
              <div className="capacity-track"><span style={{ width: `${Math.max(0, Math.min(statistics.capacity.usage_rate, 100))}%` }} /></div>
              <div className="summary-grid">
                <div><span>Maximum capacity</span><strong>{statistics.capacity.max_attendees}</strong></div><div><span>Registered</span><strong>{statistics.capacity.registered}</strong></div><div><span>Available</span><strong>{statistics.capacity.available}</strong></div><div><span>Total registrations</span><strong>{statistics.registrations.total}</strong></div><div><span>Active</span><strong>{statistics.registrations.registered}</strong></div><div><span>Cancelled</span><strong>{statistics.registrations.cancelled}</strong></div>
              </div>
            </section>
          </div>
        )}

        {selectedEvent && !eventsLoading && !eventsError && (
          <AIInsightsPanel
            summary={aiSummary}
            loading={aiLoading}
            error={aiError}
            onGenerate={handleGenerateAiSummary}
            disabled={!selectedEventId}
          />
        )}
      </main>
      <footer>Event Manager AI · Analytics data is provided live by the backend.</footer>
    </div>
  );
}

export default DashboardPage;
