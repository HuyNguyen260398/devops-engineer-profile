import { getIdToken } from "@/lib/blog/auth";
import { presignUpload } from "@/lib/blog/api";

// Uploads a file to the media bucket via a presigned PUT and returns its
// same-origin path (served through CloudFront /media/*). Shared by the editor
// toolbar (in-body images) and the cover-image picker.
export async function uploadImage(file: File): Promise<string> {
  const token = await getIdToken();
  if (!token) throw new Error("not authenticated");
  const { url, key } = await presignUpload(file.type, token);
  const put = await fetch(url, {
    method: "PUT",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!put.ok) throw new Error("upload failed");
  return `/${key}`;
}
