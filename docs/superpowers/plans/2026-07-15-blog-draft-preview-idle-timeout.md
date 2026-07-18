# Blog Draft Preview, In-Editor Preview & Idle Timeout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a private read-only draft preview route, an in-editor content preview toggle, and a 30-minute idle session timeout (with save-your-draft warning) that applies only to authenticated routes.

**Architecture:** All logic is client-side in the Next.js app (`src/aws-s3-web`). The idle timeout is a custom activity timer mounted inside `AuthGuard` (which wraps only private pages), because Amplify auto-refreshes Cognito tokens and token expiry cannot enforce idle logout. The draft preview reuses the existing authed `GET /drafts/{key}` endpoint and the `PostView` renderer — no backend change. Production URL routing gets one new CloudFront Function rule.

**Tech Stack:** Next.js 16 (static export), React 19, TipTap 3, AWS Amplify (Cognito), Vitest + Testing Library, Playwright. Local dev uses the in-memory backend harness (`backend/local/server.ts`, `pnpm local:dev`) + dev-auth bypass (`NEXT_PUBLIC_DEV_AUTH=1`).

## Global Constraints

- All commands run from `src/aws-s3-web/` unless a path says otherwise.
- Package manager is **pnpm**. Never introduce npm/yarn lockfiles.
- Client files that use hooks/browser APIs start with `"use client";`.
- Import alias `@/` maps to `src/`.
- Idle timeout default: **1800000 ms** (30 min); warning lead default: **60000 ms** (60 s). Both overridable via `NEXT_PUBLIC_IDLE_TIMEOUT_MS` / `NEXT_PUBLIC_IDLE_WARN_MS`.
- The idle timeout must **never** mount on public pages (`/blogs`, `/blogs/<slug>`, `/login`). It is mounted only via `AuthGuard`.
- No changes to backend Lambda/API Gateway, DynamoDB, or Cognito/Terraform token validity.
- Commit after every task using the message shown in that task's final step.

## File Structure

**New files**
- `src/hooks/use-idle-timer.ts` — activity-tracking idle timer hook (`useIdleTimer`).
- `src/hooks/use-idle-timer.test.ts` — unit tests for the hook.
- `src/context/editor-dirty.tsx` — `EditorDirtyProvider` + `useEditorDirty` + `beforeunload` guard.
- `src/context/editor-dirty.test.tsx` — unit tests for the context.
- `src/components/blog/session-timeout.tsx` — warning modal driven by the idle timer.
- `src/components/blog/session-timeout.test.tsx` — unit tests for the modal.
- `src/app/blogs-draft/[slug]/page.tsx` — static-export shell + `generateStaticParams`.
- `src/app/blogs-draft/[slug]/draft-preview-client.tsx` — authed read-only draft preview.
- `src/app/blogs-draft/[slug]/draft-preview-client.test.tsx` — unit test for the preview client.

**Modified files**
- `src/components/blog/post-view.tsx` — accept a narrow live-data prop shape.
- `src/lib/blog/auth.ts` — add `refreshSession()`.
- `src/components/blog/auth-guard.tsx` — wrap children in `EditorDirtyProvider` + mount `SessionTimeout`.
- `src/components/blog/editor.tsx` — preview/edit toggle + dirty-flag wiring.
- `src/app/blogs-draft/page.tsx` — draft card link → `/blogs-draft/<slug>`.
- `src/app/globals.css` — session-timeout modal styles.
- `.env.example` — document the two idle-timer env vars.
- `e2e/blog-editor-preview.spec.ts` — new Playwright spec (editor preview toggle).
- `inf/terraform/aws-s3-web/cloudfront-rewrite.js` — new `/blogs-draft/<slug>` rule.

---

### Task 1: Generalize `PostView` to accept live editor data

**Files:**
- Modify: `src/aws-s3-web/src/components/blog/post-view.tsx`
- Test: `src/aws-s3-web/src/components/blog/post-view.test.tsx` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces: `PostViewData` type `{ title: string; tags: string[]; coverImage: string | null; publishedAt: string | null; body: unknown }` and `PostView({ post }: { post: PostViewData })`. `PostRecord` is structurally assignable to `PostViewData`, so existing callers (`blog-detail-client.tsx`) keep working unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/components/blog/post-view.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PostView } from "./post-view";

const body = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hello body" }] }] };

describe("PostView", () => {
  it("renders live editor data with a draft byline when publishedAt is null", () => {
    render(<PostView post={{ title: "Live Title", tags: ["aws"], coverImage: null, publishedAt: null, body }} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Live Title");
    expect(screen.getByText(/draft/)).toBeInTheDocument();
    expect(screen.getByText(/hello body/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- post-view`
Expected: FAIL — current `PostView` requires a full `PostRecord` (test passes a narrower object; TS/rendering mismatch) or the test file cannot resolve the new shape.

- [ ] **Step 3: Generalize the component prop type**

In `src/components/blog/post-view.tsx`, replace the `PostRecord` import-based signature. Change the import line and the component signature only:

```tsx
export interface PostViewData {
  title: string;
  tags: string[];
  coverImage: string | null;
  publishedAt: string | null;
  body: unknown;
}

export function PostView({ post }: { post: PostViewData }) {
```

Remove the now-unused `import type { PostRecord } from "@/lib/blog/api";` line. The body of the component is unchanged (it already only reads `post.body`, `post.coverImage`, `post.title`, `post.publishedAt`, `post.tags`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- post-view` then `pnpm typecheck`
Expected: PASS, and typecheck clean (confirms `blog-detail-client.tsx` still compiles because `PostRecord` satisfies `PostViewData`).

- [ ] **Step 5: Commit**

```bash
git add src/aws-s3-web/src/components/blog/post-view.tsx src/aws-s3-web/src/components/blog/post-view.test.tsx
git commit -m "refactor(blog): let PostView accept live editor data shape"
```

---

### Task 2: `useIdleTimer` hook

**Files:**
- Create: `src/aws-s3-web/src/hooks/use-idle-timer.ts`
- Test: `src/aws-s3-web/src/hooks/use-idle-timer.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `useIdleTimer({ timeoutMs, warnMs, onExpire, enabled? }): { warning: boolean; secondsLeft: number; stayActive: () => void }`. Once `warning` is true it stays until `stayActive()` (resets) or `onExpire` fires — passive activity does NOT dismiss it. Activity events reset the timer only while not warning. Writes `localStorage["blog-last-activity"]` and resets on cross-tab `storage` events for the same key.

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/use-idle-timer.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- use-idle-timer`
Expected: FAIL with "Cannot find module './use-idle-timer'".

- [ ] **Step 3: Implement the hook**

Create `src/hooks/use-idle-timer.ts`:

```ts
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
  const deadlineRef = useRef(Date.now() + timeoutMs);
  const warningRef = useRef(false);
  const lastWriteRef = useRef(0);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const reset = useCallback(() => {
    deadlineRef.current = Date.now() + timeoutMs;
    warningRef.current = false;
    setWarning(false);
  }, [timeoutMs]);

  const stayActive = useCallback(() => reset(), [reset]);

  useEffect(() => {
    if (!enabled) return;
    reset();

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
  }, [enabled, warnMs, reset]);

  return { warning, secondsLeft, stayActive };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- use-idle-timer`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/aws-s3-web/src/hooks/use-idle-timer.ts src/aws-s3-web/src/hooks/use-idle-timer.test.ts
git commit -m "feat(blog): add useIdleTimer activity-tracking hook"
```

---

### Task 3: `EditorDirtyContext` provider

**Files:**
- Create: `src/aws-s3-web/src/context/editor-dirty.tsx`
- Test: `src/aws-s3-web/src/context/editor-dirty.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `EditorDirtyProvider({ children })`, `useEditorDirty(): { dirty: boolean; setDirty: (v: boolean) => void }`. Default `dirty` is `false`. While `dirty` is true, a `beforeunload` guard is attached.

- [ ] **Step 1: Write the failing test**

Create `src/context/editor-dirty.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { EditorDirtyProvider, useEditorDirty } from "./editor-dirty";

function Probe() {
  const { dirty, setDirty } = useEditorDirty();
  return (
    <button onClick={() => setDirty(!dirty)}>{dirty ? "dirty" : "clean"}</button>
  );
}

describe("EditorDirtyContext", () => {
  it("defaults to clean and toggles via setDirty", () => {
    render(
      <EditorDirtyProvider>
        <Probe />
      </EditorDirtyProvider>,
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveTextContent("clean");
    fireEvent.click(btn);
    expect(btn).toHaveTextContent("dirty");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- editor-dirty`
Expected: FAIL with "Cannot find module './editor-dirty'".

- [ ] **Step 3: Implement the provider**

Create `src/context/editor-dirty.tsx`:

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface EditorDirtyValue {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
}

const EditorDirtyContext = createContext<EditorDirtyValue>({ dirty: false, setDirty: () => undefined });

export function EditorDirtyProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirtyState] = useState(false);
  const setDirty = useCallback((d: boolean) => setDirtyState(d), []);

  // Guard accidental tab close / reload while there are unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  return <EditorDirtyContext.Provider value={{ dirty, setDirty }}>{children}</EditorDirtyContext.Provider>;
}

export function useEditorDirty(): EditorDirtyValue {
  return useContext(EditorDirtyContext);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- editor-dirty`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/aws-s3-web/src/context/editor-dirty.tsx src/aws-s3-web/src/context/editor-dirty.test.tsx
git commit -m "feat(blog): add EditorDirtyContext with beforeunload guard"
```

---

### Task 4: `refreshSession()` auth helper

**Files:**
- Modify: `src/aws-s3-web/src/lib/blog/auth.ts`

**Interfaces:**
- Consumes: `fetchAuthSession` (already imported in `auth.ts`), `DEV_AUTH`.
- Produces: `refreshSession(): Promise<void>` — forces a Cognito token refresh; no-op under dev-auth. Used by `SessionTimeout` when the user clicks "stay signed in".

> No unit test: this is a thin wrapper over Amplify's `fetchAuthSession`, which is not mockable without an Amplify test harness this repo does not have. It is exercised indirectly by the `SessionTimeout` tests (Task 5, which mocks `auth`) and by manual/staging verification (Task 9). The typecheck gate below is the verification for this task.

- [ ] **Step 1: Add the helper**

In `src/lib/blog/auth.ts`, add after the existing `signOut` function:

```ts
// Called when the user chooses "stay signed in" from the idle-timeout warning:
// proactively refreshes the Cognito tokens so the extended session has valid
// credentials. No-op under the local dev-auth bypass.
export async function refreshSession(): Promise<void> {
  if (DEV_AUTH) return;
  configureAuth();
  try {
    await fetchAuthSession({ forceRefresh: true });
  } catch {
    /* the idle timer reset is the primary effect; a failed refresh is non-fatal */
  }
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm typecheck`
Expected: PASS (no errors). Confirms `fetchAuthSession({ forceRefresh: true })` matches the imported Amplify signature.

- [ ] **Step 3: Commit**

```bash
git add src/aws-s3-web/src/lib/blog/auth.ts
git commit -m "feat(blog): add refreshSession helper for session extension"
```

---

### Task 5: `SessionTimeout` modal + mount in `AuthGuard`

**Files:**
- Create: `src/aws-s3-web/src/components/blog/session-timeout.tsx`
- Test: `src/aws-s3-web/src/components/blog/session-timeout.test.tsx`
- Modify: `src/aws-s3-web/src/components/blog/auth-guard.tsx`
- Modify: `src/aws-s3-web/src/app/globals.css`
- Modify: `src/aws-s3-web/.env.example`

**Interfaces:**
- Consumes: `useIdleTimer` (Task 2), `useEditorDirty` (Task 3), `signOut` + `refreshSession` (Task 4).
- Produces: `SessionTimeout()` component (renders `null` unless warning). Reads timings from `NEXT_PUBLIC_IDLE_TIMEOUT_MS` / `NEXT_PUBLIC_IDLE_WARN_MS` (defaults 1800000 / 60000). `AuthGuard` now renders `<EditorDirtyProvider>{children}<SessionTimeout/></EditorDirtyProvider>` once authenticated.

- [ ] **Step 1: Write the failing tests**

Create `src/components/blog/session-timeout.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- session-timeout`
Expected: FAIL with "Cannot find module './session-timeout'".

- [ ] **Step 3: Implement the component**

Create `src/components/blog/session-timeout.tsx`:

```tsx
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- session-timeout`
Expected: PASS (3 tests). (jsdom may log "Not implemented: navigation" for the `window.location.href` assignment — that is expected and does not fail the test.)

- [ ] **Step 5: Mount it in `AuthGuard`**

Replace the return block of `src/components/blog/auth-guard.tsx` so the provider + modal wrap the private children. Full new file:

```tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";

import { currentUser } from "@/lib/blog/auth";
import { EditorDirtyProvider } from "@/context/editor-dirty";
import { SessionTimeout } from "@/components/blog/session-timeout";

export function AuthGuard({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    currentUser().then((u) => {
      if (!u) {
        window.location.href = "/login";
        return;
      }
      setOk(true);
    });
  }, []);

  if (ok === null) return <p className="blog-state">checking session…</p>;
  return (
    <EditorDirtyProvider>
      {children}
      <SessionTimeout />
    </EditorDirtyProvider>
  );
}
```

- [ ] **Step 6: Add modal styles**

Append to `src/app/globals.css`:

```css
.blog-session-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.6);
  padding: 1rem;
}

.blog-session-modal {
  max-width: 420px;
  width: 100%;
  background: var(--color-surface, #0c0f14);
  border: 1px solid var(--color-border, #2a2f3a);
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}

.blog-session-modal h2 {
  margin: 0 0 0.5rem;
  font-size: 1.05rem;
}
```

- [ ] **Step 7: Document the env vars**

Append to `.env.example`:

```dotenv
# Idle-session timeout for authenticated blog routes (client-side enforcement).
# Defaults if unset: 30 min idle, 60 s warning lead. Lower them in
# .env.development (e.g. 60000 / 15000) to smoke-test the warning flow quickly.
NEXT_PUBLIC_IDLE_TIMEOUT_MS=1800000
NEXT_PUBLIC_IDLE_WARN_MS=60000
```

- [ ] **Step 8: Verify build integrity**

Run: `pnpm test -- session-timeout editor-dirty` then `pnpm typecheck`
Expected: PASS and clean.

- [ ] **Step 9: Commit**

```bash
git add src/aws-s3-web/src/components/blog/session-timeout.tsx \
        src/aws-s3-web/src/components/blog/session-timeout.test.tsx \
        src/aws-s3-web/src/components/blog/auth-guard.tsx \
        src/aws-s3-web/src/app/globals.css \
        src/aws-s3-web/.env.example
git commit -m "feat(blog): idle-timeout warning modal on authenticated routes"
```

---

### Task 6: Editor preview toggle + dirty-flag wiring

**Files:**
- Modify: `src/aws-s3-web/src/components/blog/editor.tsx`
- Test: `src/aws-s3-web/e2e/blog-editor-preview.spec.ts` (create)

**Interfaces:**
- Consumes: `useEditorDirty` (Task 3), generalized `PostView` (Task 1).
- Produces: a "preview"/"edit" toggle button rendering the live editor content through `PostView`; `dirty` set true on any field/body change and false after a successful save.

> Unit-testing TipTap in jsdom is impractical (ProseMirror needs a real DOM/range). The toggle is verified with a Playwright e2e against the dev server; no backend is needed because `/blogs/editor` (create-new) renders under the dev-auth bypass without any fetch.

- [ ] **Step 1: Write the failing e2e test**

Create `e2e/blog-editor-preview.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("editor preview toggle renders the live content read-only", async ({ page }) => {
  await page.goto("/blogs/editor");

  await page.getByPlaceholder("Post title").fill("My Preview Title");

  await page.getByRole("button", { name: "preview", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "My Preview Title" })).toBeVisible();
  // The editing toolbar is hidden while previewing.
  await expect(page.getByRole("button", { name: "B", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "edit", exact: true }).click();
  await expect(page.getByRole("button", { name: "B", exact: true })).toBeVisible();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:e2e -- blog-editor-preview`
Expected: FAIL — there is no "preview" button yet.

- [ ] **Step 3: Wire dirty flag + preview toggle into the editor**

Edit `src/components/blog/editor.tsx`:

3a. Add imports near the top (after existing imports):

```tsx
import { PostView } from "./post-view";
import { useEditorDirty } from "@/context/editor-dirty";
```

3b. Inside `BlogEditor`, add state and the dirty hook after the existing `useState` lines:

```tsx
  const [preview, setPreview] = useState(false);
  const { setDirty } = useEditorDirty();
```

3c. In each field handler, mark dirty. Change the four inputs' `onChange` and the cover setters:

```tsx
  // title input
  onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
```
```tsx
  // excerpt input
  onChange={(e) => { setExcerpt(e.target.value); setDirty(true); }}
```
```tsx
  // tags input
  onChange={(e) => { setTags(e.target.value); setDirty(true); }}
```

For the cover image: in `onPickCover`'s success path change `setCoverImage(await uploadImage(file));` to:

```tsx
      setCoverImage(await uploadImage(file));
      setDirty(true);
```

and the remove button `onClick={() => setCoverImage(null)}` to `onClick={() => { setCoverImage(null); setDirty(true); }}`.

3d. Mark dirty on body edits and clean on save. In the `useEditor({...})` call, add an `onUpdate` handler:

```tsx
  const editor = useEditor({
    extensions: [StarterKit, Image, Placeholder.configure({ placeholder: "Write your post…" })],
    content: (initial?.body as Record<string, unknown>) ?? EMPTY_DOC,
    immediatelyRender: false,
    onUpdate: () => setDirty(true),
  });
```

In `save()`, after a successful save and before the redirect, add `setDirty(false);`:

```tsx
      const saved = initial
        ? await updatePost(initial.id, input, token)
        : await createPost(input, token);
      setDirty(false);
      window.location.href = saved && saved.status === "published" ? `/blogs/${saved.slug}` : "/blogs-draft";
```

3e. Build the live preview data and toggle button. Add this just before the `return (` (after `save`):

```tsx
  const previewData = {
    title,
    tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    coverImage,
    publishedAt: null,
    body: editor?.getJSON() ?? EMPTY_DOC,
  };
```

3f. Replace the toolbar + editing surface block so it swaps for the preview. Change:

```tsx
      {editor && <EditorToolbar editor={editor} />}
      <div className="blog-editor-surface">
        <EditorContent editor={editor} />
      </div>
```

to:

```tsx
      <div className="blog-editor-actions">
        <button
          type="button"
          className={`terminal-button${preview ? " terminal-button-primary" : ""}`}
          onClick={() => setPreview((p) => !p)}
        >
          {preview ? "edit" : "preview"}
        </button>
      </div>

      {preview ? (
        <div className="blog-editor-surface">
          <PostView post={previewData} />
        </div>
      ) : (
        <>
          {editor && <EditorToolbar editor={editor} />}
          <div className="blog-editor-surface">
            <EditorContent editor={editor} />
          </div>
        </>
      )}
```

- [ ] **Step 4: Run the e2e test to verify it passes**

Run: `pnpm test:e2e -- blog-editor-preview`
Expected: PASS. Then `pnpm typecheck` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/aws-s3-web/src/components/blog/editor.tsx src/aws-s3-web/e2e/blog-editor-preview.spec.ts
git commit -m "feat(blog): add in-editor content preview toggle and unsaved-change tracking"
```

---

### Task 7: `/blogs-draft/<slug>` read-only draft preview route

**Files:**
- Create: `src/aws-s3-web/src/app/blogs-draft/[slug]/page.tsx`
- Create: `src/aws-s3-web/src/app/blogs-draft/[slug]/draft-preview-client.tsx`
- Test: `src/aws-s3-web/src/app/blogs-draft/[slug]/draft-preview-client.test.tsx`
- Modify: `src/aws-s3-web/src/app/blogs-draft/page.tsx`

**Interfaces:**
- Consumes: `AuthGuard`, `BlogShell`, `PostView` (Task 1), `getIdToken`, `getDraft` (existing `GET /drafts/{key}`).
- Produces: `DraftPreviewClient()` default-exported via the route; draft list cards now link to `/blogs-draft/<slug>`.

- [ ] **Step 1: Write the failing test**

Create `src/app/blogs-draft/[slug]/draft-preview-client.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/components/blog/auth-guard", () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/blog/auth", () => ({ getIdToken: () => Promise.resolve("t") }));
const getDraft = vi.fn();
vi.mock("@/lib/blog/api", () => ({ getDraft: (...a: unknown[]) => getDraft(...a) }));

import { DraftPreviewClient } from "./draft-preview-client";

describe("DraftPreviewClient", () => {
  it("fetches the draft by slug and renders it with an edit link", async () => {
    window.history.pushState({}, "", "/blogs-draft/hello-world");
    getDraft.mockResolvedValue({
      id: "1",
      slug: "hello-world",
      title: "Draft Title",
      excerpt: "",
      tags: [],
      coverImage: null,
      status: "draft",
      publishedAt: null,
      updatedAt: "2026-07-15T00:00:00Z",
      body: { type: "doc", content: [{ type: "paragraph" }] },
    });

    render(<DraftPreviewClient />);

    expect(await screen.findByRole("heading", { level: 1, name: "Draft Title" })).toBeInTheDocument();
    expect(getDraft).toHaveBeenCalledWith("hello-world", "t");
    expect(screen.getByRole("link", { name: /edit/i })).toHaveAttribute("href", "/blogs/editor/hello-world");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- draft-preview-client`
Expected: FAIL with "Cannot find module './draft-preview-client'".

- [ ] **Step 3: Implement the client component**

Create `src/app/blogs-draft/[slug]/draft-preview-client.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { AuthGuard } from "@/components/blog/auth-guard";
import { BlogShell } from "@/components/blog/blog-shell";
import { PostView } from "@/components/blog/post-view";
import { getIdToken } from "@/lib/blog/auth";
import { getDraft, type PostRecord } from "@/lib/blog/api";

function DraftPreview() {
  const [post, setPost] = useState<PostRecord | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ok">("loading");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    const s = window.location.pathname.split("/").filter(Boolean).pop() ?? "";
    setSlug(s);
    getIdToken()
      .then((token) => {
        if (!token) throw new Error("not authenticated");
        return getDraft(s, token);
      })
      .then((p) => {
        setPost(p);
        setState("ok");
      })
      .catch(() => setState("error"));
  }, []);

  return (
    <BlogShell narrow>
      {state === "loading" && <p className="blog-state">loading…</p>}
      {state === "error" && <p className="blog-state is-error">draft not found</p>}
      {state === "ok" && post && (
        <>
          <div className="blog-editor-actions">
            <Link className="terminal-button" href={`/blogs/editor/${slug}`} prefetch={false}>
              edit
            </Link>
          </div>
          <PostView post={post} />
        </>
      )}
    </BlogShell>
  );
}

export function DraftPreviewClient() {
  return (
    <AuthGuard>
      <DraftPreview />
    </AuthGuard>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- draft-preview-client`
Expected: PASS.

- [ ] **Step 5: Add the static-export route shell**

Create `src/app/blogs-draft/[slug]/page.tsx`:

```tsx
import { DraftPreviewClient } from "./draft-preview-client";

// Static export cannot pre-render unknown slugs; a single `_` shell is exported
// and CloudFront rewrites every /blogs-draft/<slug>/ path to it, then the client
// component reads the real slug from the URL and fetches the draft at runtime.
export function generateStaticParams() {
  return [{ slug: "_" }];
}

export default function Page() {
  return <DraftPreviewClient />;
}
```

- [ ] **Step 6: Point draft cards at the preview**

In `src/app/blogs-draft/page.tsx`, change the `PostCard` href and its comment:

```tsx
            // Drafts are not publicly reachable; open the read-only preview,
            // which links onward to the editor.
            <PostCard key={post.id} post={post} href={`/blogs-draft/${post.slug}`} />
```

- [ ] **Step 7: Verify tests + typecheck**

Run: `pnpm test -- draft-preview-client` then `pnpm typecheck`
Expected: PASS and clean.

- [ ] **Step 8: Commit**

```bash
git add src/aws-s3-web/src/app/blogs-draft/
git commit -m "feat(blog): add private read-only draft preview at /blogs-draft/<slug>"
```

---

### Task 8: CloudFront rewrite rule for `/blogs-draft/<slug>`

**Files:**
- Modify: `inf/terraform/aws-s3-web/cloudfront-rewrite.js`

**Interfaces:**
- Consumes: the exported `out/blogs-draft/_.html` shell produced by `pnpm build` (Task 7 route).
- Produces: production edge routing so `/blogs-draft/<slug>` serves the shell, while `/blogs-draft` (list) still serves `/blogs-draft.html` via the generic fallback.

- [ ] **Step 1: Add the rule**

In `inf/terraform/aws-s3-web/cloudfront-rewrite.js`, insert the following block immediately **before** the final "Every remaining clean route" block (i.e. after the `/^\/blogs\/.+/` block):

```js
  // A /blogs-draft/<slug> maps to the draft-preview client shell (private,
  // AuthGuard-gated at runtime). Must be tested before the generic fallback so
  // "/blogs-draft" itself still falls through to /blogs-draft.html.
  if (/^\/blogs-draft\/.+/.test(uri)) {
    req.uri = "/blogs-draft/_.html";
    return req;
  }
```

Also update the header comment's route list (the `//` block at the top) to add:
`// /blogs-draft/<slug> -> blogs-draft/_.html (a single client shell),`

- [ ] **Step 2: Verify the export produces the shell the rule targets**

Run: `pnpm build`
Expected: build succeeds and `out/blogs-draft/_.html` exists. Verify:

Run: `ls out/blogs-draft/_.html`
Expected: the path prints (file exists). This proves the CloudFront rule has a valid target.

- [ ] **Step 3: Commit**

```bash
git add inf/terraform/aws-s3-web/cloudfront-rewrite.js
git commit -m "feat(infra): route /blogs-draft/<slug> to the draft-preview shell"
```

---

### Task 9: Full verification gate & local smoke test

**Files:** none (verification only).

**Interfaces:**
- Consumes: everything above.
- Produces: a green local run proving the feature works before any production deploy.

- [ ] **Step 1: Static checks**

Run (from `src/aws-s3-web`):
```bash
pnpm typecheck && pnpm lint
```
Expected: both clean.

- [ ] **Step 2: Unit tests**

Run: `pnpm test`
Expected: all suites PASS, including `use-idle-timer`, `editor-dirty`, `session-timeout`, `post-view`, `draft-preview-client`.

- [ ] **Step 3: E2E**

Run: `pnpm test:e2e`
Expected: existing portfolio specs plus `blog-editor-preview` PASS.

- [ ] **Step 4: Production build gate**

Run: `pnpm build && ls out/blogs-draft/_.html`
Expected: build succeeds and the draft shell path prints.

- [ ] **Step 5: Manual smoke on the local dev server**

In `.env.development`, temporarily add short timings, then run the two-terminal setup:

```dotenv
NEXT_PUBLIC_IDLE_TIMEOUT_MS=60000
NEXT_PUBLIC_IDLE_WARN_MS=15000
```

```
Terminal A:  cd src/aws-s3-web/backend && pnpm local:dev
Terminal B:  cd src/aws-s3-web && pnpm dev
```

Verify at http://localhost:3000:
1. `/blogs/editor` → type content → click **preview** shows the rendered post; **edit** returns to the toolbar.
2. Create/save a draft, then open `/blogs-draft` → click a card → lands on `/blogs-draft/<slug>` read-only preview with a working **edit** button.
3. On any authenticated page, stay idle ~45 s → warning modal appears with countdown; with unsaved editor changes it shows the "save your draft" line; **stay signed in** dismisses it; letting it reach zero redirects to `/login`.
4. Open `/blogs` (public) and confirm no warning modal ever mounts there.

Then **revert** the temporary `.env.development` timing lines (leave defaults/unset).

- [ ] **Step 6: Cognito verification note (do not skip before prod)**

Because dev-auth stubs `signOut`/`refreshSession`, verify the real Cognito sign-out + token refresh either with a local `.env.local` pointed at a real user pool (`NEXT_PUBLIC_DEV_AUTH=0`) or on a staging CloudFront deploy before promoting to production.

- [ ] **Step 7: Commit any reverts**

```bash
git add -A
git commit -m "chore(blog): restore default idle-timer env after smoke test" || echo "nothing to revert"
```

---

## Self-Review

**Spec coverage:**
- New `/blogs-draft/<slug>` private preview → Task 7 (route + client) + Task 8 (prod routing). ✓
- In-editor preview option → Task 6. ✓
- 30-min auto sign-out via token/session expiry → Tasks 2 + 5 (idle timer + modal + signOut). ✓
- Cognito best-practice research → captured in spec; drives client-side timer choice (Tasks 2/5) + `refreshSession` (Task 4). ✓
- Warn to save draft before sign-out → Task 3 (dirty flag) + Task 5 (conditional message) + Task 6 (dirty wiring). ✓
- Applies only to private routes → Task 5 mounts inside `AuthGuard`; verified in Task 9 step 5.4. ✓
- Local-dev-first testing → Task 9 (gates + smoke) + env vars in Task 5. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `PostViewData` (Task 1) is consumed by Tasks 6 & 7 via `PostView`; `useIdleTimer` signature (Task 2) matches its call in Task 5; `useEditorDirty()` `{ dirty, setDirty }` (Task 3) matches usage in Tasks 5 & 6; `refreshSession`/`signOut` (Task 4) match the Task 5 mock and calls; `getDraft(slug, token)` matches the existing `api.ts` signature. ✓
