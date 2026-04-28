// Dump full structure of a specific article from /<handle>/with_replies
import { launchPersistent, firstPage } from "../src/browser.ts";
import { writeFileSync } from "node:fs";

async function main() {
  const handle = process.argv[2] ?? "BBandpey";
  const id = process.argv[3];
  if (!id) {
    console.error("usage: probe-article-html.ts <handle> <id>");
    process.exit(2);
  }
  const ctx = await launchPersistent({ profileDir: ".profile", headless: true });
  const page = await firstPage(ctx);
  await page.goto(`https://x.com/${handle}/with_replies`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForTimeout(4000);

  const article = page
    .locator('article[data-testid="tweet"]')
    .filter({ has: page.locator(`a[href="/${handle}/status/${id}"]`) })
    .first();

  const exists = (await article.count()) > 0;
  console.log("article exists on with_replies:", exists);
  if (exists) {
    const html = await article.evaluate((el) => (el as Element).outerHTML);
    writeFileSync("/tmp/x-mystery.html", html, "utf8");
    console.log("dumped /tmp/x-mystery.html size=" + html.length);
    const text = await article.innerText();
    console.log("=== inner text ===\n" + text);
  }

  // Also navigate to the permalink and check menu
  console.log("\n=== permalink ===");
  await page.goto(`https://x.com/${handle}/status/${id}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(3500);
  const articlesOnPermalink = await page.locator('article[data-testid="tweet"]').count();
  console.log("articles on permalink page:", articlesOnPermalink);
  // Is it shown as a reply (parent above)?
  const focusedArticle = page
    .locator('article[data-testid="tweet"]')
    .filter({ has: page.locator(`a[href="/${handle}/status/${id}"]`) })
    .first();
  const focusedText = (await focusedArticle.innerText()).slice(0, 200);
  console.log("=== focused on permalink ===\n" + focusedText);

  await ctx.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
