import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '@/layouts/AdminLayout.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AdminLayout,
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@views/DashboardHomeView.vue'),
        },
        // Blog app routes
        {
          path: 'blog',
          name: 'blog-list',
          component: () => import('@views/blog/BlogListView.vue'),
        },
        {
          path: 'blog/new',
          name: 'blog-new',
          component: () => import('@views/blog/BlogFormView.vue'),
        },
        {
          path: 'blog/:id',
          name: 'blog-detail',
          component: () => import('@views/blog/BlogDetailView.vue'),
        },
        {
          path: 'blog/:id/edit',
          name: 'blog-edit',
          component: () => import('@views/blog/BlogFormView.vue'),
        },
        {
          path: 'html-to-markdown',
          name: 'html-to-markdown',
          component: () => import('@views/html-to-markdown/HtmlToMarkdownView.vue'),
        },
        {
          path: 'aws/cost',
          name: 'aws-cost',
          component: () => import('@views/aws/AwsCostDashboardView.vue'),
        },
        {
          path: 'aws/resources',
          name: 'aws-resources',
          component: () => import('@views/aws/AwsResourcesDashboardView.vue'),
        },
      ],
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
})

export default router
