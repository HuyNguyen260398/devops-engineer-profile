---
goal: "Build a Vue.js Admin Dashboard with GitHub-inspired programmatic theme, dark/light mode, responsive design, and a Blog Post app"
version: "1.0"
date_created: "2026-04-09"
last_updated: "2026-04-09"
owner: "Full Stack Developer"
status: "Planned"
tags: ["feature", "frontend", "vuejs", "admin-dashboard", "blog", "tailwindcss", "dark-mode", "responsive"]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Build a Vue.js admin dashboard with a GitHub-inspired programmatic theme (dark and light mode), responsive for all screen sizes. The dashboard acts as a multi-app shell; the first embedded app is a **Blog Post** manager. All source code lives under `src/vuejs-admin-dashboard/`.

Design guidance follows the **ui-ux-pro-max** skill, referencing the [skillsmp.com](https://skillsmp.com/) theme aesthetic — monospaced/code-aesthetic typography, GitHub Primer-inspired color tokens, muted neutral surfaces with accent blues and greens for interactive states.

---

## 1. Requirements & Constraints

- **REQ-001**: Frontend must be built with **Vue.js 3** (Composition API, `<script setup>`).
- **REQ-002**: Styling must use **Tailwind CSS v3** with a custom design-token configuration.
- **REQ-003**: Theme must be inspired by GitHub's programmatic/Primer design system — neutral dark/light surfaces, monospace code fonts, and accent blues.
- **REQ-004**: Both **dark mode** and **light mode** must be fully implemented using Tailwind's `class` dark-mode strategy; user preference persisted in `localStorage`.
- **REQ-005**: Dashboard must be **responsive** across breakpoints: 375px (mobile), 768px (tablet), 1024px (laptop), 1440px (desktop).
- **REQ-006**: Dashboard must be a **multi-app shell** — sidebar navigation, topbar, and a main content area that renders individual apps via Vue Router child routes.
- **REQ-007**: The first app must be a **Blog Post** manager with list, create, edit, and view functionality.
- **REQ-008**: Source code must be stored under `src/vuejs-admin-dashboard/`.
- **REQ-009**: Router must use **Vue Router 4** with lazy-loaded routes per app.
- **REQ-010**: State management must use **Pinia**.
- **REQ-011**: Blog post data must be persisted via **localStorage** (no backend required at this stage).
- **REQ-012**: All interactive elements must meet **WCAG AA** contrast requirements (4.5:1 normal text, 3:1 large text).
- **REQ-013**: All touch targets must be minimum **44×44px**.
- **REQ-014**: SVG icons only — use **Lucide Vue Next** icon set; no emoji as UI icons.
- **REQ-015**: Navigation sidebar must collapse to a bottom nav or hamburger drawer on mobile.
- **CON-001**: No backend or API integration in this phase; all data is client-side.
- **CON-002**: Must scaffold with **Vite** as the build tool.
- **GUD-001**: Follow mobile-first CSS authoring — base styles for mobile, `md:` and `lg:` overrides.
- **GUD-002**: Use semantic color tokens defined in `tailwind.config.js` (e.g. `surface`, `on-surface`, `primary`, `muted`) — no raw hex values in components.
- **GUD-003**: Font pairing: **Inter** (UI labels, body) + **JetBrains Mono** (code snippets, badges, metadata). Both loaded via Google Fonts.
- **GUD-004**: Spacing follows an 8dp rhythm (Tailwind defaults map to this).
- **PAT-001**: Shell layout pattern: fixed sidebar (desktop) / slide-out drawer (mobile) + sticky topbar + scrollable `<router-view>` content area.
- **PAT-002**: Blog Post app uses a master-detail pattern: list view → detail/edit view.

---

## 2. Implementation Steps

### Implementation Phase 1 — Project Scaffold & Design System

- **GOAL-001**: Initialise the Vite + Vue 3 project, install all dependencies, and configure the Tailwind design token system with GitHub Primer-inspired color palettes and typography.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Run `npm create vite@latest vuejs-admin-dashboard -- --template vue` inside `src/` to scaffold the project at `src/vuejs-admin-dashboard/` | | |
| TASK-002 | Install dependencies: `vue-router@4`, `pinia`, `@vueuse/core`, `lucide-vue-next` | | |
| TASK-003 | Install dev dependencies: `tailwindcss@3`, `postcss`, `autoprefixer`; run `npx tailwindcss init -p` | | |
| TASK-004 | Configure `tailwind.config.js`: enable `darkMode: 'class'`; define semantic color tokens for `surface`, `surface-secondary`, `on-surface`, `on-surface-muted`, `primary`, `primary-hover`, `border`, `accent-green`, `accent-red` for both light and dark variants | | |
| TASK-005 | Add Google Fonts import in `src/style.css`: Inter (400, 500, 600) and JetBrains Mono (400, 600) with `font-display: swap` | | |
| TASK-006 | Define CSS custom properties for color tokens in `src/style.css` under `.light` and `.dark` selectors, mapped to Tailwind `extend.colors` | | |
| TASK-007 | Configure `vite.config.js` with path aliases: `@` → `src/`, `@components` → `src/components/`, `@views` → `src/views/` | | |
| TASK-008 | Create `src/composables/useTheme.js`: read/write `localStorage` key `theme`, toggle `document.documentElement.classList` between `light` and `dark`, default to `prefers-color-scheme` system value | | |

### Implementation Phase 2 — Shell Layout & Navigation

- **GOAL-002**: Build the persistent admin shell: sidebar, topbar, and responsive navigation that houses all apps.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-009 | Create `src/layouts/AdminLayout.vue`: fixed sidebar (desktop `lg:w-64`) + sticky topbar (`h-14`) + `<router-view>` content area with correct padding offsets | | |
| TASK-010 | Create `src/components/sidebar/AppSidebar.vue`: app logo/name, nav item list, collapse/expand toggle button; nav items defined as a config array with `{ label, icon, route }` | | |
| TASK-011 | Create `src/components/sidebar/NavItem.vue`: renders icon (Lucide), label, active state highlight (`router-link-active` class), keyboard-focusable | | |
| TASK-012 | Create `src/components/topbar/AppTopbar.vue`: left — hamburger menu button (mobile only), app title; right — theme toggle button, user avatar placeholder | | |
| TASK-013 | Create `src/components/topbar/ThemeToggle.vue`: icon-only button cycling dark/light; uses `useTheme` composable; aria-label dynamically set to "Switch to dark mode" / "Switch to light mode" | | |
| TASK-014 | Implement mobile responsive behaviour: sidebar hidden off-screen on `< lg`; hamburger in topbar toggles a slide-out drawer overlay with `<Transition>` (200ms ease-out); backdrop dismisses drawer | | |
| TASK-015 | Create `src/router/index.js`: define root route `/` → `AdminLayout`, with child routes for each app; lazy-load each app view with `() => import(...)` | | |
| TASK-016 | Create `src/App.vue`: mount `<RouterView>` only; apply `dark`/`light` class to `<html>` on mount from `useTheme` | | |

### Implementation Phase 3 — Blog Post App

- **GOAL-003**: Implement the Blog Post app with list, create/edit, and view detail screens, all persisted in localStorage via Pinia.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-017 | Create `src/stores/blog.js` Pinia store: state = `posts[]`; each post = `{ id, title, slug, excerpt, content, tags[], status, createdAt, updatedAt }`; actions = `createPost`, `updatePost`, `deletePost`, `getPostById`; hydrate/persist from localStorage | | |
| TASK-018 | Create `src/views/blog/BlogListView.vue`: page header with title + "New Post" CTA button; responsive grid of `PostCard` components; empty state illustration + "Create your first post" action when `posts.length === 0` | | |
| TASK-019 | Create `src/components/blog/PostCard.vue`: displays title, excerpt (max 2 lines, `line-clamp-2`), tags, status badge, date; hover state with subtle shadow elevation; links to detail view | | |
| TASK-020 | Create `src/views/blog/BlogDetailView.vue`: renders full post content (markdown rendered via `marked`); back button; Edit and Delete action buttons in header; delete triggers a confirmation dialog before store action | | |
| TASK-021 | Install `marked` package; create `src/utils/markdown.js` helper to sanitize and parse markdown to HTML | | |
| TASK-022 | Create `src/views/blog/BlogFormView.vue`: shared create/edit form; fields = Title (text), Excerpt (textarea), Content (textarea with markdown preview toggle), Tags (comma-separated input), Status (Draft/Published select); inline validation on blur; submit button shows loading spinner during async localStorage write | | |
| TASK-023 | Create `src/components/ui/ConfirmDialog.vue`: modal dialog with title, message, Cancel and Confirm (destructive red) buttons; trap focus; close on Escape; `aria-modal="true"` | | |
| TASK-024 | Create `src/components/ui/StatusBadge.vue`: renders Draft (yellow) / Published (green) badge using semantic color tokens; includes icon from Lucide | | |
| TASK-025 | Add blog routes to `src/router/index.js`: `/blog` → `BlogListView`, `/blog/:id` → `BlogDetailView`, `/blog/new` → `BlogFormView`, `/blog/:id/edit` → `BlogFormView` | | |
| TASK-026 | Add "Blog" entry to sidebar nav config with `BookOpen` Lucide icon | | |

### Implementation Phase 4 — Shared UI Component Library

- **GOAL-004**: Build reusable, themed, accessible UI primitives used across all dashboard apps.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-027 | Create `src/components/ui/BaseButton.vue`: variants = `primary`, `secondary`, `ghost`, `danger`; sizes = `sm`, `md`, `lg`; loading prop (spinner replaces label); disabled state; `cursor-pointer` on enabled | | |
| TASK-028 | Create `src/components/ui/BaseInput.vue`: label slot, error message slot, helper text slot; `aria-describedby` wired to error/helper; `focus:ring-2` style | | |
| TASK-029 | Create `src/components/ui/BaseTextarea.vue`: same structure as `BaseInput`; auto-resize via `@input` height recalc | | |
| TASK-030 | Create `src/components/ui/BaseSelect.vue`: accessible `<select>` wrapper with label and error slots | | |
| TASK-031 | Create `src/components/ui/PageHeader.vue`: page title (`h1`), optional subtitle, optional right-side slot for CTAs | | |
| TASK-032 | Create `src/components/ui/EmptyState.vue`: centered SVG illustration slot, title, description, action button slot | | |
| TASK-033 | Create `src/components/ui/LoadingSpinner.vue`: animated SVG spinner, `aria-label="Loading"`, `role="status"` | | |
| TASK-034 | Create `src/components/ui/Toast.vue` + `src/composables/useToast.js`: auto-dismiss after 4s; `aria-live="polite"`; stacked at bottom-right (desktop) / bottom-center (mobile) | | |

### Implementation Phase 5 — Dashboard Home & Polish

- **GOAL-005**: Add a dashboard home view with summary cards, apply final visual polish, and validate accessibility + responsiveness.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-035 | Create `src/views/DashboardHomeView.vue`: welcome header, stat summary cards (total posts, published, drafts) using `BlogStore` data; quick-action "New Post" card | | |
| TASK-036 | Create `src/components/dashboard/StatCard.vue`: icon, metric number, label, optional trend indicator; uses semantic color tokens | | |
| TASK-037 | Apply `prefers-reduced-motion` media query — wrap all `<Transition>` duration in a composable `useMotion()` that returns `0ms` when reduced-motion is preferred | | |
| TASK-038 | Verify all color token contrast ratios in both light and dark mode using browser DevTools accessibility panel; fix any pair below 4.5:1 | | |
| TASK-039 | Add `skip to main content` link as first focusable element in `AdminLayout.vue`; visually hidden until focused | | |
| TASK-040 | Add `<meta name="viewport" content="width=device-width, initial-scale=1">` and Open Graph meta tags in `index.html` | | |
| TASK-041 | Manual responsive QA: test layout at 375px, 768px, 1024px, 1440px in Chrome DevTools for both dark and light mode | | |
| TASK-042 | Update `src/vuejs-admin-dashboard/README.md` with local dev setup instructions: `npm install`, `npm run dev`, environment notes | | |

---

## 3. Alternatives

- **ALT-001**: **Nuxt.js instead of Vite + Vue 3** — Provides SSR/SSG and file-based routing out of the box, but introduces unnecessary complexity for a client-side admin dashboard with no SEO requirements.
- **ALT-002**: **Vuetify or PrimeVue component library** — Would accelerate component development but would override the GitHub Primer-inspired custom design system, making it hard to achieve the exact visual theme required.
- **ALT-003**: **CSS Modules or SCSS instead of Tailwind** — More verbose and harder to maintain consistent spacing/color tokens. Tailwind's `extend.colors` + semantic tokens approach achieves the same result with less code.
- **ALT-004**: **Vuex instead of Pinia** — Pinia is the officially recommended Vue 3 state manager; Vuex 4 is in maintenance mode.
- **ALT-005**: **Raw `localStorage` calls in components** — Rejected in favour of centralising all persistence in Pinia stores for testability and consistency.

---

## 4. Dependencies

- **DEP-001**: `vue@3` — Core framework
- **DEP-002**: `vue-router@4` — Client-side routing
- **DEP-003**: `pinia` — State management
- **DEP-004**: `tailwindcss@3` + `postcss` + `autoprefixer` — Styling
- **DEP-005**: `lucide-vue-next` — SVG icon set
- **DEP-006**: `@vueuse/core` — Composable utilities (`useLocalStorage`, `usePreferredColorScheme`)
- **DEP-007**: `marked` — Markdown-to-HTML parsing for blog post content
- **DEP-008**: `vite@5` — Build tool and dev server
- **DEP-009**: Google Fonts CDN — Inter + JetBrains Mono (loaded in `index.html` with `<link rel="preconnect">` and `font-display: swap`)

---

## 5. Files

- **FILE-001**: `src/vuejs-admin-dashboard/` — Project root
- **FILE-002**: `src/vuejs-admin-dashboard/vite.config.js` — Vite config with path aliases
- **FILE-003**: `src/vuejs-admin-dashboard/tailwind.config.js` — Design token definitions (colors, fonts, dark mode strategy)
- **FILE-004**: `src/vuejs-admin-dashboard/src/style.css` — Global styles, CSS custom properties, font imports
- **FILE-005**: `src/vuejs-admin-dashboard/src/App.vue` — Root component; applies theme class to `<html>`
- **FILE-006**: `src/vuejs-admin-dashboard/src/router/index.js` — Route definitions (lazy-loaded)
- **FILE-007**: `src/vuejs-admin-dashboard/src/layouts/AdminLayout.vue` — Shell layout
- **FILE-008**: `src/vuejs-admin-dashboard/src/composables/useTheme.js` — Dark/light mode toggle
- **FILE-009**: `src/vuejs-admin-dashboard/src/composables/useToast.js` — Toast notification composable
- **FILE-010**: `src/vuejs-admin-dashboard/src/stores/blog.js` — Pinia blog store with localStorage persistence
- **FILE-011**: `src/vuejs-admin-dashboard/src/components/sidebar/AppSidebar.vue` — Sidebar nav shell
- **FILE-012**: `src/vuejs-admin-dashboard/src/components/sidebar/NavItem.vue` — Individual sidebar nav item
- **FILE-013**: `src/vuejs-admin-dashboard/src/components/topbar/AppTopbar.vue` — Top navigation bar
- **FILE-014**: `src/vuejs-admin-dashboard/src/components/topbar/ThemeToggle.vue` — Dark/light mode toggle button
- **FILE-015**: `src/vuejs-admin-dashboard/src/components/ui/BaseButton.vue` — Reusable button
- **FILE-016**: `src/vuejs-admin-dashboard/src/components/ui/BaseInput.vue` — Reusable text input
- **FILE-017**: `src/vuejs-admin-dashboard/src/components/ui/BaseTextarea.vue` — Reusable textarea
- **FILE-018**: `src/vuejs-admin-dashboard/src/components/ui/BaseSelect.vue` — Reusable select
- **FILE-019**: `src/vuejs-admin-dashboard/src/components/ui/ConfirmDialog.vue` — Destructive action confirmation modal
- **FILE-020**: `src/vuejs-admin-dashboard/src/components/ui/StatusBadge.vue` — Post status badge
- **FILE-021**: `src/vuejs-admin-dashboard/src/components/ui/PageHeader.vue` — Page title + subtitle block
- **FILE-022**: `src/vuejs-admin-dashboard/src/components/ui/EmptyState.vue` — Empty state placeholder
- **FILE-023**: `src/vuejs-admin-dashboard/src/components/ui/LoadingSpinner.vue` — Animated loader
- **FILE-024**: `src/vuejs-admin-dashboard/src/components/ui/Toast.vue` — Notification toast
- **FILE-025**: `src/vuejs-admin-dashboard/src/components/blog/PostCard.vue` — Blog post card
- **FILE-026**: `src/vuejs-admin-dashboard/src/components/dashboard/StatCard.vue` — Dashboard metric card
- **FILE-027**: `src/vuejs-admin-dashboard/src/views/DashboardHomeView.vue` — Dashboard home
- **FILE-028**: `src/vuejs-admin-dashboard/src/views/blog/BlogListView.vue` — Blog post list
- **FILE-029**: `src/vuejs-admin-dashboard/src/views/blog/BlogDetailView.vue` — Blog post detail
- **FILE-030**: `src/vuejs-admin-dashboard/src/views/blog/BlogFormView.vue` — Blog create/edit form
- **FILE-031**: `src/vuejs-admin-dashboard/src/utils/markdown.js` — Markdown parser utility
- **FILE-032**: `src/vuejs-admin-dashboard/README.md` — Project setup documentation

---

## 6. Testing

- **TEST-001**: Verify `useTheme` composable persists theme to `localStorage` and correctly applies `dark` / `light` class to `document.documentElement` on toggle.
- **TEST-002**: Verify sidebar nav `router-link-active` class is applied to the correct `NavItem` for each route.
- **TEST-003**: Verify `BlogStore.createPost` generates a unique ID and persists the post to localStorage; reload page and confirm post is re-hydrated.
- **TEST-004**: Verify `BlogStore.deletePost` removes the post from state and localStorage.
- **TEST-005**: Verify `BlogFormView` inline validation shows error below each field after blur when field is empty or invalid; submit button remains disabled until form is valid.
- **TEST-006**: Verify `ConfirmDialog` traps focus within the modal, closes on Escape key, and does not call the delete action on Cancel click.
- **TEST-007**: Verify `Toast` auto-dismisses after 4 seconds and announces via `aria-live="polite"`.
- **TEST-008**: Manual responsive test — load at 375px: sidebar must not be visible, hamburger icon must be in topbar, drawer slides in correctly.
- **TEST-009**: Manual accessibility test — keyboard-only navigation through sidebar, topbar, blog list, form; all interactive elements reachable and labeled.
- **TEST-010**: Verify dark mode contrast — open browser accessibility panel in dark mode; confirm no contrast violations on primary text, muted text, badge text.

---

## 7. Risks & Assumptions

- **RISK-001**: `localStorage` has a 5MB browser limit — if blog content is very large, writes may fail silently. Mitigation: catch `QuotaExceededError` in the Pinia store and show a toast error.
- **RISK-002**: Google Fonts CDN may be blocked in some network environments. Mitigation: bundle Inter and JetBrains Mono as local font files as a fallback (optional future task).
- **RISK-003**: Tailwind's JIT mode may purge color token classes used only in JavaScript strings. Mitigation: add all dynamic class patterns to `tailwind.config.js` `safelist`.
- **ASSUMPTION-001**: No authentication or user management is required in this phase.
- **ASSUMPTION-002**: Blog content is plain text or Markdown — no rich-text/WYSIWYG editor is needed in this phase.
- **ASSUMPTION-003**: The app will be deployed as a static SPA (no SSR), so Vue Router history mode requires a rewrite rule configured in the hosting layer (handled in the deployment plan).

---

## 8. Related Specifications / Further Reading

- [Deployment Plan: feature-vuejs-admin-dashboard-infrastructure-1.md](./feature-vuejs-admin-dashboard-infrastructure-1.md)
- [GitHub Primer Design System](https://primer.style/)
- [Tailwind CSS Dark Mode Docs](https://tailwindcss.com/docs/dark-mode)
- [Vue Router 4 Lazy Loading](https://router.vuejs.org/guide/advanced/lazy-loading.html)
- [Pinia Docs](https://pinia.vuejs.org/)
- [Lucide Vue Next](https://lucide.dev/guide/packages/lucide-vue-next)
- [WCAG 2.1 Contrast Requirements](https://www.w3.org/TR/WCAG21/#contrast-minimum)
- [ui-ux-pro-max Skill — Design Intelligence](.claude/skills/ui-ux-pro-max/SKILL.md)
