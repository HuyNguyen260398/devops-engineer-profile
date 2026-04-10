# Vue.js Admin Dashboard

A GitHub Primer-inspired admin dashboard built with Vue 3, Tailwind CSS, Pinia, and Vue Router 4.

## Tech Stack

| Tool | Version |
|------|---------|
| Vue 3 | ^3.4 |
| Vite | ^5.2 |
| Tailwind CSS | ^3.4 |
| Pinia | ^2.1 |
| Vue Router | ^4.3 |
| Lucide Vue Next | ^0.378 |
| marked | ^12 |
| turndown | ^7 |
| @vueuse/core | ^10.9 |

## Local Development

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview
```

## Project Structure

```
src/
├── App.vue                     # Root component — applies dark/light class
├── main.js                     # App entry point
├── style.css                   # Tailwind directives + CSS custom properties
├── router/index.js             # Vue Router 4 — lazy-loaded routes
├── composables/
│   ├── useTheme.js             # Dark/light mode toggle + localStorage persistence
│   ├── useToast.js             # Toast notification composable
│   ├── useMotion.js            # Respects prefers-reduced-motion
│   └── useHtmlToMarkdown.js    # Fetch URL via CORS proxy, convert HTML→MD, download
├── stores/
│   └── blog.js                 # Pinia store — blog posts, localStorage persistence
├── layouts/
│   └── AdminLayout.vue         # Shell: sidebar + topbar + router-view
├── components/
│   ├── sidebar/
│   │   ├── AppSidebar.vue      # Sidebar (desktop fixed / mobile drawer)
│   │   └── NavItem.vue         # Router-linked nav item
│   ├── topbar/
│   │   ├── AppTopbar.vue       # Sticky top bar with hamburger + theme toggle
│   │   └── ThemeToggle.vue     # Dark/light icon toggle button
│   ├── ui/
│   │   ├── BaseButton.vue      # primary / secondary / ghost / danger variants
│   │   ├── BaseInput.vue       # Accessible labeled input with error/helper
│   │   ├── BaseTextarea.vue    # Auto-resize textarea
│   │   ├── BaseSelect.vue      # Accessible select wrapper
│   │   ├── ConfirmDialog.vue   # Focus-trapped destructive action modal
│   │   ├── StatusBadge.vue     # Draft / Published badge
│   │   ├── PageHeader.vue      # Page title + optional CTA slot
│   │   ├── EmptyState.vue      # Empty state illustration block
│   │   ├── LoadingSpinner.vue  # Animated SVG spinner
│   │   └── Toast.vue           # Auto-dismiss toast (aria-live)
│   ├── blog/
│   │   └── PostCard.vue        # Blog post summary card
│   ├── html-to-markdown/
│   │   └── MarkdownPreview.vue # Rendered/Raw tab view for converted Markdown
│   └── dashboard/
│       └── StatCard.vue        # Metric card with icon
├── views/
│   ├── DashboardHomeView.vue   # Dashboard home / app launcher
│   ├── html-to-markdown/
│   │   └── HtmlToMarkdownView.vue  # URL input, conversion, preview, download
│   └── blog/
│       ├── BlogListView.vue    # Post grid + empty state
│       ├── BlogDetailView.vue  # Full post + edit/delete actions
│       └── BlogFormView.vue    # Create/edit form with markdown preview
└── utils/
    └── markdown.js             # marked wrapper with basic XSS stripping
```

## Design Tokens

All colors are defined as CSS custom properties under `.light` and `.dark` selectors in `src/style.css`, then referenced via Tailwind semantic tokens (e.g. `bg-surface`, `text-on-surface-muted`, `border-border`).

Dark mode is toggled by adding/removing the `dark` class on `<html>`, persisted in `localStorage` under the key `theme`.

## Apps

| App | Route | Description |
|-----|-------|-------------|
| Dashboard Home | `/` | App launcher with links to all tools |
| Blog | `/blog` | Create, edit, and publish Markdown blog posts stored in `localStorage` |
| HTML to Markdown | `/html-to-markdown` | Paste a public URL and convert the page HTML to clean Markdown, with live preview and `.md` download |
| AWS Cost Dashboard | `/aws/cost` | Placeholder for AWS cost visualisation |
| AWS Resources Dashboard | `/aws/resources` | Placeholder for AWS resource inventory |

## Notes

- All data is stored in `localStorage` — no backend required.
- Blog content supports Markdown (rendered via `marked`).
- The HTML-to-Markdown tool fetches remote pages via the [`allorigins.win`](https://allorigins.win/) public CORS proxy — no backend required. Markdown conversion is performed client-side by `turndown`.
- Router history mode is used — a rewrite rule is needed on the hosting layer (configured in the Amplify deployment plan).
