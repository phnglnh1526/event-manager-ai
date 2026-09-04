import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import PasswordInput from "../components/PasswordInput";
import WorkspaceHeader from "../components/WorkspaceHeader";
import { createUser, getUsers, resetUserPassword, updateUser } from "../services/api";

const ROLES = ["ATTENDEE", "STAFF", "ORGANIZER", "ADMIN"];
const ROLE_LABELS = { ADMIN: "Quản trị viên", ORGANIZER: "Ban tổ chức", STAFF: "Nhân viên", ATTENDEE: "Người tham dự" };
const EMPTY_FORM = { full_name: "", email: "", password: "", role: "ATTENDEE", is_active: true };

function userErrorMessage(error) {
  if (error.status === 400) return error.message || "Yêu cầu cập nhật không hợp lệ.";
  if (error.status === 403) return "Bạn không có quyền quản lý người dùng.";
  if (error.status === 404) return "Không tìm thấy tài khoản cần cập nhật.";
  if (error.status === 409) {
    if (error.message === "Email already registered") return "Email này đã thuộc về một tài khoản khác.";
    if (error.message.includes("own account")) return "Bạn không thể tự vô hiệu hóa tài khoản của mình.";
    if (error.message.includes("own ADMIN role")) return "Bạn không thể tự thay đổi vai trò Quản trị viên.";
    if (error.message.includes("last active ADMIN")) return "Không thể vô hiệu hóa hoặc hạ quyền Quản trị viên đang hoạt động cuối cùng.";
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
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function RoleBadge({ role }) {
  return <span className={`user-role-badge role-${role.toLowerCase()}`} title={role}>{ROLE_LABELS[role] || role}</span>;
}

function StatusBadge({ active }) {
  return <span className={`user-status-badge ${active ? "active" : "inactive"}`}><span aria-hidden="true" />{active ? "Hoạt động" : "Vô hiệu"}</span>;
}

function UserAvatar({ name }) {
  return <span className="user-avatar" aria-hidden="true">{initials(name)}</span>;
}

function ConfirmDialog({ confirmation, busy, onCancel, onConfirm }) {
  useEffect(() => {
    const closeOnEscape = (event) => event.key === "Escape" && confirmation && !busy && onCancel();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [confirmation, busy, onCancel]);
  if (!confirmation) return null;
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}>
    <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description">
      <div className={`confirm-icon ${confirmation.destructive ? "destructive" : "positive"}`} aria-hidden="true">{confirmation.destructive ? "!" : "✓"}</div>
      <h2 id="confirm-title">{confirmation.title}</h2>
      <p id="confirm-description">{confirmation.message}</p>
      <div className="confirm-actions">
        <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>Hủy</button>
        <button type="button" className={confirmation.destructive ? "danger-button" : "primary-button"} onClick={onConfirm} disabled={busy}>{busy ? "Updating..." : confirmation.actionLabel}</button>
      </div>
    </section>
  </div>;
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
    inFlight.current = true; setSaving(true); setError("");
    try { await resetUserPassword(user.id, password, token); onSuccess(); }
    catch (requestError) {
      if (requestError.status === 401) onUnauthorized();
      else setError(requestError.status === 403 ? "Chỉ Quản trị viên mới có thể đặt lại mật khẩu." : requestError.status === 404 ? "Không tìm thấy tài khoản." : requestError.status === 422 ? "Mật khẩu tạm thời không hợp lệ." : "Không thể đặt lại mật khẩu. Vui lòng thử lại.");
    } finally { inFlight.current = false; setSaving(false); }
  };

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
    <section className="password-reset-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-password-title">
      <header><div><h2 id="reset-password-title">Đặt lại mật khẩu</h2><strong>{user.full_name}</strong><span>{user.email}</span></div><button type="button" className="drawer-close" onClick={onClose} disabled={saving} aria-label="Đóng hộp thoại">×</button></header>
      <form onSubmit={submit} noValidate>
        <PasswordInput id="reset-new-password" name="new_password" label="Mật khẩu tạm thời mới" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} autoComplete="new-password" disabled={saving}/>
        <PasswordInput id="reset-confirm-password" name="confirm_new_password" label="Xác nhận mật khẩu" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError(""); }} autoComplete="new-password" disabled={saving}/>
        <p className="reset-security-note">Mật khẩu hiện tại không thể xem hoặc khôi phục. Thao tác này chỉ đặt một mật khẩu mới.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <footer><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Hủy</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Đang đặt lại..." : "Đặt lại mật khẩu"}</button></footer>
      </form>
    </section>
  </div>;
}

function UserFormDrawer({ mode, user, form, errors, saving, protectSelf, showPassword, onShowPassword, onChange, onClose, onSubmit, onResetPassword }) {
  const nameRef = useRef(null);
  useEffect(() => {
    nameRef.current?.focus();
    const closeOnEscape = (event) => event.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, saving]);

  return <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
    <aside className="user-drawer" role="dialog" aria-modal="true" aria-labelledby="user-drawer-title">
      <header className="user-drawer-header">
        <div><h2 id="user-drawer-title">{mode === "create" ? "Tạo tài khoản" : "Chỉnh sửa tài khoản"}</h2>{mode === "create" ? <p>Tạo tài khoản và chỉ định cấp độ truy cập phù hợp.</p> : <div className="drawer-identity"><strong>{user.full_name}</strong><span>{user.email}</span></div>}</div>
        <button type="button" className="drawer-close" onClick={onClose} disabled={saving} aria-label="Close user form">×</button>
      </header>
      <form className="user-drawer-form" onSubmit={onSubmit} noValidate>
        <div className="user-form-body">
          <div className="editor-field"><label htmlFor="admin-user-name">Họ và tên</label><input ref={nameRef} id="admin-user-name" value={form.full_name} onChange={(event) => onChange("full_name", event.target.value)} disabled={saving} aria-invalid={Boolean(errors.full_name)} aria-describedby={errors.full_name ? "name-error" : undefined}/>{errors.full_name && <small className="field-error" id="name-error">{errors.full_name}</small>}</div>
          <div className="editor-field"><label htmlFor="admin-user-email">Email</label><input id="admin-user-email" type="email" value={form.email} onChange={(event) => onChange("email", event.target.value)} disabled={saving} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined}/>{errors.email && <small className="field-error" id="email-error">{errors.email}</small>}</div>
          {mode === "create" && <div className="editor-field"><label htmlFor="admin-user-password">Mật khẩu tạm thời</label><div className="password-input-wrap"><input id="admin-user-password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={form.password} onChange={(event) => onChange("password", event.target.value)} disabled={saving} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "password-error" : undefined}/><button type="button" onClick={onShowPassword} disabled={saving} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>{showPassword ? "Ẩn" : "Hiện"}</button></div>{errors.password && <small className="field-error" id="password-error">{errors.password}</small>}</div>}
          <div className="editor-field"><label htmlFor="admin-user-role">Vai trò</label><select id="admin-user-role" value={form.role} onChange={(event) => onChange("role", event.target.value)} disabled={saving || protectSelf}>{ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select><small className="field-help">{protectSelf ? "Bạn không thể tự loại bỏ quyền Quản trị viên." : "Vai trò xác định các khu vực tài khoản có thể truy cập."}</small></div>
          <label className="account-active-control"><input type="checkbox" checked={form.is_active} onChange={(event) => onChange("is_active", event.target.checked)} disabled={saving || protectSelf}/><span><strong>Tài khoản hoạt động</strong><small>{protectSelf ? "Bạn không thể tự vô hiệu hóa tài khoản." : "Cho phép người dùng đăng nhập và truy cập các khu vực được cấp quyền."}</small></span></label>
          {mode === "edit" && <section className="password-reset-entry"><div><strong>Mật khẩu</strong><small>Gán mật khẩu tạm thời mới; mật khẩu hiện tại không bao giờ được hiển thị.</small></div><button type="button" className="secondary-button compact-button" onClick={() => onResetPassword(user)} disabled={saving}>Đặt lại mật khẩu</button></section>}
          {errors.form && <div className="inline-message error-message" role="alert">{errors.form}</div>}
        </div>
        <footer className="user-drawer-footer"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Hủy</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Đang lưu..." : mode === "create" ? "Tạo tài khoản" : "Lưu thay đổi"}</button></footer>
      </form>
    </aside>
  </div>;
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

  const loadUsers = useCallback(async (signal) => {
    setLoading(true); setLoadError(false);
    try { setUsers(await getUsers(token, signal)); }
    catch (error) { if (error.name !== "AbortError") { if (error.status === 401) onUnauthorized(); else setLoadError(true); } }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [token, onUnauthorized]);

  useEffect(() => { const controller = new AbortController(); loadUsers(controller.signal); return () => controller.abort(); }, [loadUsers]);

  const visibleUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return users.filter((user) => (!term || `${user.full_name} ${user.email} ${user.role} ${ROLE_LABELS[user.role] || ""}`.toLowerCase().includes(term)) && (roleFilter === "ALL" || user.role === roleFilter) && (statusFilter === "ALL" || (statusFilter === "ACTIVE") === user.is_active));
  }, [users, query, roleFilter, statusFilter]);

  const closeDrawer = useCallback(() => { setDrawer(null); setFormErrors({}); setShowPassword(false); }, []);
  const openCreate = () => { setDrawer({ mode: "create", user: null }); setForm(EMPTY_FORM); setFormErrors({}); setSuccess(""); setActionError(""); };
  const openEdit = (user) => { setDrawer({ mode: "edit", user }); setForm({ full_name: user.full_name, email: user.email, password: "", role: user.role, is_active: user.is_active }); setFormErrors({}); setSuccess(""); setActionError(""); };
  const changeForm = (field, value) => { setForm((current) => ({ ...current, [field]: value })); setFormErrors((current) => ({ ...current, [field]: "", form: "" })); };
  const clearFilters = () => { setQuery(""); setRoleFilter("ALL"); setStatusFilter("ALL"); };

  const validate = () => {
    const errors = {};
    if (form.full_name.trim().length < 2) errors.full_name = "Enter at least 2 characters.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = "Enter a valid email address.";
    if (drawer.mode === "create" && form.password.length < 8) errors.password = "Use at least 8 characters.";
    if (drawer.mode === "create" && new TextEncoder().encode(form.password).length > 72) errors.password = "Password must be at most 72 UTF-8 bytes.";
    setFormErrors(errors); return Object.keys(errors).length === 0;
  };

  const persistForm = async () => {
    if (busy.current) return;
    busy.current = true; setSaving(true); setFormErrors({});
    const payload = { full_name: form.full_name.trim(), email: form.email.trim().toLowerCase(), role: form.role, is_active: form.is_active };
    try {
      const saved = drawer.mode === "create" ? await createUser({ ...payload, password: form.password }, token) : await updateUser(drawer.user.id, payload, token);
      setUsers((current) => drawer.mode === "create" ? [saved, ...current] : current.map((user) => user.id === saved.id ? saved : user));
      setSuccess(drawer.mode === "create" ? "Đã tạo tài khoản." : "Đã cập nhật tài khoản."); setActionError(""); closeDrawer();
    } catch (error) {
      if (error.status === 401) onUnauthorized();
      else setFormErrors({ form: userErrorMessage(error) });
    } finally { busy.current = false; setSaving(false); }
  };

  const submitForm = (event) => {
    event.preventDefault(); if (!validate()) return;
    const user = drawer.user;
    if (drawer.mode === "edit" && user.is_active && !form.is_active) {
      setConfirmation({ title: "Vô hiệu hóa tài khoản?", message: `${user.full_name} sẽ không thể đăng nhập hoặc sử dụng hệ thống.`, actionLabel: "Vô hiệu hóa", destructive: true, action: persistForm }); return;
    }
    if (drawer.mode === "edit" && user.role === "ADMIN" && form.role !== "ADMIN") {
      setConfirmation({ title: "Thay đổi vai trò quản trị?", message: `${user.full_name} sẽ mất quyền Quản trị viên và trở thành ${ROLE_LABELS[form.role]}.`, actionLabel: "Đổi vai trò", destructive: true, action: persistForm }); return;
    }
    persistForm();
  };

  const requestStatusChange = (user) => setConfirmation({
    title: user.is_active ? "Vô hiệu hóa tài khoản?" : "Kích hoạt lại tài khoản?",
    message: user.is_active ? `${user.full_name} sẽ không thể đăng nhập hoặc sử dụng hệ thống.` : `${user.full_name} sẽ có thể đăng nhập lại vào hệ thống.`,
    actionLabel: user.is_active ? "Vô hiệu hóa" : "Kích hoạt lại", destructive: user.is_active,
    action: async () => {
      if (busy.current) return; busy.current = true; setSaving(true);
      try { const saved = await updateUser(user.id, { is_active: !user.is_active }, token); setUsers((current) => current.map((item) => item.id === saved.id ? saved : item)); setSuccess(saved.is_active ? "Đã kích hoạt lại tài khoản." : "Đã vô hiệu hóa tài khoản."); setActionError(""); setConfirmation(null); }
      catch (error) { if (error.status === 401) onUnauthorized(); else { setSuccess(""); setActionError(userErrorMessage(error)); setConfirmation(null); } }
      finally { busy.current = false; setSaving(false); }
    },
  });

  const confirmAction = async () => { const action = confirmation?.action; setConfirmation(null); await action?.(); };
  const filtersActive = Boolean(query || roleFilter !== "ALL" || statusFilter !== "ALL");

  return <div className="dashboard-shell">
    <WorkspaceHeader currentUser={currentUser} activeView={activeView} onNavigate={onViewChange} onLogout={onLogout} workspaceLabel="Account administration" />
    <main className="dashboard-main users-page">
      <section className="users-page-header"><div><p className="eyebrow">KIỂM SOÁT TRUY CẬP</p><h1>Quản lý người dùng</h1><p>Quản lý tài khoản, vai trò và quyền truy cập hệ thống.</p></div><button type="button" className="primary-button create-user-button" onClick={openCreate}>+ Tạo tài khoản</button></section>
      {success && <div className="inline-message success-message users-feedback" role="status">{success}</div>}
      {actionError && <div className="inline-message error-message users-feedback" role="alert">{actionError}</div>}
      <section className="users-console">
        <div className="users-toolbar"><label className="users-search-box" htmlFor="users-search"><span aria-hidden="true">⌕</span><input id="users-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên, email hoặc vai trò..." aria-label="Tìm người dùng theo tên, email hoặc vai trò"/></label><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Lọc người dùng theo vai trò"><option value="ALL">Tất cả vai trò</option>{ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Lọc người dùng theo trạng thái"><option value="ALL">Tất cả trạng thái</option><option value="ACTIVE">Hoạt động</option><option value="INACTIVE">Vô hiệu</option></select><span className="users-count">{loading ? "Đang tải..." : filtersActive ? `Hiển thị ${visibleUsers.length} / ${users.length} người dùng` : `${users.length} người dùng`}</span></div>
        {loading ? <div className="users-loading" aria-label="Đang tải người dùng">{[1, 2, 3, 4].map((item) => <div className="user-skeleton" key={item}><span/><div><span/><span/></div><span/><span/></div>)}</div> : loadError ? <div className="users-empty"><strong>Không thể tải danh sách người dùng.</strong><p>Vui lòng kiểm tra kết nối và thử lại.</p><button type="button" className="secondary-button" onClick={() => loadUsers()}>Thử lại</button></div> : visibleUsers.length === 0 ? <div className="users-empty"><strong>{filtersActive ? "Không tìm thấy người dùng phù hợp." : "Chưa có người dùng."}</strong>{filtersActive && <button type="button" className="text-button" onClick={clearFilters}>Đặt lại bộ lọc</button>}</div> : <div className="users-table-wrap"><table className="users-table"><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Ngày tạo</th><th><span className="sr-only">Thao tác</span></th></tr></thead><tbody>{visibleUsers.map((user) => <tr key={user.id}><td><div className="user-identity"><UserAvatar name={user.full_name}/><div><div className="user-name-line"><strong>{user.full_name}</strong>{user.id === currentUser.id && <span className="you-badge">Bạn</span>}</div><span>{user.email}</span></div></div></td><td data-label="Vai trò"><RoleBadge role={user.role}/></td><td data-label="Trạng thái"><StatusBadge active={user.is_active}/></td><td data-label="Ngày tạo"><span className="created-date">{friendlyDate(user.created_at)}</span></td><td className="user-row-actions"><button type="button" className="secondary-button compact-button" onClick={() => openEdit(user)}>Chỉnh sửa</button><button type="button" className={`status-action-button ${user.is_active ? "deactivate" : "reactivate"}`} onClick={() => requestStatusChange(user)} disabled={user.id === currentUser.id && user.is_active}>{user.is_active ? "Vô hiệu hóa" : "Kích hoạt lại"}</button></td></tr>)}</tbody></table></div>}
      </section>
    </main>
    {drawer && <UserFormDrawer key={`${drawer.mode}-${drawer.user?.id || "new"}`} mode={drawer.mode} user={drawer.user} form={form} errors={formErrors} saving={saving} protectSelf={drawer.mode === "edit" && drawer.user.id === currentUser.id} showPassword={showPassword} onShowPassword={() => setShowPassword((value) => !value)} onChange={changeForm} onClose={closeDrawer} onSubmit={submitForm} onResetPassword={(user) => { closeDrawer(); setPasswordResetUser(user); setSuccess(""); setActionError(""); }}/>}
    {passwordResetUser && <PasswordResetDialog key={passwordResetUser.id} user={passwordResetUser} token={token} onUnauthorized={onUnauthorized} onClose={() => setPasswordResetUser(null)} onSuccess={() => { setPasswordResetUser(null); setSuccess("Đã đặt lại mật khẩu."); }}/>}
    <ConfirmDialog confirmation={confirmation} busy={saving} onCancel={() => setConfirmation(null)} onConfirm={confirmAction}/>
  </div>;
}

export default UsersPage;
