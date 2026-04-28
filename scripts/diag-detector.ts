// Run the real enumerateReplies on the live page and show what it returns.
import { launchPersistent, firstPage } from "../src/browser.ts";
import { enumerateReplies } from "../src/replyDetector.ts";

async function main() {
  const handle = process.argv[2] ?? "BBandpey";
  const ctx = await launchPersistent({ profileDir: ".profile", headless: true });
  const page = await firstPage(ctx);
  await page.goto(`https://x.com/${handle}/with_replies`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForTimeout(4000);

  const seen = new Map<string, string>();
  const collect = async () => {
    const replies = await enumerateReplies(page, handle);
    for (const r of replies) if (!seen.has(r.id)) seen.set(r.id, r.url);
  };

  await collect();
  console.log(`initial: ${seen.size}`);
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    await page.waitForTimeout(2500);
    const before = seen.size;
    await collect();
    console.log(`scroll ${i + 1}: total ${seen.size} (+${seen.size - before})`);
  }

  console.log(`\nTOTAL real-detector replies: ${seen.size}`);
  for (const [id, url] of seen) console.log(`  ${id}  ${url}`);

  await ctx.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
