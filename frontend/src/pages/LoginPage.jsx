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
        <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
        <p className="eyebrow light">EVENT MANAGER AI</p>
        <h1>Biến dữ liệu sự kiện thành quyết định chính xác.</h1>
        <p>Theo dõi đăng ký, điểm danh, sức chứa và đánh giá của người tham dự từ một không gian làm việc tập trung.</p>
        <div className="intro-metric"><strong>Phân tích trực tiếp</strong><span>Dành riêng cho ban tổ chức</span></div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <p className="eyebrow">CHÀO MỪNG TRỞ LẠI</p>
          <h2>Đăng nhập để tiếp tục</h2>
          <p className="form-subtitle">Quản lý &amp; Phân tích Sự kiện</p>

          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@congty.com" disabled={loading} />

          <PasswordInput id="password" name="password" label="Mật khẩu" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nhập mật khẩu của bạn" disabled={loading}/>

          {(validationError || error) && <div className="form-error" role="alert">{validationError || error}</div>}
          <button type="submit" className="primary-button login-button" disabled={loading}>{loading ? "Đang đăng nhập..." : "Đăng nhập"}</button>
          <p className="auth-switch">Chưa có tài khoản? <button type="button" className="text-button" onClick={onRegister} disabled={loading}>Đăng ký ngay</button></p>
          <p className="secure-note">Truy cập an toàn cho mọi vai trò sự kiện</p>
        </form>
      </section>
    </main>
  );
}

export default LoginPage;
