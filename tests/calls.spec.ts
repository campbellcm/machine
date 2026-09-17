import { test, expect } from "@playwright/test";

test("call themes, redacted evidence and review invalidation", async ({
  page,
}) => {
  await page.goto("/demo/calls");
  await expect(
    page.getByRole("heading", {
      name: "Your best ideas are already on the call.",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review sample source excerpts" })
    .click();
  await expect(page.locator(".call-excerpts")).toContainText(
    "[commercial amount removed]",
  );
  await expect(page.locator(".call-excerpts")).not.toContainText(
    "Northstar Labs",
  );
  await page
    .getByRole("button", { name: "Build sample draft" })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Copy reviewed draft" }),
  ).toBeDisabled();
  await page
    .getByLabel("I reviewed the sample facts", { exact: false })
    .check();
  await page.getByLabel("I checked for identifying", { exact: false }).check();
  await page.getByRole("button", { name: "Mark sample reviewed" }).click();
  await expect(
    page.getByRole("button", { name: "Copy reviewed draft" }),
  ).toBeEnabled();
  await page
    .getByRole("textbox", { name: "Edit your sample post" })
    .fill("I work at Acme. Northstar Labs has a problem.");
  await expect(
    page.getByRole("button", { name: "Copy reviewed draft" }),
  ).toBeDisabled();
  await expect(page.getByLabel("Draft issues")).toContainText(
    "known identifying detail",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("deselecting every call removes themes and prior draft", async ({
  page,
}) => {
  await page.goto("/demo/calls");
  await page
    .getByRole("button", { name: "Build sample draft" })
    .first()
    .click();
  for (const checkbox of await page.locator(".sample-call input").all())
    await checkbox.uncheck();
  await expect(
    page.getByRole("heading", { name: "Start with a conversation." }),
  ).toBeVisible();
  await expect(page.locator(".call-draft")).toHaveCount(0);
});
