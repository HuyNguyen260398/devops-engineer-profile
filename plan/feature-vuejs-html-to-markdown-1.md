---
goal: HTML to Markdown Converter App — Vue 3 Admin Dashboard
version: 1.0
date_created: 2026-04-10
last_updated: 2026-04-10
owner: huynguyen260398
status: 'In progress'
tags: [feature, vue3, frontend, tool, markdown]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

Build a fully functional **HTML → Markdown converter** tool inside the existing Vue 3 admin dashboard. The user enters a public website URL, the app fetches the page content (via a CORS proxy), converts the HTML to Markdown using `turndown`, previews the result (rendered + raw toggle), and lets the user download the `.md` file. The view already exists as a stub at `src/views/html-to-markdown/HtmlToMarkdownView.vue` and the route `/html-to-markdown` is registered. This plan covers everything from the UI redesign (using the `ui-ux-pro-max` design approach) to the README update.

---

## 1. Requirements & Constraints

- **REQ-001**: User must be able to enter a website URL into an input field and trigger a conversion via a button.
- **REQ-002**: App must fetch the remote URL's HTML content from the browser without direct CORS issues. Use `https://api.allorigins.win/get?url=<encoded-url>` as the CORS proxy (free, no key required).
- **REQ-003**: HTML must be converted to clean Markdown. Use the `turndown` library (add as a new dependency) since `marked` is a Markdown-to-HTML renderer, not an HTML-to-Markdown converter.
- **REQ-004**: Converted Markdown must be previewable in two modes: **Rendered** (HTML via `marked`) and **Raw** (plain text in a `<pre>` block), switchable via tab/toggle.
- **REQ-005**: User must be able to download the converted Markdown as a `.md` file using the Blob URL download pattern.
- **REQ-006**: Loading, error, and empty states must be clearly communicated to the user.
- **REQ-007**: The view must follow the design system — use CSS token classes only (`bg-surface`, `text-on-surface`, `border-border`, etc.), no raw hex values, no `dark:` Tailwind variants.
- **REQ-008**: All components must use `<script setup>`, stay under 300 lines, and use Composition API.
- **REQ-009**: Update `src/vuejs-admin-dashboard/README.md` to document the new HTML-to-Markdown app.
- **CON-001**: Do not introduce a backend server. All logic is client-side; CORS is handled by a third-party proxy.
- **CON-002**: Do not use `dark:` Tailwind variants. Tokens switch automatically via the `.dark` class.
- **CON-003**: The `/html-to-markdown` route is already registered in `src/router/index.js` — no router changes needed.
- **GUD-001**: Apply the `ui-ux-pro-max` design philosophy: intentional hierarchy, editorial layout, clear hover/focus/active states, meaningful motion, not a generic template.
- **GUD-002**: Split large logic (fetch + convert) into a dedicated composable `src/composables/useHtmlToMarkdown.js`.
- **PAT-001**: Download files using `URL.createObjectURL(new Blob([content]))` + programmatic `<a>` click, then `URL.revokeObjectURL`.

---

## 2. Implementation Steps

### Phase 1 — Dependencies & Composable

- GOAL-001: Install `turndown` and build the `useHtmlToMarkdown` composable that encapsulates fetch, convert, loading state, and error state.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Run `npm install turndown` inside `src/vuejs-admin-dashboard/`. Verify `package.json` is updated. | ✅ | 2026-04-10 |
| TASK-002 | Create `src/vuejs-admin-dashboard/src/composables/useHtmlToMarkdown.js`. Export `useHtmlToMarkdown()` returning: `{ url, convert, markdown, isLoading, error, reset }`. | ✅ | 2026-04-10 |
| TASK-003 | Inside the composable, implement `convert()`: (1) validate URL with `new URL(url.value)`, (2) fetch via `https://api.allorigins.win/get?url=${encodeURIComponent(url.value)}`, (3) parse `response.contents` as the raw HTML string, (4) instantiate `TurndownService` and call `.turndown(html)`, (5) set `markdown.value` to result. Handle fetch errors and invalid URLs by setting `error.value`. | ✅ | 2026-04-10 |
| TASK-004 | Implement `downloadMarkdown(filename)` helper inside the composable: create a Blob from `markdown.value`, call `URL.createObjectURL`, programmatically click a hidden `<a>`, then revoke the URL. Export this function. | ✅ | 2026-04-10 |

### Phase 2 — UI Design (ui-ux-pro-max)

- GOAL-002: Design and implement the `HtmlToMarkdownView.vue` with a polished, intentional layout that avoids generic template patterns.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Invoke the `ui-ux-pro-max` skill to generate the visual design direction for this view. Design must include: a two-column editorial layout (input panel left / preview panel right) on desktop, stacked on mobile; clear typographic hierarchy; animated conversion button state; smooth panel transition when markdown appears. | ✅ | 2026-04-10 |
| TASK-006 | Rewrite `src/vuejs-admin-dashboard/src/views/html-to-markdown/HtmlToMarkdownView.vue` with the following structure: `<PageHeader>` at the top, a URL input row with validation feedback, a "Convert to Markdown" button (disabled + spinner while loading), and below (or to the right on desktop) a preview panel with a Rendered/Raw tab toggle. | ✅ | 2026-04-10 |
| TASK-007 | Create `src/vuejs-admin-dashboard/src/components/html-to-markdown/MarkdownPreview.vue` (under 300 lines). Props: `markdown: String`, `mode: 'rendered' | 'raw'`. Rendered tab uses `marked(markdown)` in an inner div with `.prose-github` class. Raw tab shows `<pre><code>` with the plain text. | ✅ | 2026-04-10 |
| TASK-008 | Add a "Download .md" `<BaseButton>` (variant: `secondary`) that only appears after a successful conversion. On click, call `downloadMarkdown(slugified-page-title + '.md')`. Derive the filename from the last path segment of the URL, defaulting to `converted.md`. | ✅ | 2026-04-10 |
| TASK-009 | Implement error state rendering: show a red-bordered alert box with the error message below the input row when `error.value` is non-null. Clear the error when the user modifies the URL input. | ✅ | 2026-04-10 |
| TASK-010 | Implement empty/initial state: when `markdown.value` is empty and no error, show the `<EmptyState>` component with title "Enter a URL to get started" and a descriptive subtitle. | ✅ | 2026-04-10 |

### Phase 3 — README Update

- GOAL-003: Update the project README to document the HTML-to-Markdown app.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | Invoke the `create-readme` skill to update `src/vuejs-admin-dashboard/README.md`: add an "Apps" section (or update the Project Structure section) listing all four apps — Blog, AWS Cost Dashboard, AWS Resources Dashboard, HTML to Markdown — with a one-line description for each. | ✅ | 2026-04-10 |
| TASK-012 | Add `turndown` to the Tech Stack table in `README.md` with version `^7`. | ✅ | 2026-04-10 |
| TASK-013 | Document the CORS proxy approach in a "Notes" or "Technical Notes" section: "HTML-to-Markdown fetch uses `api.allorigins.win` as a client-side CORS proxy — no backend required." | ✅ | 2026-04-10 |

### Phase 4 — Quality Gate

- GOAL-004: Verify the feature works end-to-end and meets quality standards.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-014 | Run `npm run build` inside `src/vuejs-admin-dashboard/`. Fix any build errors using the `build-error-resolver` agent if needed. | ✅ | 2026-04-10 |
| TASK-015 | Manual smoke test: navigate to `/html-to-markdown`, enter `https://example.com`, click "Convert to Markdown", verify rendered preview loads, toggle to Raw view, verify plain markdown text, click Download and verify a `.md` file is saved. | | |
| TASK-016 | Manual error test: enter an invalid URL (e.g. `not-a-url`), verify error message is shown without crashing. Enter a URL that returns a CORS error, verify graceful error display. | | |
| TASK-017 | Run the `code-reviewer` agent on `HtmlToMarkdownView.vue`, `MarkdownPreview.vue`, and `useHtmlToMarkdown.js`. Address all CRITICAL and HIGH findings. | | |

---

## 3. Alternatives

- **ALT-001**: Use a custom backend Lambda function to proxy HTML fetching. Rejected — adds infrastructure complexity and deployment surface. The CORS proxy (`allorigins.win`) is sufficient for a portfolio tool.
- **ALT-002**: Use `marked` for HTML → Markdown. Rejected — `marked` converts Markdown → HTML (one-way). `turndown` is the correct tool for HTML → Markdown.
- **ALT-003**: Store converted markdown in Pinia. Rejected — this is a stateless session tool; local `ref()` inside the composable is sufficient. No cross-page state needed.
- **ALT-004**: Use a `<textarea>` for raw mode. Rejected — a `<pre><code>` block with overflow-auto is more readable and avoids unwanted editability.

---

## 4. Dependencies

- **DEP-001**: `turndown` ^7 — HTML to Markdown conversion library. Must be installed via `npm install turndown`.
- **DEP-002**: `marked` ^12 — Already installed. Used to render the converted Markdown as HTML in the preview.
- **DEP-003**: `https://api.allorigins.win/get?url=` — Public CORS proxy. No API key or account required. Reliability is best-effort (portfolio use only).
- **DEP-004**: `@components/ui/PageHeader.vue` — Existing shared component. No changes needed.
- **DEP-005**: `@components/ui/EmptyState.vue` — Existing shared component. Used for initial state display.
- **DEP-006**: `@components/ui/BaseButton.vue` — Existing shared component. Used for the Convert and Download buttons.
- **DEP-007**: `@components/ui/BaseInput.vue` — Existing shared component. Used for the URL input field.

---

## 5. Files

- **FILE-001**: `src/vuejs-admin-dashboard/src/views/html-to-markdown/HtmlToMarkdownView.vue` — Main view. Rewrite from the current stub. Target: under 250 lines.
- **FILE-002**: `src/vuejs-admin-dashboard/src/components/html-to-markdown/MarkdownPreview.vue` — New component. Handles Rendered/Raw tab display.
- **FILE-003**: `src/vuejs-admin-dashboard/src/composables/useHtmlToMarkdown.js` — New composable. Fetch, convert, download logic.
- **FILE-004**: `src/vuejs-admin-dashboard/package.json` — Add `turndown` dependency.
- **FILE-005**: `src/vuejs-admin-dashboard/README.md` — Update Tech Stack table and add Apps documentation.
- **FILE-006**: `src/vuejs-admin-dashboard/src/router/index.js` — No changes needed (route already registered).

---

## 6. Testing

- **TEST-001**: Unit test `useHtmlToMarkdown.js` — mock `fetch` to return a fixed HTML string; assert `markdown.value` equals expected Markdown output from `TurndownService`.
- **TEST-002**: Unit test URL validation — call `convert()` with `url.value = 'not-a-url'`; assert `error.value` is set and `markdown.value` remains empty.
- **TEST-003**: Unit test download — mock `URL.createObjectURL` and `URL.revokeObjectURL`; assert a programmatic anchor click is triggered with the correct filename.
- **TEST-004**: Component test `MarkdownPreview.vue` — mount with a markdown string; assert rendered tab shows HTML content; switch to Raw tab; assert `<pre>` contains the raw markdown.
- **TEST-005**: E2E test (Playwright) — navigate to `/html-to-markdown`; fill URL input; assert Convert button is enabled; assert preview panel appears after click; assert Download button appears.

---

## 7. Risks & Assumptions

- **RISK-001**: `api.allorigins.win` is a free public service with no SLA. It may be rate-limited or unavailable. Mitigation: display a clear user-facing error; document the limitation in README.
- **RISK-002**: Some websites block scraping or return non-standard HTML that `turndown` cannot cleanly convert. Mitigation: surface the raw Markdown output so users can inspect and edit it manually.
- **RISK-003**: Very large HTML pages may produce very large Markdown strings, causing browser memory pressure. Mitigation: this is a portfolio tool; no mitigation beyond documenting the constraint.
- **ASSUMPTION-001**: `turndown` v7 is compatible with Vite 5 tree-shaking and ESM imports. Verify with a quick build test after installation.
- **ASSUMPTION-002**: `api.allorigins.win` returns the page HTML in `response.contents` as a string. This matches the documented API at `https://allorigins.win/`.
- **ASSUMPTION-003**: The router entry at path `html-to-markdown` pointing to `HtmlToMarkdownView.vue` is already correct — no changes needed to `src/router/index.js`.

---

## 8. Related Specifications / Further Reading

- [CLAUDE.md — Vue.js Admin Dashboard](../src/vuejs-admin-dashboard/CLAUDE.md)
- [Turndown GitHub](https://github.com/mixmark-io/turndown) — HTML to Markdown converter
- [AllOrigins API](https://allorigins.win/) — CORS proxy documentation
- [marked documentation](https://marked.js.org/) — Markdown to HTML renderer used for preview
- [feature-vuejs-dashboard-home-app-launcher-1.md](./feature-vuejs-dashboard-home-app-launcher-1.md) — Prior feature plan for the dashboard home
