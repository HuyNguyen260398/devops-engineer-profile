export type PostStatus = "draft" | "published";

export interface PostInput {
  title: string;
  slug: string;
  excerpt: string;
  tags: string[];
  coverImage: string | null;
  status: PostStatus;
  body: unknown; // ProseMirror JSON document
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
