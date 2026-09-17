import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("four tabs, date filters, leaderboard and channel feed", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "Your team, in the spotlight." }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }).getByRole("link"),
  ).toHaveText(["Home", "Team", "Rewards", "AI"]);
  await expect(page.locator(".v1-post")).toHaveCount(24);
  await page.getByLabel("Feed channel").selectOption("x");
  await expect(page.locator(".v1-post")).toHaveCount(8);
  await page.getByLabel("From", { exact: true }).fill("2026-08-01");
  await page.getByRole("button", { name: "Apply dates" }).click();
  await page.getByLabel("Feed channel").selectOption("all");
  await expect(page.locator(".v1-post")).toHaveCount(30);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
test("team search and sample daily routine", async ({ page }) => {
  await page.goto("/demo/team");
  await page.getByLabel("Find a teammate").fill("Sarah");
  await expect(page.getByRole("list", { name: "Team members" }).getByRole("listitem")).toHaveCount(1);
  await page.getByRole("link", { name: "AI", exact: true }).click();
  await page.getByRole("button", { name: "Try sample routine" }).click();
  await expect(page.getByText("Sample routine on")).toBeVisible();
  await page
    .getByRole("button", { name: "Preview three draft options" })
    .click();
  await expect(page.getByRole("textbox", { name: /Sample draft/ })).toHaveCount(
    3,
  );
  await page.getByRole("button", { name: "Pause sample routine" }).click();
  await expect(page.getByText("Sample routine on")).toHaveCount(0);
});
test("sample reward creation", async ({ page }) => {
  await page.goto("/demo/rewards");
  await page.getByRole("button", { name: "Create sample reward" }).click();
  await page.getByLabel("Title", { exact: true }).fill("October creativity");
  await page.getByLabel("What’s the prize?").fill("A team lunch");
  await page.getByRole("button", { name: "Save sample reward" }).click();
  await expect(
    page.getByRole("heading", { name: "October creativity" }),
  ).toBeVisible();
});
test("four tabs are accessible in dark mode", async ({ page }) => {
  for (const route of ["", "team", "rewards", "ai"]) {
    await page.goto("/demo/" + route);
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
      route,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBe(true);
  }
});
