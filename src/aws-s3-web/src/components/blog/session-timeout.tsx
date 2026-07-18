"use client";

import { refreshSession, signOut } from "@/lib/blog/auth";
import { useIdleTimer } from "@/hooks/use-idle-timer";
import { useEditorDirty } from "@/context/editor-dirty";

const TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MS ?? 1_800_000);
const WARN_MS = Number(process.env.NEXT_PUBLIC_IDLE_WARN_MS ?? 60_000);

export function SessionTimeout() {
  const { dirty } = useEditorDirty();

  async function expire() {
    await signOut();
    window.location.href = "/login";
  }

  const { warning, secondsLeft, stayActive } = useIdleTimer({
    timeoutMs: TIMEOUT_MS,
    warnMs: WARN_MS,
    onExpire: () => {
      void expire();
    },
  });

  if (!warning) return null;

  function onStay() {
    void refreshSession();
    stayActive();
  }

  return (
    <div className="blog-session-overlay" role="dialog" aria-modal="true" aria-labelledby="session-timeout-title">
      <div className="blog-session-modal">
        <h2 id="session-timeout-title">session expiring</h2>
        <p>You will be signed out in {secondsLeft}s due to inactivity.</p>
        {dirty && (
          <p className="blog-error"># You have unsaved changes — save your draft first to keep your progress.</p>
        )}
        <div className="blog-editor-actions">
          <button type="button" className="terminal-button terminal-button-primary" onClick={onStay}>
            stay signed in
          </button>
          <button type="button" className="terminal-button" onClick={() => void expire()}>
            sign out now
          </button>
        </div>
      </div>
    </div>
  );
}
