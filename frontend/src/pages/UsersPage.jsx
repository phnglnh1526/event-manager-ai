import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import PasswordInput from "../components/PasswordInput";
import WorkspaceHeader from "../components/WorkspaceHeader";
import { createUser, getUsers, resetUserPassword, updateUser } from "../services/api";

const ROLES = ["ATTENDEE", "STAFF", "ORGANIZER", "ADMIN"];
const ROLE_LABELS = {
  ADMIN: "Quản trị viên",
  ORGANIZER: "Ban tổ chức",
  STAFF: "Nhân viên",
  ATTENDEE: "Người tham dự",
};
const EMPTY_FORM = { full_name: "", email: "", password: "", role: "ATTENDEE", is_active: true };

function userErrorMessage(error) {
  if (error.status === 400) return error.message || "Yêu cầu cập nhật không hợp lệ.";
  if (error.status === 403) return "Bạn không có quyền quản lý người dùng.";
  if (error.status === 404) return "Không tìm thấy tài khoản cần cập nhật.";
  if (error.status === 409) {
    if (error.message === "Email already registered") return "Email này đã thuộc về một tài khoản khác.";
    if (error.message.includes("own account")) return "Bạn không thể tự vô hiệu hóa tài khoản của mình.";
    if (error.message.includes("own ADMIN role")) return "Bạn không thể tự thay đổi vai trò Quản trị viên.";
    if (error.message.includes("last active ADMIN"))
      return "Không thể vô hiệu hóa hoặc hạ quyền Quản trị viên đang hoạt động cuối cùng.";
    return error.message || "Không thể cập nhật do xung đột dữ liệu.";
  }
  if (error.status === 422 && Array.isArray(error.details)) {
    const issue = error.details[0];
    const field = issue?.loc?.at(-1);
    const labels = { full_name: "Họ và tên", email: "Email", role: "Vai trò", is_active: "Trạng thái" };
    return `${labels[field] || "Thông tin người dùng"}: ${issue?.msg || "giá trị không hợp lệ"}.`;
  }
  if (error.status === 422) return "Xem lại các trường thông tin người dùng và vai trò.";
  return "Không thể cập nhật tài khoản. Vui lòng thử lại.";
}

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : parts[0]?.slice(0, 2) || "U").toUpperCase();
}

function friendlyDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function RoleBadge({ role }) {
  const roleClass = `role-badge-${role.toLowerCase()}`;
  return (
    <span className={`reg-status-badge ${roleClass}`} title={role}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

function StatusBadge({ active }) {
  return (
    <span className={`user-status-badge ${active ? "active" : "inactive"}`}>
      <span aria-hidden="true" />
      {active ? "Hoạt động" : "Vô hiệu"}
    </span>
  );
}

function ConfirmDialog({ confirmation, busy, onCancel, onConfirm }) {
  useEffect(() => {
    const closeOnEscape = (event) => event.key === "Escape" && confirmation && !busy && onCancel();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [confirmation, busy, onCancel]);

  if (!confirmation) return null;
  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}
    >
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
      >
        <div
          className={`confirm-icon ${confirmation.destructive ? "destructive" : "positive"}`}
          aria-hidden="true"
        >
          {confirmation.destructive ? "!" : "✓"}
        </div>
        <h2 id="confirm-title">{confirmation.title}</h2>
        <p id="confirm-description">{confirmation.message}</p>
        <div className="confirm-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>
            Hủy
          </button>
          <button
            type="button"
            className={confirmation.destructive ? "danger-button" : "primary-button"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Đang xử lý..." : confirmation.actionLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function PasswordResetDialog({ user, token, onUnauthorized, onClose, onSuccess }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    const closeOnEscape = (event) => event.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, saving]);

  const submit = async (event) => {
    event.preventDefault();
    if (inFlight.current) return;
    if (password.length < 8) return setError("Mật khẩu phải có ít nhất 8 ký tự.");
    if (new TextEncoder().encode(password).length > 72) return setError("Mật khẩu không được vượt quá 72 UTF-8 bytes.");
    if (password !== confirmation) return setError("Mật khẩu xác nhận không khớp.");
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      await resetUserPassword(user.id, password, token);
      onSuccess();
    } catch (requestError) {
      if (requestError.status === 401) onUnauthorized();
      else
        setError(
          requestError.status === 403
            ? "Chỉ Quản trị viên mới có thể đặt lại mật khẩu."
            : requestError.status === 404
            ? "Không tìm thấy tài khoản."
            : requestError.status === 422
            ? "Mật khẩu tạm thời không hợp lệ."
            : "Không thể đặt lại mật khẩu. Vui lòng thử lại."
        );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}
    >
      <section
        className="password-reset-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-title"
      >
        <header>
          <div>
            <h2 id="reset-password-title">Đặt lại mật khẩu</h2>
            <strong>{user.full_name}</strong>
            <span>{user.email}</span>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} disabled={saving} aria-label="Đóng hộp thoại">
            ×
          </button>
        </header>
        <form onSubmit={submit} noValidate>
          <PasswordInput
            id="reset-new-password"
            name="new_password"
            label="Mật khẩu tạm thời mới"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            autoComplete="new-password"
            disabled={saving}
          />
          <PasswordInput
            id="reset-confirm-password"
            name="confirm_new_password"
            label="Xác nhận mật khẩu"
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.target.value);
              setError("");
            }}
            autoComplete="new-password"
            disabled={saving}
          />
          <p className="reset-security-note">
            Mật khẩu hiện tại được mã hóa một chiều. Thao tác này sẽ thiết lập một mật khẩu đăng nhập mới.
          </p>
          {error && <div className="form-error" role="alert">{error}</div>}
          <footer>
            <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
              Hủy
            </button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? "Đang đặt lại..." : "Đặt lại mật khẩu"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function UserFormDrawer({
  mode,
  user,
  form,
  errors,
  saving,
  protectSelf,
  showPassword,
  onShowPassword,
  onChange,
  onClose,
  onSubmit,
  onResetPassword,
}) {
  const nameRef = useRef(null);
  useEffect(() => {
    nameRef.current?.focus();
    const closeOnEscape = (event) => event.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, saving]);

  return (
    <div
      className="drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}
    >
      <aside className="user-drawer" role="dialog" aria-modal="true" aria-labelledby="user-drawer-title">
        <header className="user-drawer-header">
          <div>
            <h2 id="user-drawer-title">{mode === "create" ? "Tạo tài khoản mới" : "Chỉnh sửa tài khoản"}</h2>
            {mode === "create" ? (
              <p>Khởi tạo người dùng và gán phân quyền phù hợp trong hệ thống.</p>
            ) : (
              <div className="drawer-identity">
                <strong>{user.full_name}</strong>
                <span>{user.email}</span>
              </div>
            )}
          </div>
          <button type="button" className="drawer-close" onClick={onClose} disabled={saving} aria-label="Đóng biểu mẫu">
            ×
          </button>
        </header>

        <form className="user-drawer-form" onSubmit={onSubmit} noValidate>
          <div className="user-form-body">
            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label htmlFor="admin-user-name">Họ và tên *</label>
              <input
                ref={nameRef}
                id="admin-user-name"
                className="form-input-text"
                value={form.full_name}
                onChange={(event) => onChange("full_name", event.target.value)}
                disabled={saving}
                placeholder="Nhập họ và tên..."
              />
              {errors.full_name && <small className="field-error">{errors.full_name}</small>}
            </div>

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label htmlFor="admin-user-email">Địa chỉ Email *</label>
              <input
                id="admin-user-email"
                type="email"
                className="form-input-text"
                value={form.email}
                onChange={(event) => onChange("email", event.target.value)}
                disabled={saving}
                placeholder="user@example.com"
              />
              {errors.email && <small className="field-error">{errors.email}</small>}
            </div>

            {mode === "create" && (
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label htmlFor="admin-user-password">Mật khẩu khởi tạo *</label>
                <div className="password-input-wrap">
                  <input
                    id="admin-user-password"
                    className="form-input-text"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(event) => onChange("password", event.target.value)}
                    disabled={saving}
                    placeholder="Tối thiểu 8 ký tự..."
                  />
                  <button type="button" onClick={onShowPassword} disabled={saving}>
                    {showPassword ? "Ẩn" : "Hiện"}
                  </button>
                </div>
                {errors.password && <small className="field-error">{errors.password}</small>}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label htmlFor="admin-user-role">Vai trò hệ thống</label>
              <select
                id="admin-user-role"
                className="form-select"
                value={form.role}
                onChange={(event) => onChange("role", event.target.value)}
                disabled={saving || protectSelf}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              <small style={{ color: "#94a3b8", fontSize: "0.74rem" }}>
                {protectSelf
                  ? "Bạn không thể tự tước quyền Quản trị viên của chính mình."
                  : "Vai trò xác định các phân hệ và quyền hạn người dùng được phép thực thi."}
              </small>
            </div>

            <label className="account-active-control" style={{ marginBottom: "1rem" }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => onChange("is_active", event.target.checked)}
                disabled={saving || protectSelf}
              />
              <span>
                <strong>Tài khoản hoạt động</strong>
                <small>
                  {protectSelf
                    ? "Bạn không thể tự vô hiệu hóa tài khoản của chính mình."
                    : "Cho phép người dùng đăng nhập và thao tác trên hệ thống."}
                </small>
              </span>
            </label>

            {mode === "edit" && (
              <section className="password-reset-entry">
                <div>
                  <strong>Mật khẩu bảo mật</strong>
                  <small>Gán mật khẩu tạm thời mới; mật khẩu hiện tại được mã hóa một chiều.</small>
                </div>
                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={() => onResetPassword(user)}
                  disabled={saving}
                >
                  Đặt lại mật khẩu
                </button>
              </section>
            )}

            {errors.form && <div className="inline-message error-message" role="alert">{errors.form}</div>}
          </div>

          <footer className="user-drawer-footer">
            <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
              Hủy
            </button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? "Đang lưu..." : mode === "create" ? "Tạo tài khoản" : "Lưu thay đổi"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}

function UsersPage({ token, currentUser, onLogout, onUnauthorized, activeView, onViewChange }) {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [success, setSuccess] = useState("");
  const [actionError, setActionError] = useState("");
  const [drawer, setDrawer] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [passwordResetUser, setPasswordResetUser] = useState(null);
  const busy = useRef(false);

  const loadUsers = useCallback(
    async (signal) => {
      setLoading(true);
      setLoadError(false);
      try {
        setUsers(await getUsers(token, signal));
      } catch (error) {
        if (error.name !== "AbortError") {
          if (error.status === 401) onUnauthorized();
          else setLoadError(true);
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [token, onUnauthorized]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadUsers(controller.signal);
    return () => controller.abort();
  }, [loadUsers]);

  const visibleUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return users.filter(
      (user) =>
        (!term ||
          `${user.full_name} ${user.email} ${user.role} ${ROLE_LABELS[user.role] || ""}`
            .toLowerCase()
            .includes(term)) &&
        (roleFilter === "ALL" || user.role === roleFilter) &&
        (statusFilter === "ALL" || (statusFilter === "ACTIVE") === user.is_active)
    );
  }, [users, query, roleFilter, statusFilter]);

  const closeDrawer = useCallback(() => {
    setDrawer(null);
    setFormErrors({});
    setShowPassword(false);
  }, []);

  const openCreate = () => {
    setDrawer({ mode: "create", user: null });
    setForm(EMPTY_FORM);
    setFormErrors({});
    setSuccess("");
    setActionError("");
  };

  const openEdit = (user) => {
    setDrawer({ mode: "edit", user });
    setForm({
      full_name: user.full_name,
      email: user.email,
      password: "",
      role: user.role,
      is_active: user.is_active,
    });
    setFormErrors({});
    setSuccess("");
    setActionError("");
  };

  const changeForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: "", form: "" }));
  };

  const clearFilters = () => {
    setQuery("");
    setRoleFilter("ALL");
    setStatusFilter("ALL");
  };

  const validate = () => {
    const errors = {};
    if (form.full_name.trim().length < 2) errors.full_name = "Vui lòng nhập ít nhất 2 ký tự.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = "Vui lòng nhập địa chỉ email hợp lệ.";
    if (drawer.mode === "create" && form.password.length < 8) errors.password = "Mật khẩu phải có ít nhất 8 ký tự.";
    if (drawer.mode === "create" && new TextEncoder().encode(form.password).length > 72)
      errors.password = "Mật khẩu không được vượt quá 72 UTF-8 bytes.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const persistForm = async () => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setFormErrors({});
    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
      is_active: form.is_active,
    };
    try {
      const saved =
        drawer.mode === "create"
          ? await createUser({ ...payload, password: form.password }, token)
          : await updateUser(drawer.user.id, payload, token);
      setUsers((current) =>
        drawer.mode === "create" ? [saved, ...current] : current.map((user) => (user.id === saved.id ? saved : user))
      );
      setSuccess(drawer.mode === "create" ? "Đã tạo tài khoản thành công." : "Đã cập nhật tài khoản.");
      setActionError("");
      closeDrawer();
    } catch (error) {
      if (error.status === 401) onUnauthorized();
      else setFormErrors({ form: userErrorMessage(error) });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const submitForm = (event) => {
    event.preventDefault();
    if (!validate()) return;
    const user = drawer.user;
    if (drawer.mode === "edit" && user.is_active && !form.is_active) {
      setConfirmation({
        title: "Vô hiệu hóa tài khoản?",
        message: `${user.full_name} sẽ không thể đăng nhập hoặc thao tác trên hệ thống.`,
        actionLabel: "Vô hiệu hóa",
        destructive: true,
        action: persistForm,
      });
      return;
    }
    if (drawer.mode === "edit" && user.role === "ADMIN" && form.role !== "ADMIN") {
      setConfirmation({
        title: "Thay đổi vai trò quản trị?",
        message: `${user.full_name} sẽ mất quyền Quản trị viên và trở thành ${ROLE_LABELS[form.role]}.`,
        actionLabel: "Đổi vai trò",
        destructive: true,
        action: persistForm,
      });
      return;
    }
    persistForm();
  };

  const requestStatusChange = (user) =>
    setConfirmation({
      title: user.is_active ? "Vô hiệu hóa tài khoản?" : "Kích hoạt lại tài khoản?",
      message: user.is_active
        ? `${user.full_name} sẽ không thể đăng nhập hoặc thao tác trên hệ thống.`
        : `${user.full_name} sẽ có thể đăng nhập lại vào hệ thống.`,
      actionLabel: user.is_active ? "Vô hiệu hóa" : "Kích hoạt lại",
      destructive: user.is_active,
      action: async () => {
        if (busy.current) return;
        busy.current = true;
        setSaving(true);
        try {
          const saved = await updateUser(user.id, { is_active: !user.is_active }, token);
          setUsers((current) => current.map((item) => (item.id === saved.id ? saved : item)));
          setSuccess(saved.is_active ? "Đã kích hoạt lại tài khoản." : "Đã vô hiệu hóa tài khoản.");
          setActionError("");
          setConfirmation(null);
        } catch (error) {
          if (error.status === 401) onUnauthorized();
          else {
            setSuccess("");
            setActionError(userErrorMessage(error));
            setConfirmation(null);
          }
        } finally {
          busy.current = false;
          setSaving(false);
        }
      },
    });

  const confirmAction = async () => {
    const action = confirmation?.action;
    setConfirmation(null);
    await action?.();
  };

  const filtersActive = Boolean(query || roleFilter !== "ALL" || statusFilter !== "ALL");

  return (
    <div className="dashboard-shell">
      <WorkspaceHeader
        currentUser={currentUser}
        activeView={activeView}
        onNavigate={onViewChange}
        onLogout={onLogout}
        workspaceLabel="Quản trị người dùng & Phân quyền"
      />

      <main className="dashboard-main users-page">
        {/* Header */}
        <section className="events-page-header">
          <div>
            <p className="hero-eyebrow">KIỂM SOÁT TRUY CẬP · RBAC</p>
            <h1>Quản lý người dùng</h1>
            <p>Quản lý tài khoản, vai trò và phân quyền truy cập hệ thống toàn diện.</p>
          </div>
          <button
            type="button"
            className="primary-button create-user-button"
            onClick={openCreate}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Tạo tài khoản
          </button>
        </section>

        {success && <div className="inline-message success-message users-feedback" role="status">{success}</div>}
        {actionError && <div className="inline-message error-message users-feedback" role="alert">{actionError}</div>}

        <section className="users-console">
          {/* Toolbar */}
          <div className="users-toolbar-bar">
            <div className="users-search-input-wrap">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                id="users-search"
                type="search"
                className="filter-search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm theo họ tên, email hoặc vai trò..."
              />
            </div>

            <select
              className="users-filter-select"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              aria-label="Lọc người dùng theo vai trò"
            >
              <option value="ALL">Tất cả vai trò</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>

            <select
              className="users-filter-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Lọc người dùng theo trạng thái"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Đã vô hiệu</option>
            </select>

            <span style={{ fontSize: "0.8rem", color: "#94a3b8", marginLeft: "auto" }}>
              {loading ? (
                "Đang tải..."
              ) : filtersActive ? (
                <span>
                  Hiển thị <strong style={{ color: "#ffffff" }}>{visibleUsers.length}</strong> / {users.length} người dùng
                </span>
              ) : (
                <span>
                  Tổng số: <strong style={{ color: "#ffffff" }}>{users.length}</strong> tài khoản
                </span>
              )}
            </span>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="compact-state">
              <div className="app-loader" />
              <p>Đang tải dữ liệu người dùng...</p>
            </div>
          )}

          {/* Load Error */}
          {loadError && (
            <div className="state-panel error-panel">
              <strong>Không thể tải danh sách người dùng.</strong>
              <p>Vui lòng kiểm tra kết nối mạng và thử lại.</p>
              <button type="button" className="secondary-button" onClick={() => loadUsers()}>
                Thử lại
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !loadError && visibleUsers.length === 0 && (
            <div className="compact-state">
              <strong>{filtersActive ? "Không tìm thấy người dùng phù hợp." : "Chưa có người dùng nào."}</strong>
              {filtersActive && (
                <button type="button" className="filter-reset-btn" onClick={clearFilters} style={{ marginTop: "0.5rem" }}>
                  Đặt lại bộ lọc
                </button>
              )}
            </div>
          )}

          {/* Users Table */}
          {!loading && !loadError && visibleUsers.length > 0 && (
            <div className="reg-table-container">
              <table className="reg-table">
                <thead>
                  <tr>
                    <th>Người dùng</th>
                    <th>Email</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((user) => {
                    const isSelf = user.id === currentUser.id;
                    const username = user.email.split("@")[0];

                    return (
                      <tr key={user.id}>
                        <td>
                          <div className="user-identity-cell">
                            <div className="user-tech-avatar">
                              {initials(user.full_name)}
                            </div>
                            <div className="user-names-group">
                              <div className="user-full-name-line">
                                <strong>{user.full_name}</strong>
                                {isSelf && <span className="user-you-pill">Bạn</span>}
                              </div>
                              <span className="user-username-tag">@{username} · #{user.id}</span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span style={{ color: "#cbd5e1", fontSize: "0.85rem" }}>{user.email}</span>
                        </td>

                        <td>
                          <RoleBadge role={user.role} />
                        </td>

                        <td>
                          <StatusBadge active={user.is_active} />
                        </td>

                        <td>
                          <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                            {friendlyDate(user.created_at)}
                          </span>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                            <button
                              type="button"
                              className="speaker-btn-edit"
                              onClick={() => openEdit(user)}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className={`status-action-button ${user.is_active ? "deactivate" : "reactivate"}`}
                              onClick={() => requestStatusChange(user)}
                              disabled={isSelf && user.is_active}
                              style={{
                                background: user.is_active ? "rgba(239, 68, 68, 0.12)" : "rgba(34, 197, 94, 0.12)",
                                border: `1px solid ${user.is_active ? "rgba(239, 68, 68, 0.35)" : "rgba(34, 197, 94, 0.35)"}`,
                                color: user.is_active ? "#f87171" : "#4ade80",
                                fontSize: "0.78rem",
                                fontWeight: 600,
                                padding: "0.45rem 0.75rem",
                                borderRadius: 8,
                                cursor: isSelf && user.is_active ? "not-allowed" : "pointer",
                                opacity: isSelf && user.is_active ? 0.4 : 1,
                              }}
                            >
                              {user.is_active ? "Vô hiệu" : "Kích hoạt"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* User Form Drawer */}
      {drawer && (
        <UserFormDrawer
          key={`${drawer.mode}-${drawer.user?.id || "new"}`}
          mode={drawer.mode}
          user={drawer.user}
          form={form}
          errors={formErrors}
          saving={saving}
          protectSelf={drawer.mode === "edit" && drawer.user.id === currentUser.id}
          showPassword={showPassword}
          onShowPassword={() => setShowPassword((value) => !value)}
          onChange={changeForm}
          onClose={closeDrawer}
          onSubmit={submitForm}
          onResetPassword={(user) => {
            closeDrawer();
            setPasswordResetUser(user);
            setSuccess("");
            setActionError("");
          }}
        />
      )}

      {/* Password Reset Modal */}
      {passwordResetUser && (
        <PasswordResetDialog
          key={passwordResetUser.id}
          user={passwordResetUser}
          token={token}
          onUnauthorized={onUnauthorized}
          onClose={() => setPasswordResetUser(null)}
          onSuccess={() => {
            setPasswordResetUser(null);
            setSuccess("Đã đặt lại mật khẩu thành công.");
          }}
        />
      )}

      <ConfirmDialog
        confirmation={confirmation}
        busy={saving}
        onCancel={() => setConfirmation(null)}
        onConfirm={confirmAction}
      />
    </div>
  );
}

export default UsersPage;
