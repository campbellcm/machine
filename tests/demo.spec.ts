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
  await expect(page.locator(".v1-post")).toHaveCount(6);
  await page
    .getByRole("button", { name: /See more of/ })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: /See less of/ }).first(),
  ).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Show more posts" }).click();
  await expect(page.locator(".v1-post")).toHaveCount(12);
  await page.getByLabel("Feed channel").selectOption("x");
  await expect(page.locator(".v1-post")).toHaveCount(6);
  await page.getByLabel("From", { exact: true }).fill("2026-08-01");
  await page.getByRole("button", { name: "Apply dates" }).click();
  await page.getByLabel("Feed channel").selectOption("all");
  await expect(page.locator(".v1-post")).toHaveCount(6);
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
  await expect(
    page.getByRole("list", { name: "Team members" }).getByRole("listitem"),
  ).toHaveCount(1);
  await page.getByRole("link", { name: "AI", exact: true }).click();
  await page
    .getByRole("button", { name: "Content preferences", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Today’s post" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Approve post", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm approval", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Copy approved post", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Preview as").selectOption("engineering");
  await expect(page.getByText(/technical/).first()).toBeVisible();
  await page.getByRole("button", { name: "My Profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Pause preparation", exact: true })
    .click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your content is paused." }),
  ).toBeVisible();
});
test("sample reward creation", async ({ page }) => {
  await page.goto("/demo/rewards");
  await expect(
    page.getByRole("heading", { name: "$1,000", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "MacBook Pro", exact: true }),
  ).toBeVisible();
  const reward = page.locator(".reward-row").first();
  await expect(reward.getByRole("listitem")).toHaveCount(3);
  await reward.getByText("See all 12 participants").click();
  await expect(reward.getByRole("listitem")).toHaveCount(12);
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

test("AI company review returns final approval to the employee", async ({
  page,
}) => {
  await page.goto("/demo/ai");
  await page
    .getByRole("button", { name: "Company settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Content Strategy", exact: true })
    .click();
  await page
    .getByLabel("Require company review before an employee’s final approval")
    .check();
  await page
    .getByRole("button", { name: "Save controls", exact: true })
    .click();
  await page.getByRole("button", { name: "My content", exact: true }).click();
  await page.getByRole("button", { name: "Approve post", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm approval", exact: true })
    .click();
  await expect(
    page.getByText("With your reviewer", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "AI administration", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Return for final approval", exact: true })
    .click();
  await page.getByRole("button", { name: "My content", exact: true }).click();
  await page.getByRole("button", { name: "Approve post", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm approval", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Copy approved post", exact: true }),
  ).toBeVisible();
});

test("simple AI preferences save quantity and label unavailable delivery honestly", async ({
  page,
}) => {
  await page.goto("/demo/ai");
  await expect(
    page.getByRole("heading", {
      name: "Let AI create your content.",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Make my content", exact: true })
    .click();
  await expect(page.getByLabel("Drafts per day").locator("option")).toHaveCount(
    10,
  );
  await page.getByLabel("Drafts per day").selectOption("10");
  await page.getByRole("button", { name: "Slack", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Slack", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByText(
      "Slack delivery is not connected yet. Your drafts will be available here in the app.",
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Make my content", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("10 drafts per day");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Your drafts", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "Your drafts", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "← Daily drafts", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Make my content", exact: true })
    .click();
  await expect(page.getByLabel("Drafts per day")).toHaveValue("10");
});

test("AI composer shows an honest sample response and preserves author review", async ({
  page,
}) => {
  await page.goto("/demo/ai");
  const send = page.getByRole("button", { name: "Draft my post", exact: true });
  await expect(send).toBeDisabled();
  await expect(
    page.getByPlaceholder("Give me a topic and I’ll draft a post for you"),
  ).toBeVisible();
  await page
    .getByLabel("Post topic", { exact: true })
    .fill("How to make project handoffs clearer");
  await send.click();
  await expect(
    page.getByText("Sample response", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/This is a prepared example, not an AI response/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review this draft", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Post topic", { exact: true })).toHaveValue("");
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
  await page
    .getByRole("button", { name: "Review this draft", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your drafts", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy approved post", exact: true }),
  ).toHaveCount(0);
});
