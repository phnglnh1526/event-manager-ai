import React, { useRef, useState } from "react";

import PasswordInput from "../components/PasswordInput";
import WorkspaceHeader from "../components/WorkspaceHeader";
import { changeMyPassword, updateMyProfile } from "../services/api";

const ROLE_LABELS = { ADMIN: "Quản trị viên", ORGANIZER: "Ban tổ chức", STAFF: "Nhân viên", ATTENDEE: "Người tham dự" };
const dateLabel = (value) => value ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)) : "—";

const initials = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)[0]}`.toUpperCase();
};

function ProfilePage({ token, currentUser, onUserUpdated, onBack, onLogout, onUnauthorized }) {
  const [profile, setProfile] = useState({ full_name: currentUser.full_name, email: currentUser.email });
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwords, setPasswords] = useState({ current_password: "", new_password: "", confirmation: "" });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordVersion, setPasswordVersion] = useState(0);
  const profileBusy = useRef(false);
  const passwordBusy = useRef(false);

  const changeProfile = (field, value) => {
    setProfile((current) => ({ ...current, [field]: value }));
    setProfileError("");
    setProfileSuccess("");
  };

  const resetProfile = () => {
    setProfile({ full_name: currentUser.full_name, email: currentUser.email });
    setProfileError("");
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    if (profileBusy.current) return;

    const payload = { full_name: profile.full_name.trim(), email: profile.email.trim().toLowerCase() };
    if (payload.full_name.length < 2) return setProfileError("Họ và tên phải có ít nhất 2 ký tự.");
    if (!/^\S+@\S+\.\S+$/.test(payload.email)) return setProfileError("Vui lòng nhập e-mail hợp lệ.");

    profileBusy.current = true;
    setProfileSaving(true);
    setProfileError("");
    setProfileSuccess("");

    let updated = null;
    try {
      updated = await updateMyProfile(payload, token);
      onUserUpdated(updated);
      setProfile({ full_name: updated.full_name, email: updated.email });
    } catch (error) {
      if (error.status === 401) onUnauthorized();
      else setProfileError(
        error.status === 409
          ? "E-mail này đã được sử dụng bởi tài khoản khác."
          : error.status === 422
            ? "Vui lòng kiểm tra lại họ tên và e-mail."
            : "Không thể cập nhật thông tin cá nhân.",
      );
    } finally {
      profileBusy.current = false;
      setProfileSaving(false);
    }

    if (updated) setProfileSuccess("Đã cập nhật thông tin cá nhân.");
  };

  const changePasswordField = (field, value) => {
    setPasswords((current) => ({ ...current, [field]: value }));
    setPasswordError("");
    setPasswordSuccess("");
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    if (passwordBusy.current) return;
    if (!passwords.current_password) return setPasswordError("Vui lòng nhập mật khẩu hiện tại.");
    if (passwords.new_password.length < 8) return setPasswordError("Mật khẩu mới phải có ít nhất 8 ký tự.");
    if (new TextEncoder().encode(passwords.new_password).length > 72) return setPasswordError("Mật khẩu mới không được vượt quá 72 UTF-8 bytes.");
    if (passwords.new_password !== passwords.confirmation) return setPasswordError("Mật khẩu xác nhận không khớp.");

    passwordBusy.current = true;
    setPasswordSaving(true);
    setPasswordError("");
    setPasswordSuccess("");

    try {
      await changeMyPassword({ current_password: passwords.current_password, new_password: passwords.new_password }, token);
      setPasswords({ current_password: "", new_password: "", confirmation: "" });
      setPasswordVersion((value) => value + 1);
      setPasswordSuccess("Đã đổi mật khẩu.");
    } catch (error) {
      if (error.status === 401) onUnauthorized();
      else setPasswordError(
        error.status === 400
          ? "Mật khẩu hiện tại không chính xác."
          : error.status === 409
            ? "Mật khẩu mới phải khác mật khẩu hiện tại."
            : error.status === 422
              ? "Mật khẩu mới không hợp lệ."
              : "Không thể đổi mật khẩu.",
      );
    } finally {
      passwordBusy.current = false;
      setPasswordSaving(false);
    }
  };

  return (
    <div className="dashboard-shell profile-shell">
      <WorkspaceHeader
        currentUser={currentUser}
        showBackButton
        onBack={onBack}
        onLogout={onLogout}
        backLabel="Quay lại"
        workspaceLabel="Personal account"
      />
      <main className="dashboard-main profile-page">
        <section className="profile-heading">
          <div className="profile-identity">
            <span className="profile-avatar" aria-hidden="true">{initials(currentUser.full_name)}</span>
            <div>
              <p className="eyebrow">TÀI KHOẢN</p>
              <h1>Thông tin cá nhân</h1>
              <p>Quản lý thông tin tài khoản và bảo mật của bạn.</p>
              <div className="profile-role-chip">
                <span>{currentUser.role}</span>
                <small>{ROLE_LABELS[currentUser.role] || currentUser.role}</small>
              </div>
            </div>
          </div>
        </section>

        <section className="profile-card">
          <header>
            <div>
              <p className="eyebrow">THÔNG TIN CƠ BẢN</p>
              <h2>Hồ sơ tài khoản</h2>
            </div>
          </header>
          <form onSubmit={submitProfile} noValidate>
            <div className="profile-form-grid">
              <div className="editor-field">
                <label htmlFor="profile-name">Họ và tên</label>
                <input id="profile-name" autoComplete="name" value={profile.full_name} onChange={(event) => changeProfile("full_name", event.target.value)} disabled={profileSaving} />
              </div>
              <div className="editor-field">
                <label htmlFor="profile-email">E-mail</label>
                <input id="profile-email" type="email" autoComplete="email" value={profile.email} onChange={(event) => changeProfile("email", event.target.value)} disabled={profileSaving} />
              </div>
              <div className="profile-readonly">
                <span>Vai trò</span>
                <strong>{ROLE_LABELS[currentUser.role] || currentUser.role}</strong>
                <small>Chỉ đọc</small>
              </div>
              <div className="profile-readonly">
                <span>Trạng thái</span>
                <strong className="profile-active"><i />Hoạt động</strong>
                <small>Chỉ đọc</small>
              </div>
              <div className="profile-readonly">
                <span>Ngày tạo</span>
                <strong>{dateLabel(currentUser.created_at)}</strong>
                <small>Chỉ đọc</small>
              </div>
            </div>
            {profileError && <div className="inline-message error-message" role="alert">{profileError}</div>}
            {profileSuccess && <div className="inline-message success-message" role="status">{profileSuccess}</div>}
            <footer>
              <button type="button" className="secondary-button" onClick={resetProfile} disabled={profileSaving}>Đặt lại</button>
              <button type="submit" className="primary-button" disabled={profileSaving}>{profileSaving ? "Đang lưu..." : "Lưu thay đổi"}</button>
            </footer>
          </form>
        </section>

        <section className="profile-card">
          <header>
            <div>
              <p className="eyebrow">BẢO MẬT</p>
              <h2>Đổi mật khẩu</h2>
              <p>Mật khẩu hiện tại không thể xem hoặc khôi phục.</p>
            </div>
          </header>
          <form key={passwordVersion} onSubmit={submitPassword} noValidate>
            <div className="profile-password-fields">
              <PasswordInput id="profile-current-password" name="current_password" label="Mật khẩu hiện tại" autoComplete="current-password" value={passwords.current_password} onChange={(event) => changePasswordField("current_password", event.target.value)} disabled={passwordSaving} />
              <PasswordInput id="profile-new-password" name="new_password" label="Mật khẩu mới" autoComplete="new-password" value={passwords.new_password} onChange={(event) => changePasswordField("new_password", event.target.value)} disabled={passwordSaving} />
              <PasswordInput id="profile-confirm-password" name="confirm_new_password" label="Xác nhận mật khẩu mới" autoComplete="new-password" value={passwords.confirmation} onChange={(event) => changePasswordField("confirmation", event.target.value)} disabled={passwordSaving} />
            </div>
            {passwordError && <div className="inline-message error-message" role="alert">{passwordError}</div>}
            {passwordSuccess && <div className="inline-message success-message" role="status">{passwordSuccess}</div>}
            <footer>
              <button type="submit" className="primary-button" disabled={passwordSaving}>{passwordSaving ? "Đang đổi..." : "Đổi mật khẩu"}</button>
            </footer>
          </form>
        </section>
      </main>
    </div>
  );
}

export default ProfilePage;
