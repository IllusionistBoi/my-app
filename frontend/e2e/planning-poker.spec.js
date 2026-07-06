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
  test.setTimeout(60_000);
  const hostErrors = capturePageErrors(hostPage);
  let participantContext;
  let participantErrors = [];

  try {
    await hostPage.goto("/");
    await hostPage.locator("#create-name").fill("E2E Host");
    await hostPage.getByLabel("Name this tiny democracy").fill("Release confidence");
    await hostPage.getByRole("button", { name: "Deal a room" }).click();
    await expect(hostPage).toHaveURL(/\/session\/[A-Z0-9-]+$/);
    await expect(
      hostPage.getByRole("heading", { name: "Release confidence" }),
    ).toBeVisible();

    participantContext = await browser.newContext();
    const participantPage = await participantContext.newPage();
    participantErrors = capturePageErrors(participantPage);
    await participantPage.goto(hostPage.url());
    await expect(participantPage.locator(".welcome-intro")).toHaveCount(0);
    await expect(
      participantPage.getByRole("heading", {
        name: "Name yourself, mysterious estimator.",
      }),
    ).toBeVisible();
    await participantPage.getByLabel("Your name").fill("E2E Participant");
    await participantPage.getByRole("button", { name: "Enter the room" }).click();
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

    const revealButton = hostPage.getByRole("button", { name: "Flip the table" });
    await expect(revealButton).toBeEnabled();
    await revealButton.click();
    await expect(hostPage.locator(".reveal-burst")).toBeAttached();
    await expect(hostPage.locator(".reveal-burst span")).toHaveCount(0);

    await expect(
      hostPage.locator(".result-card").filter({ hasText: "e2e host" }),
    ).toContainText("5");
    await expect(
      hostPage.locator(".result-card").filter({ hasText: "e2e participant" }),
    ).toContainText("8");

    await hostPage.getByRole("button", { name: "Deal next round" }).click();
    await expect(hostPage.getByText("Round 2", { exact: false })).toBeVisible();
    await expect(
      participantPage.getByRole("button", { name: "8 points" }),
    ).toHaveAttribute("aria-pressed", "false");

    expect(hostErrors).toEqual([]);
    expect(participantErrors).toEqual([]);
  } finally {
    await participantContext?.close();
    if (hostPage.url().includes("/session/")) {
      const deleteRoom = hostPage.getByRole("button", { name: "Delete this room" });
      if ((await deleteRoom.count()) === 1) {
        hostPage.once("dialog", (dialog) => dialog.accept());
        await deleteRoom.click({ force: true });
        await expect(hostPage).toHaveURL("/");
      }
    }
  }
});

test("home and room-entry layouts do not overflow at 320px", async ({ page }) => {
  const pageErrors = capturePageErrors(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Call the bluff. Find the estimate.",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Secret-ish room code")).toBeAttached();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth === document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect(pageErrors).toEqual([]);
});

test("the homepage welcome completes cleanly and hands off to the teddy", async ({
  page,
}) => {
  test.setTimeout(15_000);
  await page.goto("/");

  await expect(page.locator(".welcome-intro")).toBeVisible();
  await expect(page.locator(".welcome-progress span")).toContainText("%");
  await expect(page.getByRole("button", { name: "Skip intro" })).toBeVisible();
  await expect(page.getByText("The table is yours.")).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.locator(".welcome-intro")).toHaveCount(0, {
    timeout: 6_000,
  });
  await expect(page.locator(".mascot-speech")).toContainText("Scout’s honour", {
    timeout: 2_500,
  });
  await expect(page.locator(".mascot-hint")).toHaveCount(0);
});

test("desktop composition stays aligned and the ticker loops without a gap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(page.locator(".welcome-intro")).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);

  await expect(page.getByText("Original Rive teddy")).toHaveCount(0);
  await expect(page.locator(".mascot-hint")).toHaveCount(0);
  await expect(page.locator(".mascot-speech")).toBeVisible();

  const [createBox, joinBox] = await Promise.all([
    page.locator(".entry-card-create").boundingBox(),
    page.locator(".entry-card-join").boundingBox(),
  ]);
  expect(Math.abs(createBox.y - joinBox.y)).toBeLessThan(2);
  expect(Math.abs(createBox.height - joinBox.height)).toBeLessThan(2);

  const tickerMetrics = await page.locator(".ticker").evaluate((ticker) => {
    const groups = [...ticker.querySelectorAll(".ticker-group")];
    return {
      groupCount: groups.length,
      groupWidths: groups.map((group) => group.getBoundingClientRect().width),
      trackWidth: ticker.querySelector(".ticker-track").getBoundingClientRect().width,
    };
  });
  expect(tickerMetrics.groupCount).toBe(2);
  expect(Math.abs(tickerMetrics.groupWidths[0] - tickerMetrics.groupWidths[1])).toBeLessThan(
    1,
  );
  expect(tickerMetrics.trackWidth).toBeGreaterThanOrEqual(
    tickerMetrics.groupWidths[0] * 2 - 1,
  );

  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  expect((await skipLink.boundingBox()).y).toBeLessThan(0);
  await page.keyboard.press("Tab");
  expect((await skipLink.boundingBox()).y).toBeGreaterThanOrEqual(0);
});

test("reduced motion keeps the design readable without perpetual movement", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.locator(".welcome-intro")).toHaveCount(0);
  await expect(page.locator(".mascot-stage")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Call the bluff. Find the estimate." }),
  ).toBeVisible();
  expect(
    await page.locator(".ticker-track").evaluate((element) => {
      return window.getComputedStyle(element).animationIterationCount;
    }),
  ).toBe("1");
});
