# Blog draft preview, in-editor preview & idle session timeout — Design

**Date:** 2026-07-15
**Area:** `src/aws-s3-web` (Next.js static-export portfolio + blog)
**Status:** Approved for planning

## Summary

Three related changes to the blog area of the portfolio site:

1. A new **read-only draft preview** route `nghuy.link/blogs-draft/<slug>` — private, authentication required — that renders an unpublished post exactly as a published post would look.
2. A **preview toggle** inside the editor so an author can preview the current (including unsaved) content while creating or editing.
3. A **30-minute idle session timeout** applied **only to private/authenticated routes**, with a pre-sign-out warning that reminds the author to save their draft, and a "Stay signed in" option.

All work is exercisable on the local dev server with the in-memory backend harness and dev-auth bypass — **no AWS required** — and follows a local-first verification order before any production deploy.

## Context: current architecture

- **Frontend:** Next.js with `output: "export"` (static HTML) → S3 → CloudFront. A CloudFront Function (`inf/terraform/aws-s3-web/cloudfront-rewrite.js`) maps clean URLs onto the flat exported HTML layout. Dynamic slug routes export a single `_` shell that a client component fills at runtime by reading the slug from the URL.
- **Auth:** AWS Cognito via AWS Amplify (`src/lib/blog/auth.ts`). `getIdToken()` returns the ID token; `AuthGuard` (`src/components/blog/auth-guard.tsx`) gates every private page by calling `currentUser()` and redirecting to `/login` when absent.
- **Backend:** Lambda + API Gateway with a Cognito authorizer (`backend/src/handler.ts`). Public: `GET /posts`, `GET /posts/{key}` (published only). Authed: `GET /drafts`, `GET /drafts/{key}` (any status incl. drafts, with body), `POST/PUT/DELETE /posts`, `POST /uploads`.
- **Editor:** TipTap (`src/components/blog/editor.tsx`). `save(status)` creates/updates then redirects (draft → `/blogs-draft`, published → `/blogs/<slug>`). `PostView` (`src/components/blog/post-view.tsx`) renders stored TipTap JSON → HTML for public detail pages.
- **Local dev:** In-memory backend harness `backend/local/server.ts` (`pnpm local:dev`, port 3001) implements every existing route including `GET /drafts/{key}`. Frontend `.env.development` sets `NEXT_PUBLIC_API_BASE=http://localhost:3001` and `NEXT_PUBLIC_DEV_AUTH=1`. Under dev-auth, `getIdToken()` returns the literal `"local-dev"` token the harness accepts, `currentUser()` always returns `{ email: "admin@local" }`, and `signOut()` is a no-op.

### Current blog URL map (unchanged by this work except the new route)

| Path | Purpose | Access |
| --- | --- | --- |
| `/blogs` | list all blogs | public |
| `/blogs/<slug>` | blog detail | public |
| `/login` | login page | public page, gates access to private area |
| `/blogs-draft` | list draft blogs | private (auth) |
| **`/blogs-draft/<slug>`** | **read-only draft preview (NEW)** | **private (auth)** |
| `/blogs/editor` | create new blog | private (auth) |
| `/blogs/editor/<slug>` | edit blog | private (auth) |

## Research finding (justifies the approach)

AWS Amplify automatically refreshes Cognito access/ID tokens under the hood within the refresh-token window, so `session.isValid()` effectively stays `true` and token expiry **cannot** be relied on to enforce an idle timeout. The established pattern is a **custom client-side activity timer** that watches user-interaction events, warns before timeout, and calls `signOut()` itself. This is why enforcement is client-side only (no Cognito token-validity change). Sources:
- https://github.com/aws-amplify/amplify-js/issues/2384
- https://github.com/aws-amplify/amplify-js/issues/2714
- https://github.com/aws-amplify/amplify-js/issues/505

## Decisions (locked)

- **Timeout model:** idle timeout — 30 min of no activity → warn → sign out; any activity resets the timer.
- **Warning action:** modal with countdown + "save your draft" reminder when there are unsaved changes + a **Stay signed in** button (resets timer and refreshes the session) and a **Sign out now** button.
- **Enforcement scope:** client-side session timer only. No Terraform/Cognito token-validity changes.
- **Draft preview UX:** on `/blogs-draft`, a draft card opens the read-only preview at `/blogs-draft/<slug>`; that preview page has an **Edit** button linking to `/blogs/editor/<slug>`.

## Design

### 1. Idle session timeout (private routes only)

A client-side **`SessionTimeout`** provider mounted inside `AuthGuard`. Because `AuthGuard` wraps only the private pages (`/blogs-draft`, `/blogs-draft/<slug>`, `/blogs/editor`, `/blogs/editor/<slug>`) and never the public pages (`/blogs`, `/blogs/<slug>`, `/login`), the timeout applies to private routes only — satisfying the requirement by construction.

Mechanics:

- **Activity listeners** — `mousemove`, `keydown`, `click`, `scroll`, `touchstart` (throttled, passive) reset a 30-minute idle timer.
- **Warning phase** — at `warn` ms before expiry (default 60 s) a modal appears: a live countdown, an "your session is about to expire" message, a conditional "You have unsaved changes — save your draft first" line (driven by the editor dirty flag, section 2), and two buttons:
  - **Stay signed in** — resets the idle timer and calls `refreshSession()` (`fetchAuthSession({ forceRefresh: true })`) to keep tokens fresh; dismisses the modal.
  - **Sign out now** — immediate sign-out.
- **Expiry** — when the countdown reaches zero: call `signOut()` then redirect to `/login`.
- **Cross-tab sync** — a `localStorage` "last-activity" timestamp plus `storage` events so activity or sign-out in one tab is reflected in all open private tabs (prevents one tab signing out while the author works in another).

Timing values are env-configurable (see §6): `NEXT_PUBLIC_IDLE_TIMEOUT_MS` (default `1800000` = 30 min) and `NEXT_PUBLIC_IDLE_WARN_MS` (default `60000` = 60 s).

### 2. Unsaved-changes awareness

A lightweight shared context **`EditorDirtyContext`** exposes a boolean `dirty` flag plus setters.

- `BlogEditor` sets `dirty = true` on any change to title, excerpt, tags, cover image, or body, and sets `dirty = false` after a successful save.
- The `SessionTimeout` warning reads `dirty` to decide whether to show the "save your draft" reminder.
- The same flag drives a native `beforeunload` guard so an accidental tab close / reload while dirty prompts the browser's confirm dialog.

The context is provided high enough (within the private area) that both `BlogEditor` and `SessionTimeout` can access it; on pages without an editor the flag is simply always `false`.

### 3. In-editor content preview

A **Preview / Edit toggle** in the editor. When "preview" is active, the TipTap editing surface is replaced by a read-only render of the **current in-memory editor JSON** using the existing `PostView` component, so the preview matches exactly how a published post appears (cover, title, byline, prose). Toggling back to "edit" restores editing. Because it renders live editor state, it works for **unsaved** content with no save/round-trip.

Refactor: `PostView` currently accepts a full `PostRecord`. Generalize it to accept the fields it actually renders (`title`, `tags`, `coverImage`, `body`, and a nullable `publishedAt`), so the editor can pass live values with `publishedAt: null` (which renders the existing "draft" byline). The public detail page continues to pass a `PostRecord`, which structurally satisfies the narrower prop shape.

### 4. New route: `/blogs-draft/<slug>` (read-only draft preview)

- New page `src/app/blogs-draft/[slug]/page.tsx` exporting `generateStaticParams()` returning `[{ slug: "_" }]` (mirrors `/blogs/[slug]`), rendering a client component `draft-preview-client.tsx`.
- The client component is wrapped in `AuthGuard`, reads the slug from the URL, fetches via the existing authed `getDraft(slug, token)` (`GET /drafts/{key}`), and renders through `PostView` (read-only). **No backend change.**
- Includes an **Edit** button → `/blogs/editor/<slug>`.
- Loading/error/unauthed states reuse the existing `blog-state` patterns; unauthenticated access redirects to `/login` via `AuthGuard`.
- Draft list cards on `/blogs-draft` change their link target from `/blogs/editor/<slug>` to `/blogs-draft/<slug>`.

### 5. CloudFront rewrite (production routing)

Add a rule to `inf/terraform/aws-s3-web/cloudfront-rewrite.js` mapping `/blogs-draft/<slug>` → `/blogs-draft/_.html`, placed **before** the generic `<route>.html` fallback and after the existing `/blogs-draft` exact match stays resolvable (the exact `/blogs-draft` list route must still map to `/blogs-draft.html`). Order:

1. existing editor-by-slug rule
2. existing editor index rule
3. existing `/blogs/<slug>` rule
4. **new:** `/^\/blogs-draft\/.+/` → `/blogs-draft/_.html`
5. generic `<route>.html` fallback (handles `/blogs-draft`, `/blogs`, `/login`, …)

Update the header comment in the file to document the new mapping.

### 6. Local development & rollout

**Two-terminal local run** (documented in `.env.development`):

```
Terminal A:  cd src/aws-s3-web/backend && pnpm local:dev   # in-memory API on :3001
Terminal B:  cd src/aws-s3-web && pnpm dev                 # UI on :3000 → http://localhost:3000/blogs
```

**Local coverage without AWS:**
- Draft-preview route: `next dev` omits `output: "export"`, so `/blogs-draft/[slug]` renders on demand for any slug; the harness already serves `GET /drafts/{key}`. The CloudFront rewrite (§5) is a **production-only** concern and is not exercised by the dev server.
- In-editor preview toggle: pure client state.

**Shortened timer for manual testing:** set `NEXT_PUBLIC_IDLE_TIMEOUT_MS` and `NEXT_PUBLIC_IDLE_WARN_MS` to small values (e.g. `60000` / `15000`) in `.env.development` to watch the full activity-reset → warning → countdown → sign-out flow in seconds. Production build uses the 30-min / 60-s defaults.

**Dev-auth caveats to test around:**
- Under `NEXT_PUBLIC_DEV_AUTH=1`, `signOut()` is a no-op and `currentUser()` always returns a user, and `refreshSession()` is a no-op. So in dev, validate the **timer, warning modal, unsaved-changes reminder, countdown, and redirect-to-`/login` UX** — all Cognito-independent.
- The **real Cognito `signOut()` + `forceRefresh` behavior** is verified separately: point a local `.env.local` at a real user pool with `NEXT_PUBLIC_DEV_AUTH=0`, or verify on a staging deploy.

**Verification gates before production deploy** (run from `src/aws-s3-web`, in order):

1. `pnpm typecheck` and `pnpm lint`
2. `pnpm test` — vitest units (idle timer with fake timers: reset-on-activity, warning fires, timeout signs out; dirty-flag transitions; `PostView` live props)
3. `pnpm test:e2e` — Playwright (in-editor preview toggle, draft-preview route redirects when unauthed, warning modal appears/extends)
4. `pnpm build` — static export must succeed **and** produce `out/blogs-draft/_.html`
5. Manual smoke on the local dev server with the shortened timer
6. Verify the CloudFront rewrite against the built `out/` (confirm `blogs-draft/_.html` exists) and/or a staging CloudFront, then deploy to production.

## Files

**New**
- `src/components/blog/session-timeout.tsx` — provider + warning modal
- `src/hooks/use-idle-timer.ts` — activity-tracking idle timer hook
- `src/context/editor-dirty.tsx` — `EditorDirtyContext` provider + hook
- `src/app/blogs-draft/[slug]/page.tsx` — route shell + `generateStaticParams`
- `src/app/blogs-draft/[slug]/draft-preview-client.tsx` — authed read-only preview

**Edit**
- `src/components/blog/auth-guard.tsx` — mount `SessionTimeout` (and dirty provider) around private children
- `src/components/blog/editor.tsx` — dirty flag wiring + preview/edit toggle
- `src/components/blog/post-view.tsx` — accept live prop shape (not only `PostRecord`)
- `src/app/blogs-draft/page.tsx` — draft card link → `/blogs-draft/<slug>`
- `src/lib/blog/auth.ts` — add `refreshSession()` helper (dev-auth no-op)
- `inf/terraform/aws-s3-web/cloudfront-rewrite.js` — new `/blogs-draft/<slug>` rule + comment
- `.env.development` — optional shortened timer values + comment (kept at defaults or dev values)

**No changes**
- Backend Lambda/API Gateway (`backend/src/*`) and local harness (`backend/local/*`)
- Terraform Cognito/token-validity configuration
- DynamoDB schema

## Testing

- **Unit (vitest):** idle timer (fake timers — reset on activity, warning fires at lead time, sign-out at zero, cross-tab timestamp handling); `EditorDirtyContext` transitions (dirty on edit, clean after save); `PostView` rendering from live props including `publishedAt: null` byline.
- **E2E (Playwright):** editor preview toggle swaps surface and renders content; `/blogs-draft/<slug>` redirects to `/login` when unauthenticated and renders the post when authed (dev-auth); warning modal appears with shortened timer and "Stay signed in" cancels sign-out.
- **Build gate:** `pnpm build` produces `out/blogs-draft/_.html`.

## Out of scope / YAGNI

- No changes to Cognito token lifetimes or refresh-token policy.
- No server-side/absolute session cap (idle only, per decision).
- No new backend routes (draft preview reuses `GET /drafts/{key}`).
- No autosave of drafts (the warning reminds the author to save manually).
