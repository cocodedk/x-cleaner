import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeBrowser, pageFor } from "./helpers/browser.ts";
import { capture } from "../src/diagnose.ts";

afterAll(closeBrowser);

const newDir = () => mkdtempSync(join(tmpdir(), "x-cleaner-diag-"));

describe("diagnose.capture", () => {
  it("creates a per-incident folder with screenshot, html, snapshot, meta", async () => {
    const { page, ctx } = await pageFor("with-replies.html");
    const article = page.locator('[data-fixture-id="1700000000000000010"]');
    const root = newDir();

    const dir = await capture(page, article, root, {
      reason: "caret-missing",
      url: "https://x.com/me/status/1700000000000000010",
    });

    expect(existsSync(join(dir, "screenshot.png"))).toBe(true);
    expect(existsSync(join(dir, "article.html"))).toBe(true);
    expect(existsSync(join(dir, "page.html"))).toBe(true);
    expect(existsSync(join(dir, "snapshot.txt"))).toBe(true);
    expect(existsSync(join(dir, "meta.json"))).toBe(true);

    const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
    expect(meta.reason).toBe("caret-missing");
    expect(meta.url).toBe("https://x.com/me/status/1700000000000000010");
    expect(typeof meta.ts).toBe("string");

    const folders = readdirSync(root);
    expect(folders.length).toBe(1);
    expect(folders[0]).toMatch(/caret-missing/);

    await ctx.close();
  });

  it("survives missing article locator (page-level dump still works)", async () => {
    const { page, ctx } = await pageFor("with-replies.html");
    const root = newDir();

    const dir = await capture(page, null, root, { reason: "login-redirect" });

    expect(existsSync(join(dir, "page.html"))).toBe(true);
    expect(existsSync(join(dir, "article.html"))).toBe(false);
    await ctx.close();
  });
});
