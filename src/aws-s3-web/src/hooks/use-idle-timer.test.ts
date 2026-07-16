import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { useIdleTimer } from "./use-idle-timer";

afterEach(() => vi.useRealTimers());

describe("useIdleTimer", () => {
  it("raises the warning in the lead window and then expires", () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    const { result } = renderHook(() => useIdleTimer({ timeoutMs: 5000, warnMs: 2000, onExpire }));
    expect(result.current.warning).toBe(false);
    act(() => vi.advanceTimersByTime(3000)); // remaining 2000 <= warn
    expect(result.current.warning).toBe(true);
    act(() => vi.advanceTimersByTime(2000)); // reach deadline
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("resets on user activity so the warning never fires", () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    const { result } = renderHook(() => useIdleTimer({ timeoutMs: 5000, warnMs: 2000, onExpire }));
    act(() => vi.advanceTimersByTime(2000));
    act(() => window.dispatchEvent(new Event("keydown")));
    act(() => vi.advanceTimersByTime(2500));
    expect(result.current.warning).toBe(false);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("stayActive clears an active warning", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useIdleTimer({ timeoutMs: 5000, warnMs: 2000, onExpire: vi.fn() }));
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.warning).toBe(true);
    act(() => result.current.stayActive());
    expect(result.current.warning).toBe(false);
  });
});
