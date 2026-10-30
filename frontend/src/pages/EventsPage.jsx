import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import EventAIChat from "../components/EventAIChat";
import EventCoverImage from "../components/EventCoverImage";
import EventForm from "../components/EventForm";
import Pagination from "../components/Pagination";
import RegistrationManagement from "../components/RegistrationManagement";
import ScheduleManagement from "../components/ScheduleManagement";
import SpeakerManagement from "../components/SpeakerManagement";
import WorkspaceHeader from "../components/WorkspaceHeader";
import useAutoRefresh from "../hooks/useAutoRefresh";
import { EVENT_STATUS_LABELS } from "../locales/vi";
import { createEvent, deleteEvent, getEvent, getEvents, updateEvent, uploadEventImage } from "../services/api";

const EMPTY_FORM = {
  title: "",
  description: "",
  location: "",
  start_time: "",
  end_time: "",
  status: "DRAFT",
  max_attendees: "100",
  cover_image_url: null,
  pendingFile: null,
};

const FILTERS = ["ALL", "DRAFT", "PUBLISHED", "COMPLETED", "CANCELLED"];

const DATE_FILTERS = [
  { value: "ALL", label: "Tất cả thời gian" },
  { value: "UPCOMING", label: "Sắp diễn ra" },
  { value: "ONGOING", label: "Đang diễn ra" },
  { value: "PAST", label: "Đã qua" },
];

const DELETE_WARNING =
  "Xóa sự kiện này sẽ xóa vĩnh viễn các dữ liệu liên quan, bao gồm lịch trình, diễn giả, đăng ký, vé, check-in, phản hồi và thông báo. Thao tác này không thể hoàn tác.";

const toDateTimeLocalValue = (value) => (typeof value === "string" ? value.slice(0, 16) : "");

const displayDateTime = (value) => {
  if (typeof value !== "string" || !value) return "—";
  const trimmed = value.slice(0, 16);
  const parts = trimmed.split("T");
  if (parts.length === 2) {
    const [datePart, timePart] = parts;
    const dateSub = datePart.split("-");
    if (dateSub.length === 3) {
      return `${dateSub[2]}/${dateSub[1]}/${dateSub[0]} ${timePart}`;
    }
  }
  return trimmed.replace("T", " ");
};

function EventsPage({ token, currentUser, onLogout, onUnauthorized, activeView, onViewChange }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reload, setReload] = useState(0);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  // Editor modal state
  const [editorId, setEditorId] = useState(undefined); // undefined = closed, null = new, number = edit
  const [form, setForm] = useState(EMPTY_FORM);
  const [dirty, setDirty] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Detail workspace drawer state
  const [detail, setDetail] = useState(null);
  const [workspaceTab, setWorkspaceTab] = useState("overview");
  const [speakerDirty, setSpeakerDirty] = useState(false);

  const requestInFlight = useRef(false);

  const handleRequestError = useCallback(
    (requestError, fallback) => {
      if (requestError.status === 401) {
        onUnauthorized();
        return;
      }
      if (requestError.status === 403) {
        setError("Bạn không có quyền quản lý sự kiện.");
        return;
      }
      setError(requestError.status === 0 ? "Không thể kết nối đến máy chủ." : fallback);
    },
    [onUnauthorized]
  );

  // Load events list
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getEvents(token, controller.signal)
      .then(setEvents)
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          handleRequestError(requestError, "Không thể tải danh sách sự kiện.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, reload, handleRequestError]);

  // Near real-time auto-refresh: re-fetches events list periodically and on tab focus when not actively editing
  useAutoRefresh(
    () => {
      if (editorId !== undefined || dirty || submitting) return;
      getEvents(token)
        .then((items) => {
          setEvents(items);
        })
        .catch(() => {});
    },
    { interval: 20000, enabled: editorId === undefined && !dirty && !submitting }
  );

  const confirmDiscard = () => (!dirty && !speakerDirty) || window.confirm("Hủy các thay đổi chưa lưu?");

  const resetEditor = () => {
    setEditorId(undefined);
    setForm(EMPTY_FORM);
    setDirty(false);
    setFormError("");
  };

  const closeEditor = () => {
    if (confirmDiscard()) resetEditor();
  };

  const handleViewChange = (view) => {
    if (!confirmDiscard()) return;
    resetEditor();
    onViewChange(view);
  };

  const changeForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setFormError("");
  };

  const openNew = () => {
    if (!confirmDiscard()) return;
    resetEditor();
    setForm(EMPTY_FORM);
    setEditorId(null);
  };

  const loadEvent = async (eventId, editMode, targetTab = "overview") => {
    if (!confirmDiscard()) return;
    if (editorId !== undefined) resetEditor();
    setError("");
    setFormError("");

    try {
      const event = await getEvent(eventId, token);
      if (editMode) {
        setDetail(null);
        setSpeakerDirty(false);
        setEditorId(event.id);
        setDirty(false);
        setForm({
          title: event.title,
          description: event.description || "",
          location: event.location,
          start_time: toDateTimeLocalValue(event.start_time),
          end_time: toDateTimeLocalValue(event.end_time),
          status: event.status,
          max_attendees: String(event.max_attendees),
          cover_image_url: event.cover_image_url || null,
          pendingFile: null,
        });
      } else {
        setDetail(event);
        setWorkspaceTab(targetTab);
        setSpeakerDirty(false);
      }
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized();
        return;
      }
      setError(
        requestError.status === 404
          ? "Không tìm thấy sự kiện."
          : requestError.status === 0
          ? "Không thể kết nối đến máy chủ."
          : "Không thể tải thông tin sự kiện."
      );
      if (requestError.status === 404) setReload((value) => value + 1);
    }
  };

  const validate = () => {
    const title = form.title.trim();
    const location = form.location.trim();
    const capacity = Number(form.max_attendees);
    if (title.length < 3 || title.length > 200) return "Tên sự kiện phải từ 3 đến 200 ký tự.";
    if (location.length < 2 || location.length > 255) return "Địa điểm phải từ 2 đến 255 ký tự.";
    if (!form.start_time || !form.end_time) return "Vui lòng nhập thời gian bắt đầu và kết thúc.";
    if (form.end_time <= form.start_time) return "Thời gian kết thúc phải sau thời gian bắt đầu.";
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000)
      return "Sức chứa tối đa phải là số nguyên từ 1 đến 100.000.";
    return "";
  };

  const submit = async () => {
    if (requestInFlight.current) return;
    const validation = validate();
    if (validation) {
      setFormError(validation);
      return;
    }
    requestInFlight.current = true;
    setSubmitting(true);
    setFormError("");
    setSuccess("");

    let finalCoverImageUrl = form.cover_image_url;

    // Upload pending file to Cloudinary first if user selected an image
    if (form.pendingFile) {
      try {
        const uploadResult = await uploadEventImage(form.pendingFile, token);
        finalCoverImageUrl = uploadResult.url;
      } catch (uploadErr) {
        requestInFlight.current = false;
        setSubmitting(false);
        if (uploadErr.status === 401) {
          onUnauthorized();
          return;
        }
        setFormError(uploadErr.message || "Tải ảnh sự kiện thất bại. Vui lòng thử lại.");
        return;
      }
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      cover_image_url: finalCoverImageUrl,
      location: form.location.trim(),
      start_time: form.start_time,
      end_time: form.end_time,
      status: form.status,
      max_attendees: Number(form.max_attendees),
    };

    try {
      const result =
        editorId == null ? await createEvent(payload, token) : await updateEvent(editorId, payload, token);
      setSuccess(editorId == null ? "Tạo sự kiện thành công." : "Cập nhật sự kiện thành công.");
      resetEditor();
      setDetail(result);
      setEvents((prev) => {
        if (editorId == null) {
          return [result, ...prev];
        }
        return prev.map((e) => (e.id === result.id ? result : e));
      });
      setWorkspaceTab("overview");
      setSpeakerDirty(false);
      setReload((value) => value + 1);
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized();
        return;
      }
      if (requestError.status === 403) setFormError("Bạn không có quyền quản lý sự kiện.");
      else if (requestError.status === 404) {
        setFormError("Không tìm thấy sự kiện.");
        setReload((value) => value + 1);
      } else if (requestError.status === 422) {
        setFormError("Vui lòng kiểm tra lại các trường thông tin và thử lại.");
      } else {
        setFormError(
          requestError.status === 0
            ? "Không thể kết nối đến máy chủ."
            : editorId == null
            ? "Không thể tạo sự kiện."
            : "Không thể cập nhật sự kiện."
        );
      }
    } finally {
      requestInFlight.current = false;
      setSubmitting(false);
    }
  };

  const remove = async (targetId = editorId) => {
    if (targetId == null || requestInFlight.current || !window.confirm(DELETE_WARNING)) return;
    requestInFlight.current = true;
    setSubmitting(true);
    setFormError("");
    setSuccess("");
    try {
      await deleteEvent(targetId, token);
      setSuccess("Xóa sự kiện thành công.");
      if (editorId === targetId) resetEditor();
      if (detail?.id === targetId) setDetail(null);
      setReload((value) => value + 1);
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized();
        return;
      }
      if (requestError.status === 403) setFormError("Bạn không có quyền quản lý sự kiện.");
      else if (requestError.status === 404) {
        setFormError("Không tìm thấy sự kiện.");
        setReload((value) => value + 1);
      } else {
        setFormError(requestError.status === 0 ? "Không thể kết nối đến máy chủ." : "Không thể xóa sự kiện.");
      }
    } finally {
      requestInFlight.current = false;
      setSubmitting(false);
    }
  };

  // Filter & Search Logic
  const filteredEvents = useMemo(() => {
    const now = new Date();
    return events.filter((event) => {
      // 1. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = event.title?.toLowerCase().includes(q);
        const matchLoc = event.location?.toLowerCase().includes(q);
        const matchDesc = event.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchLoc && !matchDesc) return false;
      }

      // 2. Status filter
      if (statusFilter !== "ALL" && event.status !== statusFilter) {
        return false;
      }

      // 3. Date filter
      if (dateFilter !== "ALL") {
        const start = new Date(event.start_time);
        const end = new Date(event.end_time);
        if (dateFilter === "UPCOMING" && start <= now) return false;
        if (dateFilter === "ONGOING" && (start > now || end < now)) return false;
        if (dateFilter === "PAST" && end >= now) return false;
      }

      return true;
    });
  }, [events, searchQuery, statusFilter, dateFilter]);

  // Counts by status for pills
  const statusCounts = useMemo(() => {
    const counts = { ALL: events.length, DRAFT: 0, PUBLISHED: 0, COMPLETED: 0, CANCELLED: 0 };
    events.forEach((ev) => {
      if (counts[ev.status] !== undefined) counts[ev.status] += 1;
    });
    return counts;
  }, [events]);

  const hasActiveFilters = searchQuery.trim() !== "" || statusFilter !== "ALL" || dateFilter !== "ALL";

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setDateFilter("ALL");
  };

  // Reset page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, dateFilter]);

  // Clamp current page within valid range
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [filteredEvents.length, pageSize, currentPage]);

  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage, pageSize]);

  return (
    <div className="dashboard-shell">
      <WorkspaceHeader
        currentUser={currentUser}
        activeView={activeView}
        onNavigate={handleViewChange}
        onLogout={onLogout}
        workspaceLabel="Không gian quản lý sự kiện"
      />

      <main className="dashboard-main events-page">
        {/* Page Title & Add Button */}
        <section className="events-page-header">
          <div className="events-header-info">
            <p className="hero-eyebrow">VẬN HÀNH SỰ KIỆN</p>
            <h1>Quản lý sự kiện</h1>
            <p>Tạo, theo dõi và cấu hình toàn diện vòng đời của các sự kiện trong hệ thống.</p>
          </div>
          <div className="events-header-actions">
            <button
              type="button"
              className="primary-button"
              onClick={openNew}
              disabled={submitting}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Thêm sự kiện
            </button>
          </div>
        </section>

        {success && (
          <div className="inline-message success-message page-message" role="status">
            {success}
          </div>
        )}

        {/* Filter Bar (Search + Date + Status Pills) */}
        <section className="events-filter-bar" aria-label="Bộ lọc sự kiện">
          <div className="filter-bar-top">
            <div className="filter-search-box">
              <svg
                className="filter-search-icon"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="filter-search-input"
                placeholder="Tìm theo tên sự kiện, địa điểm, mô tả..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="filter-search-clear"
                  onClick={() => setSearchQuery("")}
                  title="Xóa tìm kiếm"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              className="filter-date-select"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Lọc theo thời gian"
            >
              {DATE_FILTERS.map((df) => (
                <option key={df.value} value={df.value}>
                  {df.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-bar-bottom">
            <div className="filter-status-pills" role="tablist" aria-label="Lọc theo trạng thái">
              {FILTERS.map((status) => {
                const isActive = statusFilter === status;
                const label = status === "ALL" ? "Tất cả" : EVENT_STATUS_LABELS[status] || status;
                const count = statusCounts[status] || 0;
                return (
                  <button
                    type="button"
                    key={status}
                    className={`status-pill-btn ${isActive ? "active" : ""}`}
                    onClick={() => setStatusFilter(status)}
                    role="tab"
                    aria-selected={isActive}
                  >
                    <span>{label}</span>
                    <span className="pill-count">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="filter-summary-info">
              <span>
                Hiển thị <strong className="filter-summary-count">{filteredEvents.length}</strong> / {events.length} sự kiện
              </span>
              {hasActiveFilters && (
                <button type="button" className="filter-reset-btn" onClick={clearFilters}>
                  Đặt lại lọc
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Loading State */}
        {loading && (
          <div className="state-panel">
            <div className="app-loader" />
            <p>Đang tải danh sách sự kiện...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="state-panel error-panel">
            <strong>Không thể tải sự kiện</strong>
            <p>{error}</p>
            <button type="button" className="secondary-button" onClick={() => setReload((value) => value + 1)}>
              Thử lại
            </button>
          </div>
        )}

        {/* Empty State (0 events at all) */}
        {!loading && !error && events.length === 0 && (
          <div className="state-panel">
            <strong>Chưa có sự kiện nào.</strong>
            <p>Hãy tạo sự kiện đầu tiên để bắt đầu quản lý hoạt động và người tham gia.</p>
            <button type="button" className="primary-button" onClick={openNew}>
              Tạo sự kiện đầu tiên
            </button>
          </div>
        )}

        {/* Empty Search/Filter Result State */}
        {!loading && !error && events.length > 0 && filteredEvents.length === 0 && (
          <div className="state-panel">
            <strong>Không tìm thấy sự kiện phù hợp</strong>
            <p>Không có sự kiện nào khớp với tiêu chí tìm kiếm và bộ lọc hiện tại.</p>
            <button type="button" className="secondary-button" onClick={clearFilters}>
              Xóa bộ lọc
            </button>
          </div>
        )}

        {/* EVENT CARDS GRID */}
        {!loading && !error && filteredEvents.length > 0 && (
          <>
            <section className="events-cards-grid" aria-label="Danh sách thẻ sự kiện">
              {paginatedEvents.map((event) => {
                const isSelected = detail?.id === event.id;
                const canManage = currentUser?.role === "ADMIN" || currentUser?.id === event.owner_id;
                const statusClass = `status-badge-${event.status.toLowerCase()}`;
                const statusLabel = EVENT_STATUS_LABELS[event.status] || event.status;

                return (
                  <article
                    key={event.id}
                    className={`event-mgmt-card ${isSelected ? "selected" : ""}`}
                  >
                    {/* Media Cover Image with Badges */}
                    <div className="mgmt-card-media">
                      <EventCoverImage src={event.cover_image_url} alt={event.title} />

                      <span className={`mgmt-card-status-badge ${statusClass}`}>
                        {statusLabel}
                      </span>

                      <span className="mgmt-card-date-tag">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        {displayDateTime(event.start_time)}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="mgmt-card-body">
                      <h3 className="mgmt-card-title">{event.title}</h3>
                      <p className="mgmt-card-desc">{event.description || "Chưa có mô tả chi tiết."}</p>

                      <div className="mgmt-card-meta">
                        <div className="mgmt-meta-item">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span>{event.location}</span>
                        </div>

                        <div className="mgmt-meta-item">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                          <span>
                            Sức chứa: <strong>{event.max_attendees} người</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="mgmt-card-actions">
                      <button
                        type="button"
                        className="mgmt-btn-view"
                        onClick={() => loadEvent(event.id, false, "overview")}
                        title="Xem chi tiết & không gian sự kiện"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Xem
                      </button>

                      {canManage && (
                        <>
                          <button
                            type="button"
                            className="mgmt-btn-edit"
                            onClick={() => loadEvent(event.id, true)}
                            title="Chỉnh sửa thông tin sự kiện"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Sửa
                          </button>

                          <button
                            type="button"
                            className="mgmt-btn-delete"
                            onClick={() => remove(event.id)}
                            title="Xóa sự kiện"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>

            <Pagination
              totalItems={filteredEvents.length}
              currentPage={currentPage}
              pageSize={pageSize}
              pageSizeOptions={[9, 18, 27]}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              itemLabel="sự kiện"
              hideIfSinglePage={true}
              standalone={true}
            />
          </>
        )}

        {/* EVENT CREATE / EDIT MODAL */}
        {editorId !== undefined && (
          <EventForm
            eventId={editorId}
            form={form}
            onChange={changeForm}
            onClose={closeEditor}
            onSubmit={submit}
            onDelete={() => remove(editorId)}
            loading={submitting}
            error={formError}
          />
        )}

        {/* EVENT DETAIL WORKSPACE DRAWER (TABS: OVERVIEW, SPEAKERS, SCHEDULE, REGS, AI) */}
        {editorId === undefined && detail && (
          <div
            className="event-workspace-drawer-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget && confirmDiscard()) {
                setDetail(null);
                setSpeakerDirty(false);
              }
            }}
          >
            <aside className="event-workspace-drawer" aria-labelledby="workspace-drawer-title">
              <div className="workspace-drawer-header">
                <div>
                  <span className={`mgmt-card-status-badge status-badge-${detail.status.toLowerCase()}`}>
                    {EVENT_STATUS_LABELS[detail.status] || detail.status}
                  </span>
                  <h2 id="workspace-drawer-title">{detail.title}</h2>
                  <div className="workspace-context-meta">
                    <span>{displayDateTime(detail.start_time)} – {displayDateTime(detail.end_time)}</span>
                    <span>•</span>
                    <span>{detail.location}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="event-modal-close-btn"
                  onClick={() => {
                    if (confirmDiscard()) {
                      setDetail(null);
                      setSpeakerDirty(false);
                    }
                  }}
                  aria-label="Đóng chi tiết"
                >
                  ✕
                </button>
              </div>

              {/* Workspace Navigation Tabs */}
              <div className="workspace-tab-nav" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={workspaceTab === "overview"}
                  className={`workspace-tab-btn ${workspaceTab === "overview" ? "active" : ""}`}
                  onClick={() => {
                    if (confirmDiscard()) {
                      setWorkspaceTab("overview");
                      setSpeakerDirty(false);
                    }
                  }}
                >
                  Tổng quan
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={workspaceTab === "speakers"}
                  className={`workspace-tab-btn ${workspaceTab === "speakers" ? "active" : ""}`}
                  onClick={() => {
                    if (confirmDiscard()) {
                      setWorkspaceTab("speakers");
                      setSpeakerDirty(false);
                    }
                  }}
                >
                  Diễn giả
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={workspaceTab === "schedule"}
                  className={`workspace-tab-btn ${workspaceTab === "schedule" ? "active" : ""}`}
                  onClick={() => {
                    if (confirmDiscard()) {
                      setWorkspaceTab("schedule");
                      setSpeakerDirty(false);
                    }
                  }}
                >
                  Lịch trình
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={workspaceTab === "registrations"}
                  className={`workspace-tab-btn ${workspaceTab === "registrations" ? "active" : ""}`}
                  onClick={() => {
                    if (confirmDiscard()) {
                      setWorkspaceTab("registrations");
                      setSpeakerDirty(false);
                    }
                  }}
                >
                  Đăng ký
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={workspaceTab === "ai"}
                  className={`workspace-tab-btn ${workspaceTab === "ai" ? "active" : ""}`}
                  onClick={() => {
                    if (confirmDiscard()) {
                      setWorkspaceTab("ai");
                      setSpeakerDirty(false);
                    }
                  }}
                >
                  Hỏi AI
                </button>
              </div>

              {/* Tab Contents */}
              <div className="workspace-drawer-body">
                {workspaceTab === "overview" ? (
                  <div className="event-overview">
                    <div className="event-overview-hero">
                      <EventCoverImage src={detail.cover_image_url} alt={detail.title} />
                    </div>
                    {detail.description && (
                      <div className="event-detail-description-box">
                        <p className="event-detail-description">{detail.description}</p>
                      </div>
                    )}
                    <div className="event-spec-grid">
                      <div className="event-spec-item">
                        <span className="spec-label">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          Địa điểm
                        </span>
                        <strong className="spec-value">{detail.location}</strong>
                      </div>

                      <div className="event-spec-item">
                        <span className="spec-label">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          Bắt đầu
                        </span>
                        <strong className="spec-value">{displayDateTime(detail.start_time)}</strong>
                      </div>

                      <div className="event-spec-item">
                        <span className="spec-label">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          Kết thúc
                        </span>
                        <strong className="spec-value">{displayDateTime(detail.end_time)}</strong>
                      </div>

                      <div className="event-spec-item">
                        <span className="spec-label">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                          Sức chứa tối đa
                        </span>
                        <strong className="spec-value">{detail.max_attendees} người</strong>
                      </div>

                      <div className="event-spec-item">
                        <span className="spec-label">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          Ngày tạo
                        </span>
                        <strong className="spec-value">{displayDateTime(detail.created_at)}</strong>
                      </div>

                      <div className="event-spec-item">
                        <span className="spec-label">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          Cập nhật lần cuối
                        </span>
                        <strong className="spec-value">{displayDateTime(detail.updated_at)}</strong>
                      </div>
                    </div>

                    <div className="event-overview-footer-actions">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => loadEvent(detail.id, true)}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Chỉnh sửa sự kiện này
                      </button>
                    </div>
                  </div>
                ) : workspaceTab === "speakers" ? (
                  <SpeakerManagement
                    key={`speakers-${detail.id}`}
                    event={detail}
                    token={token}
                    onUnauthorized={onUnauthorized}
                    onDirtyChange={setSpeakerDirty}
                  />
                ) : workspaceTab === "schedule" ? (
                  <ScheduleManagement
                    key={`schedule-${detail.id}`}
                    event={detail}
                    token={token}
                    onUnauthorized={onUnauthorized}
                    onDirtyChange={setSpeakerDirty}
                  />
                ) : workspaceTab === "registrations" ? (
                  <RegistrationManagement
                    key={`registrations-${detail.id}`}
                    event={detail}
                    token={token}
                    onUnauthorized={onUnauthorized}
                  />
                ) : (
                  <EventAIChat
                    key={`ai-${detail.id}`}
                    event={detail}
                    token={token}
                    onUnauthorized={onUnauthorized}
                  />
                )}
              </div>
            </aside>
          </div>
        )}
      </main>

      <footer className="dashboard-footer">
        Event Manager AI · Vận hành và quản lý sự kiện thông minh với bảo mật đa tầng.
      </footer>
    </div>
  );
}

export default EventsPage;
