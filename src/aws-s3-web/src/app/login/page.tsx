"use client";

import { useState } from "react";

import { signIn, completeNewPassword } from "@/lib/blog/auth";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (needsNewPassword) {
        await completeNewPassword(newPassword);
        window.location.href = "/editor";
        return;
      }
      const res = await signIn(email, password);
      if (res.nextStep?.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
        setNeedsNewPassword(true);
        return;
      }
      window.location.href = "/editor";
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="site-shell">
      <div className="grid-backdrop" aria-hidden="true" />
      <ThemeToggle />
      <div className="blog-login-screen">
        <div className="code-window blog-login-window">
          <div className="window-titlebar">
            <span className="window-dots">
              <span />
              <span />
              <span />
            </span>
            <span className="window-file">
              <span />
              login.sh
            </span>
            <span className="window-spacer" />
          </div>
          <div className="blog-login-body">
            <p className="blog-login-motd"># authenticate to manage posts</p>
            <form className="blog-form" onSubmit={onSubmit}>
              {!needsNewPassword ? (
                <>
                  <label className="blog-field">
                    <span>email</span>
                    <input
                      className="blog-input"
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                  <label className="blog-field">
                    <span>password</span>
                    <input
                      className="blog-input"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>
                </>
              ) : (
                <label className="blog-field">
                  <span>new password</span>
                  <input
                    className="blog-input"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </label>
              )}
              <button className="terminal-button terminal-button-primary" type="submit" disabled={busy}>
                {needsNewPassword ? "./set-password" : "./login"}
              </button>
              {err && <p className="blog-error">{err}</p>}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
