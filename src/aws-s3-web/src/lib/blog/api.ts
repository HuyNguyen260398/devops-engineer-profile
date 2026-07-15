export type PostStatus = "draft" | "published";

export interface PostInput {
  title: string;
  slug: string;
  excerpt: string;
  tags: string[];
  coverImage: string | null;
  status: PostStatus;
  body: unknown;
}

export interface PostMeta {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  coverImage: string | null;
  status: PostStatus;
  publishedAt: string | null;
  updatedAt: string;
}

export interface PostRecord extends PostMeta {
  body: unknown;
}

// Same-origin ("") in production; in local dev NEXT_PUBLIC_API_BASE points at
// the in-memory backend (e.g. http://localhost:3001).
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

async function req<T>(path: string, method: string, token?: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    // Surface the backend's error message (e.g. {"error":"title required"})
    // instead of an opaque status code, so validation failures are actionable.
    const detail = await res
      .json()
      .then((d: unknown) => (d && typeof (d as { error?: unknown }).error === "string" ? (d as { error: string }).error : ""))
      .catch(() => "");
    throw new Error(detail || `request failed: ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const listPosts = (token?: string) => req<PostMeta[]>("/posts", "GET", token);
// Drafts live behind a Cognito-required route; GET /posts is public and only ever
// returns published posts, so drafts must be fetched from /drafts with a token.
export const listDrafts = (token: string) => req<PostMeta[]>("/drafts", "GET", token);
export const getPost = (slug: string, token?: string) => req<PostRecord>(`/posts/${slug}`, "GET", token);
// Authenticated read used by the editor: returns a post of any status (incl.
// drafts), whereas the public getPost only resolves published posts.
export const getDraft = (slug: string, token: string) => req<PostRecord>(`/drafts/${slug}`, "GET", token);
export const createPost = (input: PostInput, token: string) => req<PostMeta>("/posts", "POST", token, input);
export const updatePost = (id: string, input: PostInput, token: string) =>
  req<PostMeta>(`/posts/${id}`, "PUT", token, input);
export const deletePost = (id: string, token: string) => req<void>(`/posts/${id}`, "DELETE", token);
export const presignUpload = (contentType: string, token: string) =>
  req<{ url: string; key: string }>("/uploads", "POST", token, { contentType });
