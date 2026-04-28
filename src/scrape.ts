import type { Page } from "playwright";
import { enumerateReplies } from "./replyDetector.ts";

export type ScrapeOpts = {
  handle: string;
  maxIdleScrolls: number;
  scrollPauseMs: number;
  maxIds: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function scrapeReplies(page: Page, opts: ScrapeOpts): Promise<string[]> {
  const collected = new Map<string, string>();
  let idle = 0;

  while (idle < opts.maxIdleScrolls && collected.size < opts.maxIds) {
    const before = collected.size;
    const replies = await enumerateReplies(page, opts.handle);
    for (const r of replies) {
      if (collected.size >= opts.maxIds) break;
      if (!collected.has(r.id)) collected.set(r.id, r.url);
    }
    if (collected.size === before) {
      idle++;
    } else {
      idle = 0;
    }
    if (collected.size >= opts.maxIds) break;
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    await sleep(opts.scrollPauseMs);
  }

  return Array.from(collected.keys());
}
