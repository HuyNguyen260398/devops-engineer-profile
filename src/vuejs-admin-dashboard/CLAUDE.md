# CLAUDE.md — Vue.js Admin Dashboard

This file provides guidance to Claude Code when working in `src/vuejs-admin-dashboard/`.

## Project Overview

A Vue 3 SPA admin dashboard with a GitHub Primer-inspired design system (light/dark mode). Currently hosts a **Blog** app; additional apps will be added over time. Built with Vite and deployed to AWS Amplify via CodePipeline → CodeBuild.

## Tech Stack

| Layer | Tool |
|-------|------|
| Framework | Vue 3 (Composition API, `<script setup>`) |
| Build | Vite 5 |
| Styling | Tailwind CSS 3 + CSS custom properties |
| State | Pinia (Setup Store pattern) |
| Routing | Vue Router 4 |
| Utilities | @vueuse/core |
| Icons | lucide-vue-next |
| Markdown | marked |

## Key Commands

```bash
# from src/vuejs-admin-dashboard/
npm install          # install dependencies
npm run dev          # start dev server (http://localhost:5173)
npm run build        # production build → dist/
npm run preview      # preview production build locally
```

## Directory Structure

```
src/vuejs-admin-dashboard/
├── src/
│   ├── components/
│   │   ├── blog/         # Blog-specific components (PostCard, etc.)
│   │   ├── dashboard/    # Dashboard widgets (StatCard, etc.)
│   │   ├── sidebar/      # AppSidebar, NavItem
│   │   ├── topbar/       # AppTopbar, ThemeToggle
│   │   └── ui/           # Shared primitives (BaseButton, BaseInput, Toast, …)
│   ├── composables/      # useMotion, useTheme, useToast
│   ├── layouts/          # AdminLayout.vue (shell with sidebar + topbar)
│   ├── router/           # Vue Router config (index.js)
│   ├── stores/           # Pinia stores (blog.js uses localStorage)
│   ├── utils/            # markdown.js (marked wrapper)
│   ├── views/
│   │   ├── DashboardHomeView.vue
│   │   └── blog/         # BlogListView, BlogDetailView, BlogFormView
│   ├── App.vue
│   ├── main.js
│   └── style.css         # Tailwind directives + CSS token definitions
├── index.html
├── vite.config.js        # @/ → src/, @components/, @views/ aliases
├── tailwind.config.js    # token-mapped color palette, Inter/JetBrains fonts
├── buildspec.yml         # AWS CodeBuild spec (Node 20, npm ci, vite build)
└── package.json
```

## Design System

### Color Tokens

All colors are CSS custom properties defined in `src/style.css`. Never use raw hex values in components — use the Tailwind token aliases instead.

| Tailwind class | Token |
|----------------|-------|
| `bg-surface` / `text-on-surface` | Page background / primary text |
| `bg-surface-secondary` | Sidebar, cards, inputs |
| `text-on-surface-muted` | Secondary text |
| `text-primary` | Links, active states, CTAs |
| `border-border` | Default borders |
| `text-accent-green` / `bg-accent-green-subtle` | Published / success |
| `text-accent-yellow` / `bg-accent-yellow-subtle` | Draft / warning |
| `text-accent-red` / `bg-accent-red-subtle` | Danger / delete |

### Dark Mode

Dark mode is toggled by adding/removing the `.dark` class on `<html>` via `useTheme.js`. Tailwind is configured with `darkMode: 'class'`. Never use Tailwind's `dark:` variant — rely on the token layer instead (tokens automatically switch when `.dark` is present).

### Typography

- UI text: `Inter` (sans-serif)
- Code / monospace: `JetBrains Mono`, fallback `Fira Code`
- Markdown prose: `.prose-github` utility class defined in `style.css`

## Routing

```
/               → DashboardHomeView
/blog           → BlogListView
/blog/new       → BlogFormView (create)
/blog/:id       → BlogDetailView
/blog/:id/edit  → BlogFormView (edit)
```

All routes are children of `AdminLayout`, which renders `AppSidebar` + `AppTopbar` + `<router-view>`.

## State Management

Blog posts are persisted to `localStorage` under the key `admin-hub:blog-posts`. The `useBlogStore` (Pinia Setup Store) exposes:

- `posts` — reactive ref array
- `createPost(data)` — generates id, slug, timestamps
- `updatePost(id, updates)` — immutable update, re-slugs on title change
- `deletePost(id)`
- `getPostById(id)`

## Path Aliases (vite.config.js)

| Alias | Resolves to |
|-------|-------------|
| `@` | `src/` |
| `@components` | `src/components/` |
| `@views` | `src/views/` |

## CI/CD

`buildspec.yml` is consumed by AWS CodeBuild:
1. Install: `npm ci` (Node 20)
2. Build: `npm run build`
3. Artifact: `dist/**/*` — passed to the Amplify deploy Lambda

## Conventions

- Use Vue 3 `<script setup>` for all new components.
- Composables live in `src/composables/` and are named `use<Feature>.js`.
- Shared UI primitives go in `src/components/ui/`. Feature-specific components go in their own subdirectory (`blog/`, `dashboard/`, etc.).
- Store files are flat `.js` modules in `src/stores/`.
- Do not use `dark:` Tailwind variants — rely on CSS token switching.
- Keep components under 300 lines; extract sub-components or composables when they grow beyond that.
