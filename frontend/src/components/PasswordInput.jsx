import React, { useState } from "react";

function VisibilityIcon({ visible }) {
  return visible ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.7 10.7 0 0112 4c5.5 0 9 5 9 5a16.8 16.8 0 01-2.5 3.1M6.2 6.2C4.1 7.6 3 9 3 9s3.5 5 9 5c1.1 0 2.1-.2 3-.5" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z" /><circle cx="12" cy="12" r="2.5" /></svg>
  );
}

function PasswordInput({ id, name, label, value, onChange, autoComplete, placeholder, disabled }) {
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible ? "Ẩn mật khẩu" : "Hiển thị mật khẩu";

  return <div className="auth-password-field">
    <label htmlFor={id}>{label}</label>
    <div className="auth-password-control">
      <input id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled}/>
      <button type="button" className="password-visibility-toggle" onClick={() => setVisible((current) => !current)} disabled={disabled} aria-label={toggleLabel} title={toggleLabel} aria-pressed={visible}>
        <VisibilityIcon visible={visible}/>
      </button>
    </div>
  </div>;
}

export default PasswordInput;
