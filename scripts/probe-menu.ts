// Probe the caret menu for a specific status URL to see what menuitems appear.
// Usage: npx tsx scripts/probe-menu.ts <handle> <id>
import { launchPersistent, firstPage } from "../src/browser.ts";

async function main() {
  const handle = process.argv[2] ?? "BBandpey";
  const id = process.argv[3];
  if (!id) {
    console.error("usage: probe-menu.ts <handle> <id>");
    process.exit(2);
  }
  const ctx = await launchPersistent({ profileDir: ".profile", headless: false });
  const page = await firstPage(ctx);
  const url = `https://x.com/${handle}/status/${id}`;
  console.log("goto:", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(3500);

  console.log("final url:", page.url());
  const articleCount = await page.locator('article[data-testid="tweet"]').count();
  console.log("articles on page:", articleCount);

  const focusedArticle = page
    .locator('article[data-testid="tweet"]')
    .filter({ has: page.locator(`a[href="/${handle}/status/${id}"]`) })
    .first();
  const focusedExists = (await focusedArticle.count()) > 0;
  console.log("focused article (by handle/id href) exists:", focusedExists);

  if (focusedExists) {
    const html = await focusedArticle.evaluate((el) => (el as Element).outerHTML);
    console.log("focused article outerHTML length:", html.length);
    const userName = await focusedArticle
      .locator('[data-testid="User-Name"]')
      .first()
      .textContent();
    console.log("focused article user-name text:", userName?.trim().slice(0, 80));
    const socialContext = await focusedArticle
      .locator('[data-testid="socialContext"]')
      .count();
    console.log("focused article socialContext nodes:", socialContext);
    const caret = focusedArticle.locator('[data-testid="caret"]').first();
    const caretCount = await caret.count();
    console.log("caret on focused article:", caretCount);

    if (caretCount > 0) {
      await caret.click();
      await page.waitForTimeout(1500);
      const items = await page
        .locator('[role="menuitem"]')
        .allTextContents();
      console.log("menu items:", items);
    }
  }

  await page.waitForTimeout(2000);
  await ctx.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
