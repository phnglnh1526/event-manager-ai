import React, { useCallback, useEffect, useState } from "react";
import { getEventRegistrations, getEventStatistics } from "../services/api";

const FILTERS = ["ALL", "REGISTERED", "CANCELLED"];
const displayTimestamp = (value) => typeof value === "string" ? value.slice(0, 16).replace("T", " ") : "—";
const formatRate = (value) => Number(value || 0).toFixed(2).replace(/\.00$/, "");

function RegistrationManagement({ event, token, onUnauthorized }) {
  const [registrations, setRegistrations] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [reload, setReload] = useState(0);

  const message = useCallback((error, fallback) => {
    if (error.status === 401) { onUnauthorized(); return ""; }
    if (error.status === 403) return "You do not have permission to view registrations for this event.";
    if (error.status === 404) return "Event not found.";
    if (error.status === 0) return fallback;
    return fallback;
  }, [onUnauthorized]);

  useEffect(() => {
    const controller = new AbortController();
    setRegistrations([]); setStatistics(null); setFilter("ALL"); setListError(""); setSummaryError(""); setListLoading(true); setSummaryLoading(true);
    getEventRegistrations(event.id, token, controller.signal)
      .then(setRegistrations)
      .catch((error) => { if (error.name !== "AbortError") setListError(message(error, "Unable to load registrations.")); })
      .finally(() => { if (!controller.signal.aborted) setListLoading(false); });
    getEventStatistics(event.id, token, controller.signal)
      .then(setStatistics)
      .catch((error) => { if (error.name !== "AbortError") setSummaryError(message(error, "Unable to load registration summary.")); })
      .finally(() => { if (!controller.signal.aborted) setSummaryLoading(false); });
    return () => controller.abort();
  }, [event.id, token, reload, message]);

  const visible = filter === "ALL" ? registrations : registrations.filter((item) => item.status === filter);
  const registeredCount = statistics?.registrations?.registered ?? 0;
  const totalCount = statistics?.registrations?.total ?? 0;
  const cancelledCount = statistics?.registrations?.cancelled ?? 0;
  const maxAttendees = statistics?.capacity?.max_attendees ?? event.max_attendees;
  const available = statistics?.capacity?.available ?? maxAttendees;
  const usageRate = statistics?.capacity?.usage_rate ?? 0;
  const progress = Math.max(0, Math.min(usageRate, 100));

  return <section className="registration-management">
    <div className="registration-heading"><div><p className="eyebrow">EVENT REGISTRATIONS</p><h3>Registrations</h3><span>{event.title}</span></div><span className="read-only-badge">Read only</span></div>
    {summaryLoading ? <div className="compact-state"><p>Loading registration summary...</p></div> : summaryError ? <div className="inline-message error-message">{summaryError}</div> : <><div className="registration-metrics"><article><span>Total registrations</span><strong>{totalCount}</strong></article><article><span>Active</span><strong>{registeredCount}</strong></article><article><span>Cancelled</span><strong>{cancelledCount}</strong></article><article><span>Capacity</span><strong>{registeredCount} / {maxAttendees}</strong></article></div><div className="registration-capacity"><div><strong>Capacity usage</strong><span>{formatRate(usageRate)}%</span></div><div className="capacity-track"><span style={{ width: `${progress}%` }} /></div><p>{available} slot{available === 1 ? "" : "s"} available{available === 0 ? " · Event capacity reached" : ""}</p></div></>}
    <div className="registration-filters" aria-label="Filter registrations">{FILTERS.map((value) => <button type="button" key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "ALL" ? "All" : value[0] + value.slice(1).toLowerCase()}</button>)}</div>
    {listLoading && <div className="compact-state"><div className="app-loader" /><p>Loading registrations...</p></div>}
    {listError && <div className="inline-message error-message">{listError}<button type="button" className="text-button" onClick={() => setReload((value) => value + 1)}>Retry</button></div>}
    {!listLoading && !listError && registrations.length === 0 && <div className="compact-state"><strong>No registrations yet.</strong><p>Attendee registrations will appear here.</p></div>}
    {!listLoading && !listError && registrations.length > 0 && visible.length === 0 && <div className="compact-state"><strong>No registrations match this filter.</strong></div>}
    {!listLoading && !listError && visible.length > 0 && <div className="registration-list">{visible.map((registration) => <article className="registration-row" key={registration.id}><div><strong>User #{registration.user_id}</strong><span>Registration #{registration.id}</span></div><span className={`registration-status status-${registration.status.toLowerCase()}`}>{registration.status}</span><div><span>Registered</span><strong>{displayTimestamp(registration.created_at)}</strong></div><div><span>Updated</span><strong>{displayTimestamp(registration.updated_at)}</strong></div></article>)}</div>}
  </section>;
}

export default RegistrationManagement;
