import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("overview, reporting period and accessible layout", async ({ page }) => {
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "Good things start with a story." }),
  ).toBeVisible();
  const metrics = page.getByRole("region", { name: "Team metrics" });
  await expect(metrics).toContainText("24");
  await page
    .getByRole("combobox", { name: "Reporting period" })
    .selectOption("all");
  await expect(metrics).toContainText("30");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
test("content filters, modal keyboard behavior and no-results state", async ({
  page,
}) => {
  await page.goto("/demo/content");
  await page.getByRole("button", { name: "Drafts 6", exact: true }).click();
  await expect(page.locator(".content-card")).toHaveCount(6);
  await page.locator(".content-card button").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByLabel("Search posts").fill("no such story");
  await expect(page.getByText("No matching stories.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".content-card")).toHaveCount(38);
});
test("team search, idea interaction, themes and roadmap navigation", async ({
  page,
}) => {
  await page.goto("/demo/team");
  await page.getByLabel("Search teammates").fill("Sarah");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("Sarah Chen");
  await page.getByRole("link", { name: "Ideas", exact: true }).click();
  await page
    .getByRole("button", { name: "Explore this prompt" })
    .first()
    .click();
  await expect(page.getByText("Think of a specific moment.")).toBeVisible();
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("link", { name: "Foundation preview" }).click();
  await expect(
    page.getByRole("heading", { name: "From a foundation to a first story." }),
  ).toBeVisible();
});
test("settings and content are accessible in dark mode", async ({ page }) => {
  for (const route of ["settings", "content", "ideas", "team", "roadmap"]) {
    await page.goto(`/demo/${route}`);
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations, route).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      route,
    ).toBe(true);
  }
});
