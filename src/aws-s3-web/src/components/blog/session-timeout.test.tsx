import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const stayActive = vi.fn();
vi.mock("@/hooks/use-idle-timer", () => ({
  useIdleTimer: () => ({ warning: true, secondsLeft: 42, stayActive }),
}));
const signOut = vi.fn().mockResolvedValue(undefined);
const refreshSession = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/blog/auth", () => ({
  signOut: () => signOut(),
  refreshSession: () => refreshSession(),
}));

import { SessionTimeout } from "./session-timeout";
import { EditorDirtyProvider } from "@/context/editor-dirty";

beforeEach(() => {
  stayActive.mockClear();
  signOut.mockClear();
  refreshSession.mockClear();
});

function renderModal() {
  return render(
    <EditorDirtyProvider>
      <SessionTimeout />
    </EditorDirtyProvider>,
  );
}

describe("SessionTimeout", () => {
  it("shows the countdown and both actions while warning", () => {
    renderModal();
    expect(screen.getByText(/signed out in 42s/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stay signed in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out now/i })).toBeInTheDocument();
  });

  it("stay signed in refreshes the session and resets the timer", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /stay signed in/i }));
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(stayActive).toHaveBeenCalledTimes(1);
  });

  it("sign out now triggers signOut", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /sign out now/i }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
