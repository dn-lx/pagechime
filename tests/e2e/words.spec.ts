import { test, expect } from "@playwright/test";
import { bookTextHtml } from "../../apps/mobile/book-text-html";
import {
  paginateReading,
  readingAppearance,
} from "../../packages/core/src/reading";
const words = [
  { start: 0, end: 0.4, from: 0, to: 1 },
  { start: 0.6, end: 1.2, from: 2, to: 7 },
  { start: 1.4, end: 2, from: 8, to: 18 },
];
test("live audio highlights actual word intervals, pauses, seeks and preserves selection offsets", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "reader-test-corpus",
      value: "words",
      url: "http://localhost:4174",
    },
  ]);
  const u = await (await page.request.post("/__test/account")).json();
  await page.request.post("/api/reader/login", {
    headers: { Origin: "http://localhost:4174" },
    data: { username: u.username, password: u.password },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open book", exact: true }).click();
  // Observe in the browser so runner polling cannot skip this short real cue.
  const quietWord = page.waitForFunction(
    () => document.querySelector(".spoken-word")?.textContent === "quiet",
    undefined,
    { polling: "raf", timeout: 5000 },
  );
  await page
    .getByRole("button", { name: "Play narration", exact: true })
    .click();
  await quietWord;
  await page
    .getByRole("button", { name: "Pause narration", exact: true })
    .click();
  await page.getByLabel("Chapter playback position").fill("1.6");
  await expect(page.locator(".spoken-word")).toHaveText("beginning.");
  await page
    .locator('[data-word-from="2"]')
    .first()
    .evaluate((el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      const s = getSelection()!;
      s.removeAllRanges();
      s.addRange(r);
    });
  await page.locator(".ebook-paper").dispatchEvent("mouseup");
  await expect(
    page.getByRole("region", { name: "Selected quotation" }),
  ).toContainText("quiet");
  await page.getByLabel("Chapter playback position").fill("0.5");
  await expect(page.locator(".spoken-word")).toHaveCount(0);
  expect(await page.evaluate(() => getSelection()?.toString())).toBe("quiet");
});
test("native word messages update spans without replacing text or clearing selection", async ({
  page,
}) => {
  const segments = [
    { start: 0, end: 4, page: 1, text: "A quiet beginning.", words },
  ];
  const html = bookTextHtml(
    paginateReading(segments, 180)[0],
    "Words",
    0,
    true,
    readingAppearance(null),
    [],
    0,
    {
      paper: "#fff",
      ink: "#222",
      muted: "#555",
      line: "#ddd",
      accent: "#65704f",
      highlight: "#f4e5ab",
      soft: "#e9eddf",
    },
    "word-fixture",
    segments,
  );
  await page.route("**/__test/native-words", (r) =>
    r.fulfill({ contentType: "text/html", body: html }),
  );
  await page.goto("/__test/native-words");
  await page.locator('[data-word-from="2"]').evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(r);
  });
  await page.evaluate(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          type: "narration",
          context: "word-fixture",
          segment: 0,
          from: 8,
        }),
      }),
    ),
  );
  await expect(page.locator(".spoken-word")).toHaveText("beginning.");
  expect(await page.evaluate(() => getSelection()?.toString())).toBe("quiet");
  await page.evaluate(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          type: "narration",
          context: "wrong",
          segment: 0,
          from: 0,
        }),
      }),
    ),
  );
  await expect(page.locator(".spoken-word")).toHaveText("beginning.");
});
test("mixed-cue chapters keep following a long uncued passage without invented word highlighting", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "reader-test-corpus",
      value: "mixedwords",
      url: "http://localhost:4174",
    },
  ]);
  const u = await (await page.request.post("/__test/account")).json();
  await page.request.post("/api/reader/login", {
    headers: { Origin: "http://localhost:4174" },
    data: { username: u.username, password: u.password },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open book", exact: true }).click();
  await page.getByLabel("Chapter playback position").fill("4.2");
  await page
    .getByRole("button", { name: "Play narration", exact: true })
    .click();
  const passage = page.locator('[data-fragment][data-segment="1"]').first();
  await expect(passage).toBeVisible();
  const first = Number(await passage.getAttribute("data-start"));
  await expect
    .poll(async () => Number(await passage.getAttribute("data-start")), {
      timeout: 3500,
    })
    .toBeGreaterThan(first);
  await expect(page.locator(".spoken-word")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Pause narration", exact: true })
    .click();
});

test.describe("seeking while audio metadata loads", () => {
  // Intercept the real media response so the seek is guaranteed to happen first.
  test.use({ serviceWorkers: "block" });
  test("keeps the reader's selected position when metadata arrives", async ({
    page,
  }) => {
    let releaseAudio!: () => void;
    const audioGate = new Promise<void>((resolve) => {
      releaseAudio = resolve;
    });
    await page.route("**/books/demo/1.wav", async (route) => {
      await audioGate;
      await route.continue();
    });
    const u = await (await page.request.post("/__test/account")).json();
    await page.request.post("/api/reader/login", {
      headers: { Origin: "http://localhost:4174" },
      data: { username: u.username, password: u.password },
    });
    try {
      await page.goto("/");
      await page
        .getByRole("button", { name: "Open book", exact: true })
        .click();
      const position = page.getByLabel("Chapter playback position");
      await position.fill("4.2");
      await expect(position).toHaveValue("4.2");
      releaseAudio();
      const play = page.getByRole("button", {
        name: "Play narration",
        exact: true,
      });
      await expect(play).not.toHaveClass(/is-loading/);
      await expect(position).toHaveValue("4.2");
      await play.click();
      await expect
        .poll(async () => Number(await position.inputValue()))
        .toBeGreaterThan(4.3);
      await page
        .getByRole("button", { name: "Pause narration", exact: true })
        .click();
    } finally {
      releaseAudio();
    }
  });
});
