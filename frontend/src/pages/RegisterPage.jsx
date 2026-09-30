import React, { useRef, useState } from "react";

import PasswordInput from "../components/PasswordInput";
import { registerAccount } from "../services/api";

function RegisterPage({ onSignIn }) {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);
  const change = (field, value) => { setForm((current) => ({ ...current, [field]: value })); setError(""); };
  const submit = async (event) => {
    event.preventDefault();
    if (inFlight.current) return;
    const fullName = form.full_name.trim(), email = form.email.trim().toLowerCase();
    if (fullName.length < 2) return setError("Họ và tên phải có ít nhất 2 ký tự.");
    if (!email) return setError("Vui lòng nhập địa chỉ email hợp lệ.");
    if (form.password.length < 8) return setError("Mật khẩu phải có ít nhất 8 ký tự.");
    if (new TextEncoder().encode(form.password).length > 72) return setError("Mật khẩu không được vượt quá 72 byte UTF-8.");
    if (form.password !== form.confirmPassword) return setError("Mật khẩu xác nhận không khớp.");
    inFlight.current = true; setLoading(true); setError("");
    try {
      await registerAccount({ full_name: fullName, email, password: form.password });
      setSuccess(true); setForm({ full_name: "", email: "", password: "", confirmPassword: "" });
    } catch (requestError) {
      setError(requestError.status === 409 ? "Tài khoản với email này đã tồn tại." : requestError.status === 422 ? "Vui lòng kiểm tra lại họ tên, email và mật khẩu." : requestError.status === 0 ? "Không thể kết nối tới máy chủ." : "Không thể tạo tài khoản. Vui lòng thử lại sau.");
    } finally { inFlight.current = false; setLoading(false); }
  };
  return (
    <main className="login-page">
      <section className="login-intro" aria-label="Giới thiệu sản phẩm">
        <div className="brand-mark" aria-hidden="true"><span/><span/><span/></div>
        <p className="eyebrow light">EVENT MANAGER AI</p>
        <h1>Tham gia sự kiện với một tài khoản an toàn.</h1>
        <p>Tạo tài khoản người tham dự để đăng ký sự kiện, nhận vé, check-in và gửi phản hồi.</p>
      </section>
      <section className="login-panel">
        <form className="login-card register-card" onSubmit={submit} noValidate>
          <p className="eyebrow">TẠO TÀI KHOẢN</p>
          <h2>Đăng ký tài khoản người tham dự</h2>
          <p className="form-subtitle">Tài khoản công khai sẽ được cấp quyền Người tham dự.</p>
          {success ? (
            <div className="registration-success" role="status">
              <strong>Tạo tài khoản thành công!</strong>
              <p>Bây giờ bạn có thể đăng nhập bằng tài khoản mới của mình.</p>
              <button type="button" className="primary-button login-button" onClick={onSignIn}>Tiếp tục đăng nhập</button>
            </div>
          ) : (
            <>
              <label htmlFor="register-name">Họ và tên</label>
              <input id="register-name" name="full_name" autoComplete="name" value={form.full_name} onChange={(e)=>change("full_name",e.target.value)} placeholder="Nguyễn Văn A" disabled={loading}/>
              <label htmlFor="register-email">Email</label>
              <input id="register-email" name="email" type="email" autoComplete="email" value={form.email} onChange={(e)=>change("email",e.target.value)} placeholder="ban@congty.com" disabled={loading}/>
              <PasswordInput id="register-password" name="password" label="Mật khẩu" autoComplete="new-password" value={form.password} onChange={(e)=>change("password",e.target.value)} placeholder="Tối thiểu 8 ký tự" disabled={loading}/>
              <PasswordInput id="register-confirm" name="confirm_password" label="Xác nhận mật khẩu" autoComplete="new-password" value={form.confirmPassword} onChange={(e)=>change("confirmPassword",e.target.value)} placeholder="Nhập lại mật khẩu" disabled={loading}/>
              {error && <div className="form-error" role="alert">{error}</div>}
              <button type="submit" className="primary-button login-button" disabled={loading}>{loading ? "Đang tạo tài khoản..." : "Tạo tài khoản"}</button>
            </>
          )}
          <p className="auth-switch">Đã có tài khoản? <button type="button" className="text-button" onClick={onSignIn} disabled={loading}>Đăng nhập</button></p>
        </form>
      </section>
    </main>
  );
}

export default RegisterPage;
