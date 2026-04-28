// Run the actual enumerateMyItems against /with_replies and print everything by kind.
import { launchPersistent, firstPage } from "../src/browser.ts";
import { enumerateMyItems } from "../src/replyDetector.ts";

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
    const items = await enumerateMyItems(page, handle);
    for (const it of items) if (!seen.has(it.id)) seen.set(it.id, it.kind);
  };
  await collect();
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    await page.waitForTimeout(2500);
    await collect();
  }
  const counts: Record<string, number> = {};
  for (const k of seen.values()) counts[k] = (counts[k] ?? 0) + 1;
  console.log("counts by kind:", counts);
  console.log("first 20:");
  let n = 0;
  for (const [id, kind] of seen) {
    if (n++ >= 20) break;
    console.log(`  ${id}  [${kind}]`);
  }
  await ctx.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
