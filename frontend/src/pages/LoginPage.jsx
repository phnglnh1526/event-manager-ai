import React, { useState } from "react";

function LoginPage({ onLogin, loading, error }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setValidationError("Enter your email and password.");
      return;
    }
    setValidationError("");
    const succeeded = await onLogin(email.trim(), password);
    if (succeeded) setPassword("");
  };

  return (
    <main className="login-page">
      <section className="login-intro" aria-label="Product introduction">
        <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
        <p className="eyebrow light">EVENT MANAGER AI</p>
        <h1>Turn event data into clear decisions.</h1>
        <p>Monitor registrations, attendance, capacity, and attendee ratings from one focused workspace.</p>
        <div className="intro-metric"><strong>Live analytics</strong><span>Built for event teams</span></div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Sign in to continue</h2>
          <p className="form-subtitle">Event Management &amp; Analytics</p>

          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" disabled={loading} />

          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" disabled={loading} />

          {(validationError || error) && <div className="form-error" role="alert">{validationError || error}</div>}
          <button type="submit" className="primary-button login-button" disabled={loading}>{loading ? "Signing in..." : "Sign In"}</button>
          <p className="secure-note">Secure access for every event role</p>
        </form>
      </section>
    </main>
  );
}

export default LoginPage;
