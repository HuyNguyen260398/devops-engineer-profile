import { ref } from 'vue'

// Jina Reader API converts any public URL to clean Markdown server-side.
// It supports browser CORS requests and requires no API key for basic use.
// Docs: https://jina.ai/reader/
const JINA_READER_BASE = 'https://r.jina.ai/'

export function useHtmlToMarkdown() {
  const url = ref('')
  const markdown = ref('')
  const isLoading = ref(false)
  const error = ref(null)

  function reset() {
    url.value = ''
    markdown.value = ''
    error.value = null
    isLoading.value = false
  }

  async function convert() {
    error.value = null
    markdown.value = ''

    // Validate URL
    try {
      const parsed = new URL(url.value)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error()
      }
    } catch {
      error.value = 'Please enter a valid URL (e.g. https://example.com).'
      return
    }

    isLoading.value = true

    try {
      const response = await fetch(`${JINA_READER_BASE}${url.value}`, {
        headers: { Accept: 'text/markdown' },
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        throw new Error(`The page could not be fetched (HTTP ${response.status}).`)
      }

      const text = await response.text()

      if (!text.trim()) {
        throw new Error('The page returned no readable content.')
      }

      markdown.value = text
    } catch (err) {
      if (err.name === 'TimeoutError') {
        error.value = 'Request timed out — the page took too long to respond.'
      } else if (err.name === 'TypeError') {
        error.value = 'Network error — check your internet connection and try again.'
      } else {
        error.value = err.message || 'An unexpected error occurred.'
      }
    } finally {
      isLoading.value = false
    }
  }

  function downloadMarkdown() {
    if (!markdown.value) return

    let filename = 'converted.md'
    try {
      const parsed = new URL(url.value)
      const segments = parsed.pathname.split('/').filter(Boolean)
      if (segments.length > 0) {
        filename = segments[segments.length - 1]
          .replace(/\.[^.]+$/, '')
          .replace(/[^a-z0-9-_]/gi, '-')
          .toLowerCase() + '.md'
      } else {
        filename = parsed.hostname.replace(/\./g, '-') + '.md'
      }
    } catch {
      // use default filename
    }

    const blob = new Blob([markdown.value], { type: 'text/markdown' })
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(objectUrl)
  }

  return { url, markdown, isLoading, error, convert, downloadMarkdown, reset }
}
