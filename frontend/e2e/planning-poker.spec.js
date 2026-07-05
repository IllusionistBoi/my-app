import { expect, test } from "@playwright/test";

function capturePageErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  return errors;
}

test("two participants keep votes private until the host reveals", async ({
  browser,
  page: hostPage,
}) => {
  const hostErrors = capturePageErrors(hostPage);
  await hostPage.goto("/");
  await hostPage.locator("#create-name").fill("E2E Host");
  await hostPage.getByLabel("Room name").fill("Release confidence");
  await hostPage.getByRole("button", { name: "Create room" }).click();
  await expect(hostPage).toHaveURL(/\/session\/[A-Z0-9-]+$/);
  await expect(
    hostPage.getByRole("heading", { name: "Release confidence" }),
  ).toBeVisible();

  const participantContext = await browser.newContext();
  const participantPage = await participantContext.newPage();
  const participantErrors = capturePageErrors(participantPage);
  await participantPage.goto(hostPage.url());
  await expect(
    participantPage.getByRole("heading", { name: "Introduce yourself to join." }),
  ).toBeVisible();
  await participantPage.getByLabel("Your name").fill("E2E Participant");
  await participantPage.getByRole("button", { name: "Join room" }).click();
  await expect(
    participantPage.getByRole("heading", { name: "Release confidence" }),
  ).toBeVisible();

  await hostPage.getByRole("button", { name: "5 points" }).click();
  await participantPage.getByRole("button", { name: "8 points" }).click();

  const participantRow = hostPage
    .locator(".participant-card")
    .filter({ hasText: "e2e participant" });
  await expect(participantRow).toContainText("Vote locked in");
  await expect(participantRow).not.toContainText("Voted 8");

  const revealButton = hostPage.getByRole("button", { name: "Reveal cards" });
  await expect(revealButton).toBeEnabled();
  await revealButton.click();

  await expect(
    hostPage.locator(".result-card").filter({ hasText: "e2e host" }),
  ).toContainText("5");
  await expect(
    hostPage.locator(".result-card").filter({ hasText: "e2e participant" }),
  ).toContainText("8");

  await hostPage.getByRole("button", { name: "Start next round" }).click();
  await expect(hostPage.getByText("Round 2", { exact: false })).toBeVisible();
  await expect(
    participantPage.getByRole("button", { name: "8 points" }),
  ).toHaveAttribute("aria-pressed", "false");

  await participantContext.close();
  hostPage.once("dialog", (dialog) => dialog.accept());
  await hostPage.getByRole("button", { name: "Delete this room" }).click();
  await expect(hostPage).toHaveURL("/");
  expect(hostErrors).toEqual([]);
  expect(participantErrors).toEqual([]);
});

test("home and room-entry layouts do not overflow at 320px", async ({ page }) => {
  const pageErrors = capturePageErrors(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Plan together without anchoring the room.",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Room code")).toBeAttached();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth === document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect(pageErrors).toEqual([]);
});
