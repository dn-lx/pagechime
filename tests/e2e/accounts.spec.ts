import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const origin = "http://localhost:4174";
async function user(page: Page) {
  return (await page.request.post("/__test/account")).json();
}
async function signIn(
  page: Page,
  u: { username: string; password: string },
  navigate = true,
) {
  if (navigate) await page.goto("/");
  await page.getByLabel("Username or email", { exact: true }).fill(u.username);
  await page.getByLabel("Password", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Enter my library" }).click();
  await expect(
    page.getByRole("heading", { name: "A Quiet Beginning", exact: true }),
  ).toBeVisible();
}
async function menu(page: Page) {
  const button = page.getByRole("button", {
    name: "Open library menu",
    exact: true,
  });
  if (
    !(await page.locator(".sidebar.drawer-open").count()) &&
    (await button.isVisible())
  )
    await button.click();
}
async function notes(page: Page) {
  await menu(page);
  await page.getByRole("button", { name: /My notes/ }).click();
}
async function logout(page: Page) {
  await menu(page);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  // The reader closes immediately; the form becomes available after worker cleanup/revocation.
  await expect(
    page.getByRole("button", { name: "Enter my library", exact: true }),
  ).toBeEnabled();
}
test("sign-in is accessible and only shared catalog files allow guests", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  for (const url of [
    "/library.json",
    "/books/demo/book.json",
    "/books/demo/book.pdf",
    "/books/demo/1.wav",
  ])
    expect((await page.request.get(url)).status()).toBe(200);
  expect((await page.request.get("/books/unlisted/book.pdf")).status()).toBe(
    401,
  );
  expect((await page.request.get("/api/reader/state")).status()).toBe(401);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath("sign-in.png"),
    fullPage: true,
  });
});
test("notes and bookmarks stay private across account switches and a fresh browser", async ({
  page,
  browser,
}, info) => {
  const alice = await user(page),
    bob = await user(page);
  await signIn(page, alice);
  await page.getByRole("button", { name: "Open book", exact: true }).click();
  await page.getByRole("button", { name: "Bookmark this moment" }).click();
  await notes(page);
  await page
    .getByLabel("Your note", { exact: true })
    .fill("A thought only Alice should see.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.locator(".note-card")).toContainText(
    "A thought only Alice",
  );
  await expect
    .poll(async () => {
      const s = await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("leaf.reader.session")!).account.id,
      );
      return (
        await (
          await page.request.get("/api/reader/state", {
            headers: { "X-Reader-Account": s },
          })
        ).json()
      ).items.filter((x: any) => x.key.startsWith("note.")).length;
    })
    .toBe(1);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await logout(page);
  await signIn(page, bob, false);
  await notes(page);
  await expect(page.locator(".note-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await logout(page);
  await signIn(page, alice, false);
  await notes(page);
  await expect(page.locator(".note-card")).toContainText(
    "A thought only Alice",
  );
  await page.getByRole("button", { name: "Edit note", exact: true }).click();
  await page
    .getByLabel("Your note", { exact: true })
    .fill("An edited thought.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.locator(".note-card")).toContainText("An edited thought.");
  await page.screenshot({
    path: info.outputPath("personal-notes.png"),
    fullPage: true,
  });
  await expect
    .poll(async () => {
      const id = await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("leaf.reader.session")!).account.id,
      );
      return (
        await (
          await page.request.get("/api/reader/state", {
            headers: { "X-Reader-Account": id },
          })
        ).json()
      ).items.some((x: any) => x.value?.body === "An edited thought.");
    })
    .toBe(true);
  const other = await browser.newContext();
  const second = await other.newPage();
  await signIn(second, alice);
  await notes(second);
  await expect(second.locator(".note-card")).toContainText(
    "An edited thought.",
  );
  await other.close();
  await page.getByRole("button", { name: "Delete note", exact: true }).click();
  await expect(page.locator(".note-card")).toHaveCount(0);
});
test("offline outbox survives reload, restarts workers, and logout clears other tabs", async ({
  page,
  context,
}) => {
  const alice = await user(page);
  await signIn(page, alice);
  await page.getByRole("button", { name: "Open book", exact: true }).click();
  await page.getByRole("button", { name: "Save offline", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove offline copy", exact: true }),
  ).toBeVisible();
  const second = await context.newPage();
  await second.goto("/");
  await expect(
    second.getByRole("heading", { name: "A Quiet Beginning", exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await notes(page);
  await page
    .getByLabel("Your note", { exact: true })
    .fill("A quiet offline thought.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A Quiet Beginning", exact: true }),
  ).toBeVisible();
  await notes(page);
  await expect(page.locator(".note-card")).toContainText(
    "A quiet offline thought.",
  );
  const cdp = await context.newCDPSession(page);
  await cdp.send("ServiceWorker.enable");
  await cdp.send("ServiceWorker.stopAllWorkers");
  expect(
    await page.evaluate(async () => (await fetch("/library.json")).status),
  ).toBe(200);
  await context.setOffline(false);
  await expect
    .poll(async () => {
      const id = await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("leaf.reader.session")!).account.id,
      );
      return (
        await (
          await page.request.get("/api/reader/state", {
            headers: { "X-Reader-Account": id },
          })
        ).json()
      ).items.filter((x: any) => x.value?.body === "A quiet offline thought.")
        .length;
    })
    .toBe(1);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await logout(page);
  await expect(
    second.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  expect(
    await second.evaluate(async () => (await fetch("/library.json")).status),
  ).toBe(200);
  expect(
    await second.evaluate(
      async () => (await fetch("/api/reader/state")).status,
    ),
  ).toBe(401);
  await cdp.detach();
});

test("expiry signs out an open reader and logout survives unavailable local storage", async ({
  page,
}) => {
  const alice = await user(page);
  await page.route("**/api/reader/login", async (route) => {
    const response = await route.fetch(),
      data = await response.json();
    data.expiresAt = new Date(Date.now() + 1600).toISOString();
    await route.fulfill({ response, json: data });
  });
  await signIn(page, alice);
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible({ timeout: 5000 });
  await page.unroute("**/api/reader/login");
  await signIn(page, alice);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "leaf.reader.logged-out")
        throw new DOMException("Quota reached", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await logout(page);
  await expect(page.locator(".app-shell")).toHaveCount(0);
});

test("failed logout keeps the reader closed until server revocation can retry", async ({
  page,
}) => {
  const alice = await user(page);
  await signIn(page, alice);
  await page.route("**/api/reader/logout", (route) =>
    route.fulfill({ status: 503, json: { error: "Temporarily unavailable" } }),
  );
  await logout(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(0);
  await page.unroute("**/api/reader/logout");
  await signIn(page, alice);
});

test("guest reading has no personal saves, account requests or persistent progress", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let personalRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/reader/state")) personalRequests++;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(
    page.getByRole("heading", { name: "A Quiet Beginning", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open book", exact: true }).click();
  await page.getByRole("button", { name: "Bookmark this moment" }).click();
  await expect(
    page.getByRole("heading", { name: "Keep your place" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Sign in to save offline", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Keep your place" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await menu(page);
  await page.getByRole("button", { name: "Add a book", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Keep your place" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  const closeMenu = page.getByRole("button", {
    name: "Close library menu",
    exact: true,
  });
  if (await closeMenu.isVisible()) await closeMenu.click();
  expect(errors).toEqual([]);
  expect(personalRequests).toBe(0);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith("leaf.account.")),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(async () =>
      (await caches.keys()).filter(
        (k) => k.includes("books-account") || k === "guest-no-cache",
      ),
    ),
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath("guest-reader.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
});

test("email signup and password reveal create an account that can sign in again", async ({
  page,
}, info) => {
  const errors: string[] = [],
    failedRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => {
    if (/\/api\/reader\/|\/library.json/.test(request.url()))
      failedRequests.push(request.url());
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "New here? Create an account" })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill("A new reader");
  const email = `reader-${Date.now()}-${info.project.name}@example.com`;
  await page.getByLabel("Username or email", { exact: true }).fill(email);
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("A long test password, for reading.");
  await expect(password).toHaveAttribute("type", "password");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("A long test password, for reading.");
  await page.screenshot({
    path: info.outputPath("create-account-password-visible.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "password");
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(a11y.violations).toEqual([]);
  await page
    .getByRole("button", { name: "Create my account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A Quiet Beginning", exact: true }),
  ).toBeVisible();
  await logout(page);
  await signIn(page, {
    username: email.toUpperCase(),
    password: "A long test password, for reading.",
  });
  await page.getByRole("button", { name: "Open book", exact: true }).click();
  await notes(page);
  await page
    .getByLabel("Your note", { exact: true })
    .fill("My first account note.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.locator(".note-card")).toContainText(
    "My first account note.",
  );
  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test("guest entry waits for confirmed sign-out cleanup", async ({ page }) => {
  const alice = await user(page);
  await signIn(page, alice);
  await page.route("**/api/reader/logout", (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } }),
  );
  await logout(page);
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page.locator(".account-error")).toContainText(
    "sign-out cleanup did not finish",
  );
  await expect(page.locator(".app-shell")).toHaveCount(0);
  await page.unroute("**/api/reader/logout");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(
    page.getByRole("heading", { name: "A Quiet Beginning", exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/reader/me")).status()).toBe(401);
});

test("created accounts recover through sign-in after an initial sync failure", async ({
  page,
}, info) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "New here? Create an account" })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill("A reader");
  const email = `recover-${Date.now()}-${info.project.name}@example.com`;
  await page.getByLabel("Username or email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("A long recovery test password.");
  await page.request.post("/__test/fail-initial-sync", {
    data: { username: email },
  });
  await page
    .getByRole("button", { name: "Create my account", exact: true })
    .click();
  await expect(page.locator(".account-error")).toContainText(
    "Your account was created",
  );
  await expect(
    page.getByRole("button", { name: "Enter my library", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Enter my library", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A Quiet Beginning", exact: true }),
  ).toBeVisible();
});
