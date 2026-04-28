// Scroll deeply through /with_replies and report each article's classification.
// Usage: npx tsx scripts/diag-deep.ts <handle>
import { launchPersistent, firstPage } from "../src/browser.ts";

async function main() {
  const handle = process.argv[2] ?? "BBandpey";
  const ctx = await launchPersistent({ profileDir: ".profile", headless: true });
  const page = await firstPage(ctx);
  await page.goto(`https://x.com/${handle}/with_replies`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForTimeout(4000);

  const seen = new Map<
    string,
    { author: string; classification: string; text: string }
  >();

  const collect = async () => {
    const data = await page.evaluate((handleArg) => {
      const out: Array<{ id: string; author: string; classification: string; text: string }> = [];
      const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      for (const a of articles) {
        const userLink = a
          .querySelector('[data-testid="User-Name"] a[role="link"]')
          ?.getAttribute("href") ?? "";
        const author = userLink.startsWith("/") ? userLink.slice(1).split("/")[0]! : "?";
        const isRepost = a.querySelector('[data-testid="socialContext"]') != null;
        const nestedArticle = a.querySelector('article[data-testid="tweet"]');
        const isQuote = nestedArticle != null;
        const replyingTo = /Replying to/i.test(a.textContent ?? "");
        const statusEl = a.querySelector('a[href*="/status/"]');
        const statusHref = statusEl?.getAttribute("href") ?? "";
        const m = /\/status\/(\d+)/.exec(statusHref);
        const id = m?.[1] ?? "";
        let classification = "?";
        if (author !== handleArg) classification = `by-other(${author})`;
        else if (isRepost) classification = "repost-by-me";
        else if (isQuote) classification = "quote-by-me";
        else if (replyingTo) classification = "REPLY-by-me-standalone";
        else classification = "BY-ME-no-context-yet";
        out.push({
          id,
          author,
          classification,
          text: (a.textContent ?? "").trim().slice(0, 100),
        });
      }
      return out;
    }, handle);
    for (const d of data) {
      if (d.id && !seen.has(d.id)) {
        seen.set(d.id, { author: d.author, classification: d.classification, text: d.text });
      }
    }
  };

  await collect();
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    await page.waitForTimeout(2500);
    const before = seen.size;
    await collect();
    if (seen.size === before) {
      console.log(`scroll ${i + 1}: no new (total ${seen.size}) — stopping`);
      break;
    }
    console.log(`scroll ${i + 1}: total ${seen.size}`);
  }

  const grouped = new Map<string, number>();
  for (const v of seen.values()) {
    grouped.set(v.classification, (grouped.get(v.classification) ?? 0) + 1);
  }
  console.log("\n=== classification counts ===");
  for (const [k, v] of grouped) console.log(`  ${k}: ${v}`);

  console.log("\n=== sample of mine that are NOT classified as reply ===");
  let n = 0;
  for (const [id, v] of seen) {
    if (v.author === handle && v.classification !== "REPLY-by-me-standalone" && n < 10) {
      console.log(`  ${id}  [${v.classification}]  "${v.text.slice(0, 80)}"`);
      n++;
    }
  }

  await ctx.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
