import { expect, test } from "@playwright/test";

test("editor preview opens a modal with the live content read-only", async ({ page }) => {
  await page.goto("/blogs/editor");

  await page.getByPlaceholder("Post title").fill("My Preview Title");

  await page.getByRole("button", { name: "preview", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { level: 1, name: "My Preview Title" })).toBeVisible();
  // The editing toolbar is not part of the read-only preview modal.
  await expect(dialog.getByRole("button", { name: "B", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "close preview" }).click();
  await expect(dialog).toHaveCount(0);
  // Back to editing — the toolbar is still available.
  await expect(page.getByRole("button", { name: "B", exact: true })).toBeVisible();
});
