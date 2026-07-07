"use client";

import { Check, Terminal } from "lucide-react";
import { useEffect, useState } from "react";

const bootMessages = [
  "Mounting interface modules",
  "Resolving portfolio data",
  "Loading skills graph",
  "Workspace ready",
] as const;

export function BootLoader({ reducedMotion }: { reducedMotion: boolean }) {
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (reducedMotion) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const stepTimers = bootMessages.slice(1).map((_, index) =>
      window.setTimeout(() => setStep(index + 1), (index + 1) * 250),
    );
    const exitTimer = window.setTimeout(() => setExiting(true), 1200);
    const removeTimer = window.setTimeout(() => {
      document.body.style.overflow = previousOverflow;
      setVisible(false);
    }, 1500);

    return () => {
      stepTimers.forEach(window.clearTimeout);
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, [reducedMotion]);

  if (reducedMotion || !visible) return null;

  const progress = ((step + 1) / bootMessages.length) * 100;

  return (
    <div
      className={exiting ? "boot-loader is-exiting" : "boot-loader"}
      role="status"
      aria-label="Portfolio boot sequence"
      aria-live="polite"
    >
      <div className="boot-loader-panel">
        <div className="boot-loader-heading">
          <Terminal aria-hidden="true" size={20} />
          <span>portfolio.system</span>
          <strong>BOOT</strong>
        </div>
        <div className="boot-loader-log">
          {bootMessages.slice(0, step + 1).map((message, index) => (
            <p className={index === step ? "is-current" : "is-complete"} key={message}>
              {index < step ? <Check aria-hidden="true" size={14} /> : <span aria-hidden="true">›</span>}
              {message}
              {index === step ? <i aria-hidden="true" /> : null}
            </p>
          ))}
        </div>
        <div className="boot-loader-progress-row">
          <div
            className="boot-loader-progress"
            role="progressbar"
            aria-label="Loading portfolio"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <output>{Math.round(progress)}%</output>
        </div>
      </div>
    </div>
  );
}
