// Click the caret of the first repost on /<handle>/with_replies and dump the menu items.
import { launchPersistent, firstPage } from "../src/browser.ts";

async function main() {
  const handle = process.argv[2] ?? "BBandpey";
  const ctx = await launchPersistent({ profileDir: ".profile", headless: false });
  const page = await firstPage(ctx);
  await page.goto(`https://x.com/${handle}/with_replies`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForTimeout(4000);

  const repostArticle = page
    .locator('article[data-testid="tweet"]')
    .filter({ has: page.locator('[data-testid="socialContext"]') })
    .first();

  const exists = (await repostArticle.count()) > 0;
  console.log("first repost article found:", exists);
  if (!exists) {
    await ctx.close();
    return;
  }

  // Look at the unretweet button on the repost article (might be clickable directly)
  const unretweetBtn = await repostArticle.locator('[data-testid="unretweet"]').count();
  console.log('article-level [data-testid="unretweet"] button:', unretweetBtn);

  await repostArticle.locator('[data-testid="caret"]').first().click();
  await page.waitForTimeout(1500);

  const items = await page.locator('[role="menuitem"]').allTextContents();
  console.log("menu items:", items);

  // Also check button-role menu items
  const buttons = await page.locator('[role="menuitem"], [role="button"]:visible').allTextContents();
  console.log("any role-button text near menu:", buttons.slice(0, 20));

  await page.waitForTimeout(2500);
  await ctx.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
