import { launchPersistent, firstPage } from "../src/browser.ts";
import { writeFileSync } from "node:fs";

async function main() {
  const handle = process.argv[2] ?? "BBandpey";
  const ctx = await launchPersistent({ profileDir: ".profile", headless: true });
  const page = await firstPage(ctx);
  await page.goto(`https://x.com/${handle}/with_replies`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(5000);

  const data = await page.evaluate((handleArg) => {
    const out: Array<Record<string, unknown>> = [];
    const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
    articles.forEach((a, i) => {
      const userNameEl = a.querySelector('[data-testid="User-Name"]');
      const userNameText = userNameEl?.textContent?.trim().slice(0, 80);
      const userLink = userNameEl?.querySelector('a[role="link"]')?.getAttribute("href");
      const statusLink = a.querySelector('a[href*="/status/"]')?.getAttribute("href");
      const tweetText = a.querySelector('[data-testid="tweetText"]')?.textContent?.trim().slice(0, 80);
      const socialContext = a.querySelector('[data-testid="socialContext"]')?.textContent?.trim().slice(0, 60);
      const articleAria = a.getAttribute("aria-labelledby");
      const ownProfile = userLink === `/${handleArg}`;
      out.push({ i, userNameText, userLink, statusLink, tweetText, socialContext, ownProfile });
    });
    return out;
  }, handle);

  console.log(JSON.stringify(data, null, 2));

  // Also dump cell structure
  const cells = await page.evaluate(() => {
    const out: Array<{ i: number; testIds: string[]; text: string }> = [];
    const cells = Array.from(document.querySelectorAll('[data-testid="cellInnerDiv"]'));
    cells.forEach((c, i) => {
      const ids = Array.from(c.querySelectorAll("[data-testid]"))
        .map((e) => e.getAttribute("data-testid")!)
        .filter((v, idx, arr) => arr.indexOf(v) === idx);
      out.push({ i, testIds: ids, text: (c.textContent ?? "").trim().slice(0, 80) });
    });
    return out;
  });
  writeFileSync("/tmp/x-cells.json", JSON.stringify(cells, null, 2), "utf8");
  console.log("\nwrote /tmp/x-cells.json with", cells.length, "cells");

  await ctx.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
