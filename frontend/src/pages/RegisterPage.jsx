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
    if (fullName.length < 2) return setError("Full name must contain at least 2 characters.");
    if (!email) return setError("Enter a valid email address.");
    if (form.password.length < 8) return setError("Password must contain at least 8 characters.");
    if (new TextEncoder().encode(form.password).length > 72) return setError("Password must be at most 72 UTF-8 bytes.");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
    inFlight.current = true; setLoading(true); setError("");
    try {
      await registerAccount({ full_name: fullName, email, password: form.password });
      setSuccess(true); setForm({ full_name: "", email: "", password: "", confirmPassword: "" });
    } catch (requestError) {
      setError(requestError.status === 409 ? "An account with this email already exists." : requestError.status === 422 ? "Review your name, email, and password." : requestError.status === 0 ? "Unable to connect to the server." : "Account could not be created.");
    } finally { inFlight.current = false; setLoading(false); }
  };
  return <main className="login-page"><section className="login-intro" aria-label="Product introduction"><div className="brand-mark" aria-hidden="true"><span/><span/><span/></div><p className="eyebrow light">EVENT MANAGER AI</p><h1>Join events with one secure account.</h1><p>Create an attendee account to register, access tickets, check in, and share feedback.</p></section><section className="login-panel"><form className="login-card register-card" onSubmit={submit} noValidate><p className="eyebrow">CREATE ACCOUNT</p><h2>Register as an attendee</h2><p className="form-subtitle">Public accounts always receive the ATTENDEE role.</p>{success ? <div className="registration-success" role="status"><strong>Account created successfully.</strong><p>You can now sign in with your new account.</p><button type="button" className="primary-button login-button" onClick={onSignIn}>Continue to Sign In</button></div> : <><label htmlFor="register-name">Full name</label><input id="register-name" name="full_name" autoComplete="name" value={form.full_name} onChange={(e)=>change("full_name",e.target.value)} disabled={loading}/><label htmlFor="register-email">Email</label><input id="register-email" name="email" type="email" autoComplete="email" value={form.email} onChange={(e)=>change("email",e.target.value)} disabled={loading}/><PasswordInput id="register-password" name="password" label="Password" autoComplete="new-password" value={form.password} onChange={(e)=>change("password",e.target.value)} disabled={loading}/><PasswordInput id="register-confirm" name="confirm_password" label="Confirm password" autoComplete="new-password" value={form.confirmPassword} onChange={(e)=>change("confirmPassword",e.target.value)} disabled={loading}/>{error&&<div className="form-error" role="alert">{error}</div>}<button type="submit" className="primary-button login-button" disabled={loading}>{loading?"Creating account...":"Create Account"}</button></>}<p className="auth-switch">Already have an account? <button type="button" className="text-button" onClick={onSignIn} disabled={loading}>Sign in</button></p></form></section></main>;
}

export default RegisterPage;
