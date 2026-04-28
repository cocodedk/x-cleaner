import { describe, it, expect, afterAll } from "vitest";
import { closeBrowser, pageFor } from "./helpers/browser.ts";
import { deleteArticle } from "../src/delete.ts";
import { makeRng } from "../src/pace.ts";

afterAll(closeBrowser);

const microPace = { baseMs: 10, fraction: 0.4, rng: makeRng(1) };

describe("deleteArticle", () => {
  it("removes the targeted article from the DOM via caret → Delete → confirm", async () => {
    const { page, ctx } = await pageFor("with-replies.html");
    const article = page.locator('[data-fixture-id="1700000000000000010"]');
    expect(await article.count()).toBe(1);

    const result = await deleteArticle(page, article, microPace);

    expect(result.outcome).toBe("deleted");
    expect(await article.count()).toBe(0);
    await ctx.close();
  });

  it("returns selector-missing error when caret is absent", async () => {
    const { page, ctx } = await pageFor("with-replies.html");
    await page.evaluate(() => {
      document.querySelectorAll('[data-testid="caret"]').forEach((b) => b.remove());
    });
    const article = page.locator('[data-fixture-id="1700000000000000010"]');
    const result = await deleteArticle(page, article, microPace);

    expect(result.outcome).toBe("error");
    expect(result.reason).toBe("caret-missing");
    await ctx.close();
  });

  it("returns selector-missing error when Delete menuitem is absent", async () => {
    const { page, ctx } = await pageFor("with-replies.html");
    await page.evaluate(() => {
      document.querySelectorAll('[role="menuitem"]').forEach((m) => {
        if (m.textContent?.trim() === "Delete") m.remove();
      });
    });
    const article = page.locator('[data-fixture-id="1700000000000000010"]');
    const result = await deleteArticle(page, article, microPace);

    expect(result.outcome).toBe("error");
    expect(result.reason).toBe("delete-menuitem-missing");
    await ctx.close();
  });
});
