// Click the unretweet button on the first repost and dump what shows up.
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

  const repost = page
    .locator('article[data-testid="tweet"]')
    .filter({ has: page.locator('[data-testid="socialContext"]') })
    .first();

  const unretweetBtn = repost.locator('[data-testid="unretweet"]').first();
  console.log("unretweet button count:", await unretweetBtn.count());

  await unretweetBtn.click();
  await page.waitForTimeout(1500);

  const menuitems = await page.locator('[role="menuitem"]').allTextContents();
  console.log("menuitems after click:", menuitems);

  const confirmBtn = await page.locator('[data-testid="unretweetConfirm"]').count();
  console.log('[data-testid="unretweetConfirm"] count:', confirmBtn);

  // Also: check for any visible "Undo" text
  const undoTexts = await page.locator('text=/undo/i').allTextContents();
  console.log("any visible 'undo' text:", undoTexts);

  await page.waitForTimeout(3000);
  await ctx.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
