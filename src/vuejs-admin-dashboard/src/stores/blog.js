import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'admin-hub:blog-posts'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(posts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      throw new Error('Storage quota exceeded. Please delete some posts to free up space.')
    }
    throw e
  }
}

export const useBlogStore = defineStore('blog', () => {
  const posts = ref(loadFromStorage())

  function createPost({ title, excerpt, content, tags, status }) {
    const now = new Date().toISOString()
    const post = {
      id: generateId(),
      title,
      slug: generateSlug(title),
      excerpt,
      content,
      tags: Array.isArray(tags) ? tags : [],
      status: status ?? 'draft',
      createdAt: now,
      updatedAt: now,
    }
    posts.value.unshift(post)
    saveToStorage(posts.value)
    return post
  }

  function updatePost(id, updates) {
    const index = posts.value.findIndex((p) => p.id === id)
    if (index === -1) throw new Error(`Post ${id} not found`)
    const post = { ...posts.value[index], ...updates, updatedAt: new Date().toISOString() }
    if (updates.title) post.slug = generateSlug(updates.title)
    posts.value[index] = post
    saveToStorage(posts.value)
    return post
  }

  function deletePost(id) {
    const index = posts.value.findIndex((p) => p.id === id)
    if (index !== -1) {
      posts.value.splice(index, 1)
      saveToStorage(posts.value)
    }
  }

  function getPostById(id) {
    return posts.value.find((p) => p.id === id) ?? null
  }

  return { posts, createPost, updatePost, deletePost, getPostById }
})
