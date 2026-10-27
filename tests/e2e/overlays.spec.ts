import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function guest(page: Page, read = true) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Continue as guest", exact: true })
    .click();
  const open = page.getByRole("button", { name: "Open book", exact: true });
  await expect(open).toBeVisible();
  if (read) {
    await open.click();
    await expect(
      page.getByRole("article", { name: "Book text" }),
    ).toBeVisible();
  }
}

test("appearance closes explicitly and by outside tap or Escape, retaining changes and focus", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await guest(page);
  const position = page.getByLabel("Chapter playback position");
  await position.fill("3");
  const trigger = page.getByRole("button", {
    name: "Reading appearance",
    exact: true,
  });
  const dialog = page.getByRole("dialog", {
    name: "Make yourself comfortable.",
  });
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close reading appearance" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Larger text", exact: true }).click();
  const size = await page.getByLabel("Reading text size").innerText();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(position).toHaveValue("3");
  await trigger.click();
  await expect(page.getByLabel("Reading text size")).toHaveText(size);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.mouse.click(3, 3);
  await expect(dialog).toHaveCount(0);
  await trigger.click();
  await page.getByRole("button", { name: "Night", exact: true }).click();
  await page.screenshot({ path: info.outputPath("appearance-night.png") });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Close reading appearance", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await position.fill("1");
  await page
    .getByRole("button", { name: "Play narration", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause narration", exact: true }),
  ).toBeVisible();
  await trigger.click();
  const before = Number(await position.inputValue());
  await expect
    .poll(async () => Number(await position.inputValue()))
    .toBeGreaterThan(before);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Pause narration", exact: true })
    .click();
  expect(errors).toEqual([]);
});

test("dialog padding and an inside-to-outside gesture do not dismiss a card", async ({
  page,
}) => {
  await guest(page, false);
  await page.getByRole("button", { name: "Reading help", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "A little reading room" });
  await expect(dialog).toBeVisible();
  await dialog.click({ position: { x: 5, y: 5 } });
  await expect(dialog).toBeVisible();
  const bounds = (await dialog.boundingBox())!;
  await page.mouse.move(bounds.x + 40, bounds.y + 100);
  await page.mouse.down();
  await page.mouse.move(3, 3);
  await page.mouse.up();
  await expect(dialog).toBeVisible();
  await page.mouse.click(3, 3);
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Reading help", exact: true }),
  ).toBeFocused();
});

test("short-screen settings scroll while Close and Done remain reachable", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await guest(page);
  await page
    .getByRole("button", { name: "Reading appearance", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Make yourself comfortable.",
  });
  await page.getByRole("button", { name: "Sepia", exact: true }).click();
  for (const name of ["Close reading appearance", "Done"]) {
    const button = dialog.getByRole("button", { name, exact: true });
    const bounds = (await button.boundingBox())!;
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(480);
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("appearance-short-screen.png"),
  });
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".ebook-reader")).toHaveAttribute(
    "data-surface",
    "sepia",
  );
});

test("Escape closes settings before leaving fallback fullscreen", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new DOMException("Unavailable", "NotAllowedError"));
  });
  await guest(page);
  await page
    .getByRole("button", { name: "Enter fullscreen", exact: true })
    .click();
  await expect(page.locator("body")).toHaveClass(/focus-reading/);
  await page
    .getByRole("button", { name: "Reading appearance", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("body")).toHaveClass(/focus-reading/);
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveClass(/focus-reading/);
});

test("mobile library traps focus, closes with Escape and hands off to one dialog", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await guest(page);
  await expect(page.locator("aside.sidebar")).toHaveCount(0);
  const opener = page.getByRole("button", {
    name: "Open library menu",
    exact: true,
  });
  await opener.click();
  const drawer = page.getByRole("dialog", {
    name: "Your library",
    exact: true,
  });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "Bookmarks", exact: true }).click();
  await drawer.getByRole("button", { name: "Contents", exact: true }).click();
  await expect(
    drawer.getByRole("navigation", { name: "Book chapters" }),
  ).toBeVisible();
  await expect(opener).toHaveAttribute("aria-expanded", "true");
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press("Tab");
    expect(
      await drawer.evaluate((d) => d.contains(document.activeElement)),
    ).toBe(true);
  }
  const closeBounds = (await drawer
    .getByRole("button", { name: "Close library menu", exact: true })
    .boundingBox())!;
  expect(closeBounds.y).toBeGreaterThanOrEqual(0);
  expect(closeBounds.y + closeBounds.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: info.outputPath("mobile-library.png") });
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.click();
  await page.getByRole("button", { name: /Find a passage/ }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    page.getByRole("dialog", { name: "Find a passage", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(opener).toBeFocused();
  await opener.click();
  await page
    .getByRole("button", { name: "Close library menu", exact: true })
    .click();
  await expect(drawer).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator("aside.sidebar")).toBeVisible();
});
