import React, { useRef, useState } from "react";

import PasswordInput from "../components/PasswordInput";
import { registerAccount } from "../services/api";

function RegisterPage({ onSignIn }) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  const change = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (inFlight.current) return;
    const fullName = form.full_name.trim();
    const email = form.email.trim().toLowerCase();
    if (fullName.length < 2) return setError("Họ và tên phải có ít nhất 2 ký tự.");
    if (!email) return setError("Vui lòng nhập địa chỉ email hợp lệ.");
    if (form.password.length < 8) return setError("Mật khẩu phải có ít nhất 8 ký tự.");
    if (new TextEncoder().encode(form.password).length > 72)
      return setError("Mật khẩu không được vượt quá 72 byte UTF-8.");
    if (form.password !== form.confirmPassword) return setError("Mật khẩu xác nhận không khớp.");

    inFlight.current = true;
    setLoading(true);
    setError("");
    try {
      await registerAccount({ full_name: fullName, email, password: form.password });
      setSuccess(true);
      setForm({ full_name: "", email: "", password: "", confirmPassword: "" });
    } catch (requestError) {
      setError(
        requestError.status === 409
          ? "Tài khoản với email này đã tồn tại."
          : requestError.status === 422
          ? "Vui lòng kiểm tra lại họ tên, email và mật khẩu."
          : requestError.status === 0
          ? "Không thể kết nối tới máy chủ."
          : "Không thể tạo tài khoản. Vui lòng thử lại sau.",
      );
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-intro" aria-label="Giới thiệu sản phẩm">
        <div className="login-intro-header">
          <div className="brand-mark" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="3" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <path d="M12 13.5v3M10.5 15h3" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="brand-title-wrap">
            <span className="login-system-name">Event Manager</span>
            <span className="login-ai-badge">AI</span>
          </div>
        </div>

        <p className="eyebrow light">CỔNG NGƯỜI THAM DỰ</p>
        <h1>Tham gia sự kiện với một tài khoản an toàn.</h1>
        <p>
          Đăng ký để khám phá các hội thảo, nhận vé điện tử kèm mã QR check-in
          và gửi đánh giá trực tiếp đến ban tổ chức.
        </p>

        <div className="intro-metric">
          <div className="intro-metric-icon" aria-hidden="true">
            🎟️
          </div>
          <div className="intro-metric-text">
            <strong>Vé điện tử &amp; Check-in tức thì</strong>
            <span>Đồng bộ tự động theo thời gian thực</span>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card register-card" onSubmit={submit} noValidate>
          <p className="eyebrow">TẠO TÀI KHOẢN</p>
          <h2>Đăng ký tài khoản</h2>
          <p className="form-subtitle">Điền thông tin để đăng ký tài khoản người tham dự</p>

          {success ? (
            <div className="registration-success" role="status">
              <strong>Tạo tài khoản thành công!</strong>
              <p>Bạn đã có thể đăng nhập vào hệ thống để bắt đầu khám phá sự kiện.</p>
              <button
                type="button"
                className="primary-button login-button"
                onClick={onSignIn}
              >
                Tiếp tục đăng nhập
              </button>
            </div>
          ) : (
            <>
              <label htmlFor="register-name">Họ và tên</label>
              <input
                id="register-name"
                name="full_name"
                autoComplete="name"
                value={form.full_name}
                onChange={(e) => change("full_name", e.target.value)}
                placeholder="Nguyễn Văn A"
                disabled={loading}
              />

              <label htmlFor="register-email">Địa chỉ Email</label>
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => change("email", e.target.value)}
                placeholder="ban@congty.com"
                disabled={loading}
              />

              <PasswordInput
                id="register-password"
                name="password"
                label="Mật khẩu"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => change("password", e.target.value)}
                placeholder="Tối thiểu 8 ký tự"
                disabled={loading}
              />

              <PasswordInput
                id="register-confirm"
                name="confirm_password"
                label="Xác nhận mật khẩu"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => change("confirmPassword", e.target.value)}
                placeholder="Nhập lại mật khẩu"
                disabled={loading}
              />

              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="primary-button login-button"
                disabled={loading}
              >
                {loading ? "Đang xử lý..." : "Tạo tài khoản"}
              </button>

              <p className="auth-switch">
                Đã có tài khoản?{" "}
                <button
                  type="button"
                  className="text-button"
                  onClick={onSignIn}
                  disabled={loading}
                >
                  Đăng nhập
                </button>
              </p>
            </>
          )}
        </form>
      </section>
    </main>
  );
}

export default RegisterPage;
