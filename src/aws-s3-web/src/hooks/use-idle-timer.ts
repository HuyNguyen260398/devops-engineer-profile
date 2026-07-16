"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
const LAST_ACTIVITY_KEY = "blog-last-activity";
const WRITE_THROTTLE_MS = 1000;

export interface IdleTimerOptions {
  timeoutMs: number;
  warnMs: number;
  onExpire: () => void;
  enabled?: boolean;
}

export interface IdleTimerState {
  warning: boolean;
  secondsLeft: number;
  stayActive: () => void;
}

export function useIdleTimer({ timeoutMs, warnMs, onExpire, enabled = true }: IdleTimerOptions): IdleTimerState {
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(warnMs / 1000));
  const deadlineRef = useRef(0);
  const warningRef = useRef(false);
  const lastWriteRef = useRef(0);
  const onExpireRef = useRef(onExpire);

  // Keep the latest onExpire callback without re-running the timer effect.
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const reset = useCallback(() => {
    deadlineRef.current = Date.now() + timeoutMs;
    warningRef.current = false;
    setWarning(false);
  }, [timeoutMs]);

  const stayActive = useCallback(() => reset(), [reset]);

  useEffect(() => {
    if (!enabled) return;
    // Arm the timer without touching React state (warning starts false; the
    // interval below is the only path that raises it).
    deadlineRef.current = Date.now() + timeoutMs;
    warningRef.current = false;

    const markActivity = () => {
      if (warningRef.current) return; // once warning shows, only the button resets
      const now = Date.now();
      reset();
      if (now - lastWriteRef.current > WRITE_THROTTLE_MS) {
        lastWriteRef.current = now;
        try {
          window.localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
        } catch {
          /* storage may be unavailable; the in-tab timer still works */
        }
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === LAST_ACTIVITY_KEY && !warningRef.current) reset();
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActivity, { passive: true }));
    window.addEventListener("storage", onStorage);

    const interval = window.setInterval(() => {
      const remaining = deadlineRef.current - Date.now();
      if (remaining <= 0) {
        onExpireRef.current();
        return;
      }
      if (remaining <= warnMs) {
        warningRef.current = true;
        setWarning(true);
        setSecondsLeft(Math.ceil(remaining / 1000));
      } else if (warningRef.current) {
        warningRef.current = false;
        setWarning(false);
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActivity));
      window.removeEventListener("storage", onStorage);
      window.clearInterval(interval);
    };
  }, [enabled, warnMs, timeoutMs, reset]);

  return { warning, secondsLeft, stayActive };
}
