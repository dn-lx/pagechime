import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { longBook, repairedBook } from "../fixtures/reading-books";
async function login(
  page: Page,
  corpus?: "long" | "mixed" | "untimed" | "editions" | "repaired",
) {
  if (corpus)
    await page.context().addCookies([
      {
        name: "reader-test-corpus",
        value: corpus,
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
  if (corpus !== "untimed")
    await expect(
      page.getByRole("article", { name: "Book text" }),
    ).toBeVisible();
}
async function savedAnchor(page: Page) {
  return page.evaluate(() => {
    const id = JSON.parse(localStorage.getItem("leaf.reader.session")!).account
      .id;
    return JSON.parse(localStorage.getItem(`leaf.account.${id}.progress.demo`)!)
      .reading;
  });
}
async function selectParagraph(page: Page) {
  await page
    .locator("[data-fragment]")
    .first()
    .evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const s = window.getSelection()!;
      s.removeAllRanges();
      s.addRange(range);
    });
  await page.locator(".ebook-paper").dispatchEvent("mouseup");
  await expect(
    page.getByRole("region", { name: "Selected quotation" }),
  ).toBeVisible();
}
test("repaired reading joins words and saves corrected quotations at original source offsets", async ({
  page,
}) => {
  await login(page, "repaired");
  await expect(page.locator(".ebook-passage").first()).toContainText(
    "A meaningful moment. We can walk home safely.",
  );
  const passage = page.locator('[data-fragment][data-segment="1"]');
  await passage.evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const start = node.textContent!.indexOf("home safely");
      if (start < 0) continue;
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + "home safely".length);
      const selection = getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      break;
    }
  });
  await page.locator(".ebook-paper").dispatchEvent("mouseup");
  await page.getByRole("button", { name: "Highlight", exact: true }).click();
  await expect(page.locator(".ebook-prose mark")).toHaveText("home safely");
  const from = repairedBook.chapters[0].segments[1].text.indexOf("home safely");
  await expect
    .poll(async () => {
      const account = await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("leaf.reader.session")!).account.id,
      );
      const state = await (
        await page.request.get("/api/reader/state", {
          headers: { "X-Reader-Account": account },
        })
      ).json();
      const note = state.items.find((item: any) =>
        item.key.startsWith("note."),
      )?.value;
      return note && [note.segment, note.offset, note.endOffset];
    })
    .toEqual([1, from, from + "home safely".length]);
  await page.reload();
  await page
    .getByRole("button", { name: "Continue reading", exact: true })
    .click();
  await expect(page.locator(".ebook-prose mark")).toHaveText("home safely");
});
test("reading pages preserve all text and move across chapter boundaries without opening PDF", async ({
  page,
}) => {
  await login(page, "long");
  await expect(page.locator("[data-fragment]").first()).toContainText(
    "Moment 1.",
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const all: string[] = [];
  let count = 0;
  do {
    all.push(...(await page.locator("[data-fragment]").allTextContents()));
    count++;
    await page
      .getByRole("button", { name: "Next reading page", exact: true })
      .click();
  } while (
    (await page.locator(".ebook-heading").innerText()).includes(
      "Chapter 1 of 2",
    ) &&
    count < 60
  );
  expect(count).toBeGreaterThan(1);
  expect(all.join("")).toBe(
    longBook.chapters[0].segments.map((s) => s.text).join(""),
  );
  await expect(
    page.getByRole("heading", { name: "The next page", exact: true }),
  ).toBeVisible();
  // Browsing into another text chapter must leave the narrator where it was.
  await expect(page.getByLabel("Chapter playback position")).toHaveValue("0");
  await expect(
    page.getByRole("button", { name: "Previous audio chapter", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Previous reading page", exact: true })
    .click();
  await expect(page.locator(".ebook-heading")).toContainText("Chapter 1 of 2");
  const last = page.locator("[data-fragment]").last();
  await expect(last).toHaveAttribute(
    "data-segment",
    String(longBook.chapters[0].segments.length - 1),
  );
  const suffix = await last.textContent();
  expect(suffix?.length).toBeGreaterThan(0);
  expect(longBook.chapters[0].segments.at(-1)!.text.endsWith(suffix!)).toBe(
    true,
  );
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Follow audio", exact: true }).click();
  await expect(page.locator(".ebook-heading")).toContainText("Chapter 1 of 2");
  await expect(page.locator("[data-fragment]").first()).toContainText(
    "Moment 1.",
  );
  expect(errors).toEqual([]);
});
test("reading place survives reflow, audio saves and reload; appearance is accessible", async ({
  page,
}, info) => {
  await login(page, "long");
  await page
    .getByRole("button", { name: "Next reading page", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Next reading page", exact: true })
    .click();
  const anchor = await savedAnchor(page);
  expect(anchor.offset).toBeGreaterThan(0);
  await page.getByLabel("Reading appearance", { exact: true }).click();
  await page.getByRole("button", { name: "Larger text", exact: true }).click();
  await page.getByRole("button", { name: "Clean sans", exact: true }).click();
  await page.getByRole("button", { name: "Airy", exact: true }).click();
  await page.getByRole("button", { name: "Sepia", exact: true }).click();
  await expect(page.locator(".ebook-reader")).toHaveAttribute(
    "data-surface",
    "sepia",
  );
  expect(await savedAnchor(page)).toEqual(anchor);
  const a = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(a.violations).toEqual([]);
  await page
    .getByRole("button", { name: "Close reading appearance", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Play narration", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause narration", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.getByLabel("Chapter playback position").inputValue())
    .not.toBe("0");
  await page
    .getByRole("button", { name: "Pause narration", exact: true })
    .click();
  expect(await savedAnchor(page)).toEqual(anchor);
  // A new device has the synced reading anchor but no local follow preference.
  await page.evaluate(() => {
    const id = JSON.parse(localStorage.getItem("leaf.reader.session")!).account
      .id;
    localStorage.removeItem(`leaf.account.${id}.follow.demo`);
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Continue reading", exact: true })
    .click();
  expect(await savedAnchor(page)).toEqual(anchor);
  await expect(
    page.getByRole("button", { name: "Follow audio", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(
    await page
      .locator("[data-fragment]")
      .evaluateAll(
        (fragments, a) =>
          fragments.some(
            (el) =>
              Number((el as HTMLElement).dataset.segment) === a.segment &&
              Number((el as HTMLElement).dataset.start) <= a.offset &&
              Number((el as HTMLElement).dataset.start) +
                (el.textContent?.length || 0) >
                a.offset,
          ),
        anchor,
      ),
  ).toBe(true);
  await expect(page.locator(".ebook-prose")).toHaveClass(/font-sans/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("ebook-sepia.png"),
    fullPage: true,
  });
});
test("audio advancing to the next chapter preserves a manual reading page until following resumes", async ({
  page,
}) => {
  await login(page, "long");
  await page
    .getByRole("button", { name: "Next reading page", exact: true })
    .click();
  const anchor = await savedAnchor(page);
  await page.getByLabel("Chapter playback position").evaluate((el) => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    setter.call(el, 7.8);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page
    .getByRole("button", { name: "Play narration", exact: true })
    .click();
  await expect(page.locator(".player-book")).toContainText("The next page");
  await expect(page.locator(".ebook-heading")).toContainText("Chapter 1 of 2");
  expect(await savedAnchor(page)).toEqual(anchor);
  await page.getByRole("button", { name: "Follow audio", exact: true }).click();
  await expect(page.locator(".ebook-heading")).toContainText("Chapter 2 of 2");
  await page
    .getByRole("button", { name: "Pause narration", exact: true })
    .click();
});
test("untimed books retain manual PDF position after reopening", async ({
  page,
}) => {
  await login(page, "untimed");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByLabel("PDF page number").fill("2");
  await expect(page.getByLabel("PDF page number")).toHaveValue("2");
  await page.reload();
  await page
    .getByRole("button", { name: "Continue reading", exact: true })
    .click();
  await expect(page.getByLabel("PDF page number")).toHaveValue("2");
  await expect(page.locator("canvas")).toBeVisible();
});
test("a chapter without timed text opens its source PDF page without seeking the audio", async ({
  page,
}) => {
  await login(page, "mixed");
  await page
    .getByRole("button", { name: "Next reading page", exact: true })
    .click();
  await expect(page.getByLabel("PDF page number")).toHaveValue("2");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Previous audio chapter", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Chapter playback position")).toHaveValue("0");
});
test("selected quotations become private highlights and notes and reopen at their text location", async ({
  page,
}, info) => {
  await login(page);
  await selectParagraph(page);
  await page.getByRole("button", { name: "Highlight", exact: true }).click();
  await expect(page.locator(".ebook-prose mark")).toContainText(
    "A quiet beginning.",
  );
  await selectParagraph(page);
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("A quiet beginning.");
  await page
    .getByLabel("Your note", { exact: true })
    .fill("A thought attached to this sentence.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.locator(".notes-list")).toContainText(
    "A thought attached to this sentence.",
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Continue reading", exact: true })
    .click();
  await expect(page.locator(".ebook-prose mark")).toContainText(
    "A quiet beginning.",
  );
  await page.getByRole("button", { name: "Make a note", exact: true }).click();
  await expect(page.locator(".notes-list")).toContainText(
    "A thought attached to this sentence.",
  );
  await page
    .getByRole("button", { name: "Open page", exact: true })
    .last()
    .click();
  await expect(page.getByRole("article", { name: "Book text" })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("ebook-highlight.png"),
    fullPage: true,
  });
});

test("PDF edition survives chapter changes and reload; unlisted saved addresses fall back safely", async ({
  page,
}) => {
  await login(page, "editions");
  await page.getByRole("button", { name: "Original PDF", exact: true }).click();
  await page.getByLabel("PDF edition").selectOption({ label: "Cozy PDF" });
  await expect(page.locator(".pdf-loading")).toHaveCount(0);
  await page.getByRole("button", { name: "Next audio chapter" }).click();
  await expect(page.getByLabel("PDF edition")).toHaveValue(
    "/books/demo/cozy.pdf",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Continue reading", exact: true })
    .click();
  await expect(page.getByLabel("PDF edition")).toHaveValue(
    "/books/demo/cozy.pdf",
  );
  const outside: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith("https://unlisted.invalid/"))
      outside.push(request.url());
  });
  await page.evaluate(() => {
    const id = JSON.parse(localStorage.getItem("leaf.reader.session")!).account
      .id;
    localStorage.setItem(
      `leaf.account.${id}.pdf.edition.demo`,
      JSON.stringify("https://unlisted.invalid/private.pdf"),
    );
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Continue reading", exact: true })
    .click();
  await expect(page.getByLabel("PDF edition")).toHaveValue(
    "/books/demo/book.pdf",
  );
  await expect(page.locator(".pdf-loading")).toHaveCount(0);
  expect(outside).toEqual([]);
});
