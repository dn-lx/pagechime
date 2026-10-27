import { test, expect } from "@playwright/test";
import { bookTextHtml } from "../../apps/mobile/book-text-html";
import {
  paginateReading,
  readingAppearance,
} from "../../packages/core/src/reading";
import fixture from "../fixtures/book.json";

test("native text bridge reports exact selected words and document identity with escaped markup", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const context = "demo:</script>:0";
  const html = bookTextHtml(
    paginateReading(fixture.chapters[0].segments, 180)[0],
    "<img src=x onerror=alert(1)> · Café 🌿",
    0,
    true,
    readingAppearance(null),
    [],
    0,
    {
      paper: "#fffefb",
      ink: "#292e24",
      muted: "#5c6254",
      line: "#ddded2",
      accent: "#65704f",
      highlight: "#f4e5ab",
      soft: "#e9eddf",
    },
    context,
  );
  await page.addInitScript(() => {
    (window as any).messages = [];
    (window as any).ReactNativeWebView = {
      postMessage: (message: string) =>
        (window as any).messages.push(JSON.parse(message)),
    };
  });
  // Serve the static native document on the local fixture origin.
  await page.route("**/__test/native-text", (route) =>
    route.fulfill({ contentType: "text/html", body: html }),
  );
  await page.goto("/__test/native-text");
  await expect(page.locator("h1")).toHaveText(
    "<img src=x onerror=alert(1)> · Café 🌿",
  );
  await expect(page.locator("img")).toHaveCount(0);
  await page.locator("[data-listen]").first().click();
  await page
    .locator("[data-fragment]")
    .first()
    .evaluate((el) => {
      const range = document.createRange();
      range.setStart(el.firstChild!, 2);
      range.setEnd(el.firstChild!, 14);
      const selection = getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).messages.filter((m: any) => m.type === "selection")
            .length,
      ),
    )
    .toBeGreaterThan(0);
  const messages = await page.evaluate(() => (window as any).messages);
  expect(messages.find((m: any) => m.type === "listen")).toEqual({
    type: "listen",
    segment: 0,
    context,
  });
  expect(messages.find((m: any) => m.type === "selection")).toEqual({
    type: "selection",
    quote: fixture.chapters[0].segments[0].text.slice(2, 14).trim(),
    segment: 0,
    offset: 2,
    endSegment: 0,
    endOffset: 14,
    context,
  });
  await page
    .locator("[data-fragment]")
    .first()
    .evaluate((el) => {
      const last = document.querySelectorAll("[data-fragment]")[1];
      const range = document.createRange();
      range.setStart(el.firstChild!, 2);
      range.setEnd(last.firstChild!, 7);
      const selection = getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).messages
            .filter((m: any) => m.type === "selection")
            .at(-1)?.endSegment,
      ),
    )
    .toBe(1);
  const across = await page.evaluate(() =>
    (window as any).messages.filter((m: any) => m.type === "selection").at(-1),
  );
  expect(across.quote.replace(/\s+/g, " ")).toBe(
    (
      fixture.chapters[0].segments[0].text.slice(2) +
      " " +
      fixture.chapters[0].segments[1].text.slice(0, 7)
    ).trim(),
  );
  expect(errors).toEqual([]);
});
