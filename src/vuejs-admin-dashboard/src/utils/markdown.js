import { marked } from 'marked'

// Configure marked with safe defaults
marked.setOptions({
  gfm: true,
  breaks: true,
})

/**
 * Parse a markdown string and return sanitized HTML.
 * Note: this does basic escaping — for production use DOMPurify.
 */
export function parseMarkdown(source) {
  if (!source) return ''
  // Basic XSS mitigation: strip <script> tags before parsing
  const sanitized = source.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  return marked.parse(sanitized)
}
