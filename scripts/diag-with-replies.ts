import { launchPersistent, firstPage } from "../src/browser.ts";
import { writeFileSync } from "node:fs";

async function main() {
  const handle = process.argv[2] ?? "BBandpey";
  const ctx = await launchPersistent({ profileDir: ".profile", headless: true });
  const page = await firstPage(ctx);
  const url = `https://x.com/${handle}/with_replies`;
  console.log("goto:", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(5000);

  const finalUrl = page.url();
  console.log("final url:", finalUrl);

  const counts = {
    articles: await page.locator('article[data-testid="tweet"]').count(),
    replyContextV1: await page.locator('[data-testid="reply-context"]').count(),
    socialContext: await page.locator('[data-testid="socialContext"]').count(),
    timeElements: await page.locator("time").count(),
    cells: await page.locator('[data-testid="cellInnerDiv"]').count(),
    primaryColumn: await page.locator('[data-testid="primaryColumn"]').count(),
    emptyState: await page.locator('[data-testid="emptyState"]').count(),
  };
  console.log("counts:", counts);

  const replyingToText = await page.locator('text=/^Replying to/i').count();
  console.log("replyingToText nodes:", replyingToText);

  const html = await page.content();
  writeFileSync("/tmp/x-with-replies.html", html, "utf8");
  console.log("wrote /tmp/x-with-replies.html size=" + html.length);

  await page.screenshot({ path: "/tmp/x-with-replies.png", fullPage: true });
  console.log("wrote /tmp/x-with-replies.png");

  // Probe one article: dump its outerHTML and a few attributes
  const first = page.locator('article[data-testid="tweet"]').first();
  if ((await first.count()) > 0) {
    const oh = await first.evaluate((el) => (el as Element).outerHTML);
    writeFileSync("/tmp/x-article-0.html", oh, "utf8");
    console.log("wrote /tmp/x-article-0.html size=" + oh.length);
  }

  await ctx.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
