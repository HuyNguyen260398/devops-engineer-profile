---
goal: Transform DashboardHomeView into an App Launcher with Search Bar and Placeholder Apps
version: 1.0
date_created: 2026-04-10
last_updated: 2026-04-10
owner: huynguyen260398
status: 'Completed'
tags: [feature, frontend, vue, dashboard]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This plan transforms the existing `DashboardHomeView` from a blog-specific statistics page into a general-purpose **app launcher**. The updated home page will display all available mini-apps as searchable cards, enabling users to discover and navigate to any app from a single entry point. Three new placeholder apps — HTML to Markdown, AWS Cost Dashboard, and AWS Resources Dashboard — will be scaffolded with empty views and registered in the router so they are immediately navigable, ready for future implementation.

---

## 1. Requirements & Constraints

- **REQ-001**: The home page must display all available apps as cards in a responsive grid (1 col on mobile, 2 on sm, 3 on lg).
- **REQ-002**: A search bar must be present at the top of the app grid, filtering cards in real-time by app name and description (case-insensitive).
- **REQ-003**: When no apps match the search query, an empty-state message must be displayed using the existing `EmptyState` component.
- **REQ-004**: Three new apps must be registered: "HTML to Markdown" (`/html-to-markdown`), "AWS Cost Dashboard" (`/aws/cost`), "AWS Resources Dashboard" (`/aws/resources`).
- **REQ-005**: Each new app route must render a placeholder view using `PageHeader` + `EmptyState` with a "Coming Soon" message.
- **REQ-006**: Existing blog stat cards (Total Posts, Published, Drafts) must be removed from the home page — they belong in the Blog app, not the global launcher.
- **CON-001**: All files must use Vue 3 `<script setup>` syntax with plain `.js` (not TypeScript).
- **CON-002**: Styling must use only Tailwind CSS token aliases (`bg-surface`, `text-primary`, etc.) — no raw hex values.
- **CON-003**: Dark mode must be handled via CSS token switching triggered by `.dark` on `<html>`. Never use Tailwind `dark:` variants.
- **CON-004**: No new npm packages may be introduced; all icons must come from the already-installed `lucide-vue-next`.
- **GUD-001**: Components must stay under 300 lines; extract sub-components if they grow beyond that.
- **GUD-002**: The app registry (list of apps) must be a static array in `DashboardHomeView.vue` — no Pinia store is needed because it requires no persistence.
- **PAT-001**: New `AppCard` must follow the same hover/focus visual language as the existing quick-action buttons in the current home view (`hover:border-primary/50`, `hover:shadow-card`, `focus-visible:ring-2 focus-visible:ring-primary`).
- **PAT-002**: Placeholder views must use the existing `EmptyState` component with a "Coming Soon" state rather than blank pages.

---

## 2. Implementation Steps

### Implementation Phase 1 — Scaffold Placeholder Views and Routes

- **GOAL-001**: Create three new empty-but-navigable app views and register them in the router so the home page cards have valid destinations before the home page itself is updated.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create directory `src/vuejs-admin-dashboard/src/views/html-to-markdown/`. Create file `HtmlToMarkdownView.vue` inside it. Template: `<script setup>` imports `PageHeader` and `EmptyState`. Template renders `<PageHeader title="HTML to Markdown" subtitle="Convert HTML pages to clean Markdown." />` followed by `<EmptyState title="Coming Soon" description="This tool is under development." />`. | ✅ | 2026-04-10 |
| TASK-002 | Create directory `src/vuejs-admin-dashboard/src/views/aws/`. Create file `AwsCostDashboardView.vue` inside it. Template: `<script setup>` imports `PageHeader` and `EmptyState`. Template renders `<PageHeader title="AWS Cost Dashboard" subtitle="Monitor and analyse your AWS spend." />` followed by `<EmptyState title="Coming Soon" description="This dashboard is under development." />`. | ✅ | 2026-04-10 |
| TASK-003 | Create file `src/vuejs-admin-dashboard/src/views/aws/AwsResourcesDashboardView.vue`. Template: `<script setup>` imports `PageHeader` and `EmptyState`. Template renders `<PageHeader title="AWS Resources" subtitle="Browse and audit your AWS resources." />` followed by `<EmptyState title="Coming Soon" description="This dashboard is under development." />`. | ✅ | 2026-04-10 |
| TASK-004 | Modify `src/vuejs-admin-dashboard/src/router/index.js`. Add three new child route objects inside the existing `AdminLayout` children array: `{ path: 'html-to-markdown', name: 'html-to-markdown', component: () => import('@views/html-to-markdown/HtmlToMarkdownView.vue') }`, `{ path: 'aws/cost', name: 'aws-cost', component: () => import('@views/aws/AwsCostDashboardView.vue') }`, `{ path: 'aws/resources', name: 'aws-resources', component: () => import('@views/aws/AwsResourcesDashboardView.vue') }`. | ✅ | 2026-04-10 |

### Implementation Phase 2 — Create `AppCard` Component

- **GOAL-002**: Build a reusable, accessible app card component that is used by the home page to render each app entry.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Create file `src/vuejs-admin-dashboard/src/components/dashboard/AppCard.vue`. Define props: `name` (String, required), `description` (String, required), `icon` (Object/Function, required), `iconClass` (String, default `'text-primary'`), `iconBgClass` (String, default `'bg-primary-muted'`), `to` (required, String or Object — Vue Router destination), `badge` (String, default `''`). | ✅ | 2026-04-10 |
| TASK-006 | In `AppCard.vue` template: render a `<RouterLink :to="to">` wrapping the card content. Card outer element classes: `group flex items-start gap-4 bg-surface border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-card text-left transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none`. | ✅ | 2026-04-10 |
| TASK-007 | Inside the card: render the icon in a `div` with classes `flex items-center justify-center w-10 h-10 rounded-lg shrink-0` and `:class="iconBgClass"`. Use `<component :is="icon" :size="20" :class="iconClass" aria-hidden="true" />`. Below the icon wrapper, render app name as `<p class="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">{{ name }}</p>` and description as `<p class="text-xs text-on-surface-muted mt-0.5">{{ description }}</p>`. | ✅ | 2026-04-10 |
| TASK-008 | If `badge` prop is non-empty, render a pill badge to the top-right of the card header area: `<span class="ml-auto text-xs font-medium text-on-surface-muted bg-surface-secondary border border-border rounded-full px-2 py-0.5 shrink-0">{{ badge }}</span>`. Place this span inside a flex row alongside the icon+text block. | ✅ | 2026-04-10 |

### Implementation Phase 3 — Rewrite `DashboardHomeView.vue`

- **GOAL-003**: Replace the blog-specific home page with the app-launcher layout: `PageHeader` → search bar → app grid.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-009 | In `DashboardHomeView.vue` `<script setup>`: import `ref` and `computed` from `vue`. Import `PageHeader` from `@components/ui/PageHeader.vue`, `BaseInput` from `@components/ui/BaseInput.vue`, `EmptyState` from `@components/ui/EmptyState.vue`, `AppCard` from `@components/dashboard/AppCard.vue`. Import icons from `lucide-vue-next`: `BookOpen`, `FileCode`, `DollarSign`, `Server`, `Search`. Remove all imports from the previous blog-specific implementation (`useBlogStore`, `StatCard`, `BaseButton`, `PenSquare`, `CheckCircle2`, `FileText`). | ✅ | 2026-04-10 |
| TASK-010 | Define the static `apps` array (plain `const`, not reactive) containing 4 objects. Blog entry: `{ name: 'Blog', description: 'Create and manage blog posts', icon: BookOpen, iconClass: 'text-primary', iconBgClass: 'bg-primary-muted', to: { name: 'blog-list' }, badge: '' }`. HTML to Markdown entry: `{ name: 'HTML to Markdown', description: 'Convert HTML pages to clean Markdown', icon: FileCode, iconClass: 'text-accent-green', iconBgClass: 'bg-accent-green-subtle', to: { name: 'html-to-markdown' }, badge: 'Coming Soon' }`. AWS Cost Dashboard entry: `{ name: 'AWS Cost Dashboard', description: 'Monitor and analyse your AWS spend', icon: DollarSign, iconClass: 'text-accent-yellow', iconBgClass: 'bg-accent-yellow-subtle', to: { name: 'aws-cost' }, badge: 'Coming Soon' }`. AWS Resources entry: `{ name: 'AWS Resources Dashboard', description: 'Browse and audit your AWS resources', icon: Server, iconClass: 'text-on-surface-muted', iconBgClass: 'bg-surface-secondary', to: { name: 'aws-resources' }, badge: 'Coming Soon' }`. | ✅ | 2026-04-10 |
| TASK-011 | Define `const query = ref('')`. Define `const filteredApps = computed(() => apps.filter(a => a.name.toLowerCase().includes(query.value.toLowerCase()) \|\| a.description.toLowerCase().includes(query.value.toLowerCase())))`. | ✅ | 2026-04-10 |
| TASK-012 | In the template, render (in order): (1) `<PageHeader title="Apps" subtitle="Browse and launch your tools." />`. (2) A search wrapper `div` with class `relative mb-6`: inside place a `<Search>` icon absolutely positioned left (`absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted pointer-events-none`) at size 16, and a native `<input type="search" v-model="query" />` with `pl-9` padding (used native input instead of BaseInput since BaseInput wraps in a div that prevents pl-9 override). (3) A results section: `<div v-if="filteredApps.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">` containing `<AppCard v-for="app in filteredApps" :key="app.name" v-bind="app" />`. (4) An `<EmptyState v-else title="No apps found" description="Try a different search term." />`. | ✅ | 2026-04-10 |

---

## 3. Alternatives

- **ALT-001**: Store the app registry in a Pinia store instead of a static array in the view. Rejected — the app list has no persistence or cross-component state requirements at this stage. A static array is simpler and sufficient.
- **ALT-002**: Keep the existing blog stat cards (Total Posts, Published, Drafts) on the home page alongside the new app grid. Rejected — mixing blog-specific metrics with a global launcher creates confusing information hierarchy. Stats are still accessible from `/blog`.
- **ALT-003**: Use a dedicated `useAppRegistry` composable to define apps instead of a plain array. Rejected — a composable adds indirection without benefit until multiple components need to consume the registry.
- **ALT-004**: Add sidebar navigation entries for the three new apps immediately. Not in scope for this plan — sidebar navigation is a separate concern to be addressed when the apps are actually implemented.

---

## 4. Dependencies

- **DEP-001**: `lucide-vue-next` — already installed; provides `BookOpen`, `FileCode`, `DollarSign`, `Server`, `Search` icons.
- **DEP-002**: `vue-router` — already installed; `RouterLink` used inside `AppCard`.
- **DEP-003**: `BaseInput` component at `src/components/ui/BaseInput.vue` — must support `v-model` and accept a `class` prop for padding overrides.
- **DEP-004**: `EmptyState` component at `src/components/ui/EmptyState.vue` — must accept `title` and `description` props.
- **DEP-005**: `PageHeader` component at `src/components/ui/PageHeader.vue` — must accept `title` and `subtitle` props.

---

## 5. Files

- **FILE-001**: `src/vuejs-admin-dashboard/src/views/DashboardHomeView.vue` — Full rewrite. Replaces blog-specific content with app-launcher layout.
- **FILE-002**: `src/vuejs-admin-dashboard/src/components/dashboard/AppCard.vue` — New component. Reusable card for displaying a single app entry with icon, name, description, and optional badge.
- **FILE-003**: `src/vuejs-admin-dashboard/src/views/html-to-markdown/HtmlToMarkdownView.vue` — New placeholder view for the HTML to Markdown app.
- **FILE-004**: `src/vuejs-admin-dashboard/src/views/aws/AwsCostDashboardView.vue` — New placeholder view for the AWS Cost Dashboard app.
- **FILE-005**: `src/vuejs-admin-dashboard/src/views/aws/AwsResourcesDashboardView.vue` — New placeholder view for the AWS Resources Dashboard app.
- **FILE-006**: `src/vuejs-admin-dashboard/src/router/index.js` — Modified to register 3 new child routes under `AdminLayout`.

---

## 6. Testing

- **TEST-001**: Navigate to `/` — verify the page title "Apps" is visible, 4 app cards are rendered, and the search bar is empty.
- **TEST-002**: Type "blog" into the search bar — verify only the Blog card remains visible.
- **TEST-003**: Type "aws" into the search bar — verify both "AWS Cost Dashboard" and "AWS Resources Dashboard" cards are visible, Blog and HTML to Markdown are hidden.
- **TEST-004**: Type "xyz" (no match) — verify the `EmptyState` "No apps found" message is displayed and no cards are rendered.
- **TEST-005**: Clear the search bar — verify all 4 cards are restored.
- **TEST-006**: Click the Blog card — verify navigation to `/blog`.
- **TEST-007**: Click the "HTML to Markdown" card — verify navigation to `/html-to-markdown` and the placeholder view renders with "Coming Soon".
- **TEST-008**: Click the "AWS Cost Dashboard" card — verify navigation to `/aws/cost` and the placeholder view renders with "Coming Soon".
- **TEST-009**: Click the "AWS Resources Dashboard" card — verify navigation to `/aws/resources` and the placeholder view renders with "Coming Soon".
- **TEST-010**: Toggle dark mode — verify all token-based colors switch correctly (no hard-coded hex or `dark:` Tailwind variants visible in source).

---

## 7. Risks & Assumptions

- **RISK-001**: `BaseInput` may not forward a `class` prop correctly, preventing the `pl-9` left-padding override needed to accommodate the search icon. Mitigation: if `class` forwarding does not work, wrap `BaseInput` in a styled `div` and use absolute positioning for the icon outside the input.
- **RISK-002**: The `EmptyState` component may require props named differently from `title`/`description`. Mitigation: read `EmptyState.vue` before TASK-001 and TASK-012 to confirm exact prop names.
- **ASSUMPTION-001**: The `@views` path alias resolves to `src/views/` as configured in `vite.config.js`, so `import('@views/html-to-markdown/HtmlToMarkdownView.vue')` will work without additional alias configuration.
- **ASSUMPTION-002**: `lucide-vue-next` exports `FileCode`, `DollarSign`, and `Server` icons. If any are missing, substitute with `Code`, `CreditCard`, and `Database` respectively.
- **ASSUMPTION-003**: Removing the blog stat cards from the home view will not break any other component — those stats are derived from `useBlogStore` which remains intact and accessible from `/blog`.

---

## 8. Related Specifications / Further Reading

- [feature-vuejs-admin-dashboard-frontend-1.md](./feature-vuejs-admin-dashboard-frontend-1.md) — Original Vue.js admin dashboard frontend plan
- [Vue 3 Composition API — script setup](https://vuejs.org/api/sfc-script-setup.html)
- [Vue Router 4 — RouterLink](https://router.vuejs.org/api/index.html#router-link-props)
- [lucide-vue-next icon list](https://lucide.dev/icons/)
