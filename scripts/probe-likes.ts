// Probe what's on /<handle>/likes — confirm the unlike-button selector and structure.
import { launchPersistent, firstPage } from "../src/browser.ts";

async function main() {
  const handle = process.argv[2] ?? "BBandpey";
  const ctx = await launchPersistent({ profileDir: ".profile-likes", headless: true });
  const page = await firstPage(ctx);
  await page.goto(`https://x.com/${handle}/likes`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForTimeout(4500);
  console.log("final url:", page.url());

  const counts = {
    articles: await page.locator('article[data-testid="tweet"]').count(),
    unlike: await page.locator('[data-testid="unlike"]').count(),
    like: await page.locator('[data-testid="like"]').count(),
    cells: await page.locator('[data-testid="cellInnerDiv"]').count(),
    emptyState: await page.locator('[data-testid="emptyState"]').count(),
  };
  console.log("counts:", counts);

  // Sample first three article status URLs
  const urls = await page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll('article[data-testid="tweet"]').forEach((a, i) => {
      if (i >= 5) return;
      const link = a.querySelector('a[href*="/status/"]')?.getAttribute("href") || "";
      const hasUnlike = a.querySelector('[data-testid="unlike"]') != null;
      out.push(`${hasUnlike ? "♥" : "♡"} ${link}`);
    });
    return out;
  });
  console.log("first 5:", urls);

  await ctx.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
