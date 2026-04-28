import type { BrowserContext, Page } from "playwright";
import { State } from "./state.ts";
import { Scheduler } from "./scheduler.ts";
import { ErrorBudget } from "./errors.ts";
import { humanClick } from "./humanCursor.ts";
import { capture } from "./diagnose.ts";
import { isLoggedOutUrl } from "./selectors.ts";
import type { MicroPace } from "./delete.ts";
import { join } from "node:path";

export type UnlikeOpts = {
  handle: string;
  stateDir: string;
  scheduler: Scheduler;
  budget: ErrorBudget;
  micro: MicroPace;
  maxIds: number;
  scrollPauseMs: number;
  dryRun: boolean;
  log: (msg: string) => void;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SETTLE_MS = 700;
const MAX_ATTEMPTS_PER_ID = 3;
const MAX_IDLE_SCROLLS = 8;
const RELOAD_AFTER_IDLE = 4;

const ENUM_FN_BODY = `
  var statusRe = new RegExp("/status/(\\\\d+)");
  var articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
  var out = [];
  var seen = {};
  for (var i = 0; i < articles.length; i++) {
    var a = articles[i];
    var unlikeBtn = a.querySelector('[data-testid="unlike"]');
    if (!unlikeBtn) continue;
    var statusEl = a.querySelector('a[href*="/status/"]');
    var href = statusEl ? statusEl.getAttribute('href') : null;
    var m = href ? statusRe.exec(href) : null;
    var id = m ? m[1] : null;
    if (!id || !href) continue;
    if (seen[id]) continue;
    seen[id] = 1;
    out.push({ id: id, url: href });
  }
  return out;
`;
const enumFn = new Function(ENUM_FN_BODY) as () => Array<{ id: string; url: string }>;

async function enumerateLiked(page: Page) {
  return await page.evaluate(enumFn);
}

export async function runUnlike(
  ctx: BrowserContext,
  opts: UnlikeOpts,
): Promise<{ summary: ReturnType<State["summary"]> }> {
  const state = new State(opts.stateDir);
  const diagDir = join(opts.stateDir, "diagnostics");
  const page = ctx.pages()[0] ?? (await ctx.newPage());

  await page.goto(`https://x.com/${opts.handle}/likes`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  if (isLoggedOutUrl(page.url())) {
    opts.log("not logged in (likes profile) — run `x-cleaner login --profile-dir=.profile-likes`");
    return { summary: state.summary() };
  }
  await sleep(2500);

  if (opts.dryRun) {
    let idleScrolls = 0;
    const seen = new Map<string, string>();
    while (idleScrolls < MAX_IDLE_SCROLLS && seen.size < opts.maxIds) {
      const items = await enumerateLiked(page);
      const before = seen.size;
      for (const it of items) {
        if (seen.size >= opts.maxIds) break;
        if (state.isTerminal(it.id)) continue;
        if (!seen.has(it.id)) seen.set(it.id, it.url);
      }
      if (seen.size === before) idleScrolls++;
      else idleScrolls = 0;
      if (seen.size >= opts.maxIds) break;
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
      await sleep(opts.scrollPauseMs);
    }
    opts.log(`dry-run: would unlike ${seen.size} items`);
    return { summary: state.summary() };
  }

  const attempts = new Map<string, number>();
  let idleScrolls = 0;
  let processed = 0;

  while (processed < opts.maxIds) {
    const step = await opts.scheduler.nextDelay();
    if (step.kind === "stop") {
      opts.log(`scheduler stopped: ${step.reason}`);
      break;
    }
    if (step.ms >= 15_000) opts.log(`long break ${(step.ms / 1000).toFixed(0)}s...`);
    if (step.ms > 0) await sleep(step.ms);

    const items = await enumerateLiked(page);
    const next = items.find(
      (it) => !state.isTerminal(it.id) && (attempts.get(it.id) ?? 0) < MAX_ATTEMPTS_PER_ID,
    );

    if (!next) {
      idleScrolls++;
      if (idleScrolls >= MAX_IDLE_SCROLLS) {
        opts.log(`no more liked items found after ${MAX_IDLE_SCROLLS} idle scrolls — done.`);
        break;
      }
      if (idleScrolls === RELOAD_AFTER_IDLE) {
        opts.log("idle, reloading likes to refresh timeline...");
        await page.goto(`https://x.com/${opts.handle}/likes`, {
          waitUntil: "domcontentloaded",
          timeout: 45_000,
        });
        await sleep(3000);
      } else {
        await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
        await sleep(opts.scrollPauseMs);
      }
      continue;
    }
    idleScrolls = 0;

    const articleLoc = page
      .locator('article[data-testid="tweet"]')
      .filter({ has: page.locator(`a[href="${next.url}"]`) })
      .first();
    const unlikeBtn = articleLoc.locator('[data-testid="unlike"]').first();

    let outcome: "deleted" | "error" = "error";
    let reason: string | undefined;
    try {
      await articleLoc.scrollIntoViewIfNeeded({ timeout: 5000 });
    } catch {
      // ignore
    }
    if ((await unlikeBtn.count()) === 0) {
      outcome = "error";
      reason = "unlike-button-missing";
    } else {
      try {
        await humanClick(page, unlikeBtn, opts.micro.rng);
        outcome = "deleted";
      } catch {
        outcome = "error";
        reason = "unlike-click-failed";
      }
    }

    state.appendLog({ id: next.id, action: outcome, reason, url: next.url });
    if (outcome === "error") {
      const n = (attempts.get(next.id) ?? 0) + 1;
      attempts.set(next.id, n);
      await capture(page, articleLoc, diagDir, { reason: reason ?? "unknown", url: next.url });
      if (n >= MAX_ATTEMPTS_PER_ID) {
        state.markProcessed(next.id, "skipped");
        opts.log(`${next.id} → skipped after ${n} errors (last: ${reason})`);
      } else {
        state.markProcessed(next.id, "error");
        opts.log(`${next.id} → error attempt ${n}/${MAX_ATTEMPTS_PER_ID}: ${reason}`);
      }
      opts.budget.recordError();
      if (opts.budget.shouldAbort()) {
        opts.log("aborting: too many consecutive errors");
        state.flushProcessed();
        break;
      }
      if (opts.budget.shouldPause()) {
        opts.log("pausing 30 min after consecutive errors");
        await sleep(30 * 60_000);
      }
    } else {
      state.markProcessed(next.id, outcome);
      opts.budget.recordSuccess();
      attempts.delete(next.id);
      processed++;
      opts.log(`${next.id} → unliked`);
    }
    state.flushProcessed();
    await sleep(SETTLE_MS);
  }

  return { summary: state.summary() };
}
