import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AnnouncementForm from "../components/AnnouncementForm";
import EventSelector from "../components/EventSelector";
import Pagination from "../components/Pagination";
import WorkspaceHeader from "../components/WorkspaceHeader";
import useAutoRefresh from "../hooks/useAutoRefresh";
import { ANNOUNCEMENT_STATUS_LABELS } from "../locales/vi";
import {
  createAnnouncement,
  deleteAnnouncement,
  generateAnnouncementDraft,
  getAnnouncements,
  getEvents,
  updateAnnouncement,
} from "../services/api";

const EMPTY_FORM = { title: "", content: "" };
const EMPTY_AI = {
  expanded: false,
  purpose: "",
  keyPoints: "",
  tone: "PROFESSIONAL",
  loading: false,
  error: "",
  source: "",
};
const dateFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" });
const formatDate = (value) => (value ? dateFormatter.format(new Date(value)) : "—");

const aiErrorMessage = (error) => {
  if (error.status === 403) return "Bạn không có quyền tạo bản nháp bằng AI.";
  if (error.status === 502) return "Không thể phân tích dữ liệu. Vui lòng thử lại.";
  if (error.status === 503) return "Dịch vụ AI hiện không khả dụng.";
  if (error.status === 0) return "Không thể kết nối đến dịch vụ AI.";
  return "Không thể phân tích dữ liệu.";
};

function AnnouncementsPage({ token, currentUser, onLogout, onUnauthorized, activeView, onViewChange }) {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [announcements, setAnnouncements] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [eventsLoading, setEventsLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [listError, setListError] = useState("");
  const [reload, setReload] = useState(0);

  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formDirty, setFormDirty] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [ai, setAi] = useState(EMPTY_AI);

  const aiSequence = useRef(0);
  const aiInFlight = useRef(false);

  const handleError = useCallback(
    (error, setter, fallback) => {
      if (error.status === 401) {
        onUnauthorized();
        return;
      }
      setter(error.status === 403 ? "Bạn không có quyền quản lý tài nguyên này." : fallback);
    },
    [onUnauthorized]
  );

  // Load events
  useEffect(() => {
    const controller = new AbortController();
    setEventsLoading(true);
    setEventsError("");
    getEvents(token, controller.signal)
      .then((data) => {
        setEvents(data);
        setSelectedEventId((current) =>
          data.some((item) => item.id === current) ? current : data[0]?.id || ""
        );
      })
      .catch((error) => {
        if (error.name !== "AbortError") handleError(error, setEventsError, "Không thể tải danh sách sự kiện.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setEventsLoading(false);
      });
    return () => controller.abort();
  }, [token, handleError]);

  // Load announcements for selected event
  useEffect(() => {
    setAnnouncements([]);
    setListError("");
    if (!selectedEventId) {
      setListLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setListLoading(true);
    getAnnouncements(selectedEventId, token, controller.signal)
      .then(setAnnouncements)
      .catch((error) => {
        if (error.name !== "AbortError") handleError(error, setListError, "Không thể tải danh sách thông báo.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setListLoading(false);
      });
    return () => controller.abort();
  }, [selectedEventId, token, reload, handleError]);

  // Near real-time auto-refresh: re-fetches announcements when not actively editing
  useAutoRefresh(
    () => {
      if (!selectedEventId || editor !== null || formDirty || saving || ai.loading) return;
      getAnnouncements(selectedEventId, token)
        .then(setAnnouncements)
        .catch(() => {});
    },
    { interval: 20000, enabled: Boolean(selectedEventId) && editor === null && !formDirty && !saving && !ai.loading }
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedEventId]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(announcements.length / pageSize));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [announcements.length, pageSize, currentPage]);

  const paginatedAnnouncements = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return announcements.slice(start, start + pageSize);
  }, [announcements, currentPage, pageSize]);

  const resetEditor = () => {
    aiSequence.current += 1;
    aiInFlight.current = false;
    setEditor(null);
    setForm(EMPTY_FORM);
    setFormDirty(false);
    setFormError("");
    setAi(EMPTY_AI);
  };

  const confirmDiscard = () => !formDirty || window.confirm("Hủy các thay đổi chưa lưu?");

  const handleEventChange = (eventId) => {
    if (!confirmDiscard()) return;
    resetEditor();
    setSuccess("");
    setSelectedEventId(eventId);
  };

  const openNew = () => {
    if (!selectedEventId || !confirmDiscard()) return;
    resetEditor();
    setEditor({ id: null, status: "DRAFT" });
  };

  const openEdit = (announcement) => {
    if (!confirmDiscard()) return;
    resetEditor();
    setEditor({ id: announcement.id, status: announcement.status });
    setForm({ title: announcement.title, content: announcement.content });
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
    setFormDirty(true);
    setFormError("");
  };

  const changeAi = (field, value) =>
    setAi((current) => ({ ...current, [field]: value, error: field === "error" ? value : "" }));

  const validateForm = () => {
    const title = form.title.trim();
    const content = form.content.trim();
    if (title.length < 3 || title.length > 200) return "Tiêu đề thông báo phải từ 3 đến 200 ký tự.";
    if (!content || content.length > 5000) return "Nội dung là bắt buộc và không được vượt quá 5.000 ký tự.";
    return "";
  };

  const save = async (targetStatus) => {
    if (!editor || saving) return;
    const validation = validateForm();
    if (validation) {
      setFormError(validation);
      return;
    }
    const payload = { title: form.title.trim(), content: form.content.trim() };
    if (targetStatus) payload.status = targetStatus;
    setSaving(true);
    setFormError("");
    setSuccess("");
    try {
      const result =
        editor.id == null
          ? await createAnnouncement(selectedEventId, { ...payload, status: targetStatus || "DRAFT" }, token)
          : await updateAnnouncement(selectedEventId, editor.id, payload, token);
      setSuccess(
        result.status === "PUBLISHED"
          ? "Đã đăng thông báo thành công tới người tham dự."
          : editor.id == null
          ? "Đã lưu bản nháp thông báo thành công."
          : targetStatus === "DRAFT"
          ? "Đã hủy đăng thông báo (chuyển về Bản nháp)."
          : "Cập nhật thông báo thành công."
      );
      resetEditor();
      setReload((value) => value + 1);
    } catch (error) {
      if (error.status === 401) {
        onUnauthorized();
        return;
      }
      setFormError(editor.id == null ? "Không thể lưu thông báo." : "Không thể cập nhật thông báo.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editor?.id || saving || !window.confirm("Xóa thông báo này? Thao tác này không thể hoàn tác.")) return;
    setSaving(true);
    setFormError("");
    try {
      await deleteAnnouncement(selectedEventId, editor.id, token);
      setSuccess("Đã xóa thông báo thành công.");
      resetEditor();
      setReload((value) => value + 1);
    } catch (error) {
      if (error.status === 401) {
        onUnauthorized();
        return;
      }
      setFormError("Không thể xóa thông báo.");
    } finally {
      setSaving(false);
    }
  };

  const generateDraft = async () => {
    if (!selectedEventId || aiInFlight.current) return;
    const purpose = ai.purpose.trim();
    const keyPoints = ai.keyPoints
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    if (purpose.length < 5 || purpose.length > 500) {
      setAi((current) => ({ ...current, error: "Mục đích phải từ 5 đến 500 ký tự." }));
      return;
    }
    if (keyPoints.length > 10 || keyPoints.some((item) => item.length > 300)) {
      setAi((current) => ({ ...current, error: "Nhập tối đa 10 ý chính, mỗi ý không quá 300 ký tự." }));
      return;
    }
    if (formDirty && (form.title.trim() || form.content.trim()) && !window.confirm("Tạo bản nháp AI mới? Nội dung hiện tại sẽ được cập nhật.")) {
      return;
    }
    aiInFlight.current = true;
    const sequence = aiSequence.current + 1;
    aiSequence.current = sequence;
    const requestedEventId = selectedEventId;
    setAi((current) => ({ ...current, loading: true, error: "" }));
    try {
      const draft = await generateAnnouncementDraft(
        requestedEventId,
        { purpose, key_points: keyPoints, tone: ai.tone },
        token
      );
      if (sequence !== aiSequence.current || requestedEventId !== selectedEventId) return;
      if (
        !draft ||
        typeof draft.title !== "string" ||
        typeof draft.content !== "string" ||
        !["mock", "openai"].includes(draft.source)
      ) {
        setAi((current) => ({ ...current, error: "Không thể hiển thị kết quả từ AI." }));
        return;
      }
      // Populate fields for user to review and edit
      setForm({ title: draft.title, content: draft.content });
      setFormDirty(true);
      setAi((current) => ({ ...current, source: draft.source, error: "" }));
    } catch (error) {
      if (sequence !== aiSequence.current) return;
      if (error.status === 401) {
        onUnauthorized();
        return;
      }
      setAi((current) => ({ ...current, error: aiErrorMessage(error) }));
    } finally {
      if (sequence === aiSequence.current) {
        aiInFlight.current = false;
        setAi((current) => ({ ...current, loading: false }));
      }
    }
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;

  return (
    <div className="dashboard-shell">
      <WorkspaceHeader
        currentUser={currentUser}
        activeView={activeView}
        onNavigate={handleViewChange}
        onLogout={onLogout}
        workspaceLabel="Truyền thông & Thông báo sự kiện"
      />

      <main className="dashboard-main announcements-page">
        {/* Banner with Event Selector */}
        <section className="dashboard-hero-banner" style={{ padding: "12px 18px", marginBottom: "12px" }}>
          <div className="hero-banner-content">
            <div className="hero-banner-headings">
              <p className="hero-eyebrow">TRUYỀN THÔNG SỰ KIỆN</p>
              <h1 style={{ fontSize: "1.4rem", margin: "0.15rem 0 0.25rem" }}>Thông báo sự kiện</h1>
              <p className="hero-banner-desc">
                Soạn thảo, cập nhật và phát hành thông báo tức thì đến người tham dự với sự hỗ trợ của AI.
              </p>
            </div>

            <div className="hero-event-selector">
              {!eventsLoading && !eventsError && (
                <EventSelector
                  events={events}
                  selectedEventId={selectedEventId}
                  onChange={handleEventChange}
                  disabled={eventsLoading || saving || ai.loading}
                />
              )}
            </div>
          </div>
        </section>

        {success && <div className="inline-message success-message page-message" role="status">{success}</div>}

        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div>
            {selectedEvent && (
              <span style={{ fontSize: "0.84rem", color: "var(--primary-hover)" }}>
                Đang xem thông báo của: <strong style={{ color: "var(--text-primary)" }}>{selectedEvent.title}</strong>
              </span>
            )}
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={openNew}
            disabled={!selectedEventId || eventsLoading}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", minHeight: "38px", padding: "8px 16px" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Tạo thông báo mới
          </button>
        </div>

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
          </div>
        )}

        {!eventsLoading && !eventsError && events.length === 0 && (
          <div className="state-panel">
            <strong>Không có sự kiện nào khả dụng.</strong>
            <p>Hãy tạo sự kiện trước khi soạn thông báo.</p>
          </div>
        )}

        {/* Announcements Main Workspace (List + Editor) */}
        {selectedEventId && !eventsLoading && !eventsError && (
          <div className="announcement-workspace-grid">
            {/* Left Column: Announcements Cards List */}
            <div className="announcements-cards-column">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom: "0.5rem",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                  Danh sách thông báo ({announcements.length})
                </h3>
              </div>

              {listLoading && (
                <div className="compact-state">
                  <div className="app-loader" />
                  <span>Đang tải thông báo...</span>
                </div>
              )}

              {listError && (
                <div className="inline-message error-message" role="alert">
                  {listError}
                  <button type="button" className="text-button" onClick={() => setReload((v) => v + 1)}>
                    Thử lại
                  </button>
                </div>
              )}

              {!listLoading && !listError && announcements.length === 0 && (
                <div className="compact-state" style={{ padding: "1.5rem 1.25rem" }}>
                  <strong style={{ fontSize: "1rem" }}>Chưa có thông báo nào cho sự kiện này.</strong>
                  <p style={{ margin: "0.3rem 0 0.85rem", fontSize: "0.85rem" }}>Bắt đầu soạn bản tin đầu tiên để truyền tải thông tin đến người tham dự.</p>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={openNew}
                    disabled={!selectedEventId}
                    style={{ minHeight: "36px", padding: "6px 14px" }}
                  >
                    + Tạo thông báo đầu tiên
                  </button>
                </div>
              )}

              {!listLoading && announcements.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {paginatedAnnouncements.map((item) => {
                    const isSelected = editor?.id === item.id;
                    const statusClass = `status-badge-${item.status.toLowerCase()}`;

                    return (
                      <article
                        key={item.id}
                        className={`announcement-modern-card ${isSelected ? "selected" : ""}`}
                      >
                        <div className="announcement-card-head">
                          <span className={`mgmt-card-status-badge ${statusClass}`} style={{ position: "static" }}>
                            {ANNOUNCEMENT_STATUS_LABELS[item.status] || item.status}
                          </span>
                          <button
                            type="button"
                            className="speaker-btn-edit"
                            onClick={() => openEdit(item)}
                          >
                            Chỉnh sửa
                          </button>
                        </div>

                        <h4 className="announcement-card-title">{item.title}</h4>
                        <p className="announcement-card-preview">{item.content}</p>

                        <div className="announcement-card-meta">
                          <span>Khởi tạo: {formatDate(item.created_at || item.updated_at)}</span>
                          {item.published_at && (
                            <span style={{ color: "var(--success-text)", fontWeight: 600 }}>
                              ✓ Đã đăng: {formatDate(item.published_at)}
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}

                  <Pagination
                    totalItems={announcements.length}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    itemLabel="thông báo"
                    hideIfSinglePage={true}
                  />
                </div>
              )}
            </div>

            {/* Right Column: Announcement Editor (With AI Assistant) */}
            <div>
              {editor ? (
                <AnnouncementForm
                  editor={editor}
                  form={form}
                  onFormChange={changeForm}
                  onClose={closeEditor}
                  onSave={save}
                  onDelete={remove}
                  saving={saving}
                  formError={formError}
                  ai={ai}
                  onAiChange={changeAi}
                  onGenerate={generateDraft}
                />
              ) : (
                <div
                  className="form-section-card"
                  style={{
                    textAlign: "center",
                    padding: "2rem 1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div className="ai-sparkle-icon" style={{ width: 42, height: 42, margin: "0 auto 0.75rem" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                  </div>
                  <h4 style={{ color: "var(--text-primary)", margin: "0 0 0.35rem", fontSize: "1.05rem" }}>Trình biên tập thông báo</h4>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", maxWidth: 340, margin: "0 0 1rem" }}>
                    Chọn một thông báo từ danh sách bên trái để xem và sửa, hoặc bấm nút tạo thông báo mới với sự hỗ trợ của AI.
                  </p>
                  <button type="button" className="primary-button" onClick={openNew} disabled={!selectedEventId} style={{ minHeight: "38px", padding: "8px 16px" }}>
                    + Soạn thông báo mới
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="dashboard-footer">
        Event Manager AI · Thông báo được bảo mật và truyền tải tức thời tới tài khoản người tham dự.
      </footer>
    </div>
  );
}

export default AnnouncementsPage;
