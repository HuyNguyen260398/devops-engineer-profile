"use client";

import { useState } from "react";

import { signIn, completeNewPassword } from "@/lib/blog/auth";
import { BlogShell } from "@/components/blog/blog-shell";

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
        window.location.href = "/admin";
        return;
      }
      const res = await signIn(email, password);
      if (res.nextStep?.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
        setNeedsNewPassword(true);
        return;
      }
      window.location.href = "/admin";
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BlogShell narrow>
      <h1 className="blog-prompt-heading">login</h1>
      <p className="blog-subhead"># Admin access only.</p>
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
          {needsNewPassword ? "set password" : "sign in"}
        </button>
        {err && <p className="blog-error">{err}</p>}
      </form>
    </BlogShell>
  );
}
