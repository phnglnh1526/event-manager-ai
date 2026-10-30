import React, { useState } from "react";

import PasswordInput from "../components/PasswordInput";

function LoginPage({ onLogin, onRegister, loading, error }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setValidationError("Vui lòng nhập email và mật khẩu.");
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(cleanEmail)) {
      setValidationError("Vui lòng nhập địa chỉ email hợp lệ (ví dụ: admin@example.com).");
      return;
    }
    setValidationError("");
    const succeeded = await onLogin(cleanEmail, password);
    if (succeeded) setPassword("");
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

        <p className="eyebrow light">NỀN TẢNG QUẢN TRỊ SỰ KIỆN</p>
        <h1>Biến dữ liệu sự kiện thành quyết định chính xác.</h1>
        <p>
          Theo dõi đăng ký, điểm danh QR, sức chứa và phân tích phản hồi người tham dự
          tập trung trên một không gian làm việc tối giản và thông minh.
        </p>

        <div className="intro-metric">
          <div className="intro-metric-icon" aria-hidden="true">
            ✦
          </div>
          <div className="intro-metric-text">
            <strong>Phân tích trực tiếp &amp; Trợ lý AI</strong>
            <span>Tối ưu quy trình tổ chức cho ban điều hành</span>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <p className="eyebrow">CHÀO MỪNG TRỞ LẠI</p>
          <h2>Đăng nhập</h2>
          <p className="form-subtitle">Nhập thông tin xác thực để vào hệ thống</p>

          <label htmlFor="email">Địa chỉ Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            disabled={loading}
          />

          <PasswordInput
            id="password"
            name="password"
            label="Mật khẩu"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu của bạn"
            disabled={loading}
          />

          {(validationError || error) && (
            <div className="form-error" role="alert">
              {validationError || error}
            </div>
          )}

          <button
            type="submit"
            className="primary-button login-button"
            disabled={loading}
          >
            {loading ? "Đang xử lý..." : "Đăng nhập"}
          </button>

          <p className="auth-switch">
            Chưa có tài khoản?{" "}
            <button
              type="button"
              className="text-button"
              onClick={onRegister}
              disabled={loading}
            >
              Đăng ký ngay
            </button>
          </p>

          <p className="secure-note">
            Truy cập an toàn với mã hóa chuẩn cho mọi vai trò sự kiện
          </p>
        </form>
      </section>
    </main>
  );
}

export default LoginPage;
