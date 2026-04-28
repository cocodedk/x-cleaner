import type { BrowserContext, Page } from "playwright";
import { State } from "./state.ts";
import { Scheduler } from "./scheduler.ts";
import { ErrorBudget } from "./errors.ts";
import { deleteArticle, type DeleteMode, type MicroPace } from "./delete.ts";
import { capture } from "./diagnose.ts";
import { enumerateMyItems, type ItemKind, type MyItem } from "./replyDetector.ts";
import { isLoggedOutUrl, SELECTORS } from "./selectors.ts";
import { join } from "node:path";

export type RunOpts = {
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
const SETTLE_AFTER_DELETE_MS = 1500;
const MAX_ATTEMPTS_PER_ID = 3;
const MAX_IDLE_SCROLLS = 8;
const RELOAD_AFTER_IDLE = 4;

export async function runDeleteReplies(
  ctx: BrowserContext,
  opts: RunOpts,
): Promise<{ summary: ReturnType<State["summary"]> }> {
  const state = new State(opts.stateDir);
  const diagDir = join(opts.stateDir, "diagnostics");
  const page = ctx.pages()[0] ?? (await ctx.newPage());

  await page.goto(`https://x.com/${opts.handle}/with_replies`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  if (isLoggedOutUrl(page.url())) {
    opts.log("not logged in — run `x-cleaner login` first");
    return { summary: state.summary() };
  }

  if (opts.dryRun) return await runDryRun(page, state, opts);

  await retryStuckErrors(page, state, diagDir, opts);

  // Return to the with_replies feed for the in-place loop.
  await page.goto(`https://x.com/${opts.handle}/with_replies`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await sleep(2000);

  return await runInPlace(page, state, diagDir, opts);
}

async function retryStuckErrors(page: Page, state: State, diagDir: string, opts: RunOpts) {
  const stuck: string[] = [];
  for (const [id, outcome] of (state as any).processed.entries() as Iterable<[string, string]>) {
    if (outcome === "error") stuck.push(id);
  }
  if (stuck.length === 0) return;
  opts.log(`pre-pass: ${stuck.length} prior-error id(s) — trying via permalink`);
  for (const id of stuck) {
    const step = await opts.scheduler.nextDelay();
    if (step.kind === "stop") return;
    if (step.ms >= 15_000) opts.log(`long break ${(step.ms / 1000).toFixed(0)}s...`);
    if (step.ms > 0) await sleep(step.ms);
    const r = await deleteViaPermalink(page, opts.handle, id, opts.micro, diagDir);
    state.appendLog({ id, action: r.outcome, reason: r.reason, url: r.url });
    state.markProcessed(id, r.outcome);
    state.flushProcessed();
    opts.log(`${id} (permalink) → ${r.outcome}${r.reason ? ` (${r.reason})` : ""}`);
  }
}

async function deleteViaPermalink(
  page: Page,
  handle: string,
  id: string,
  micro: MicroPace,
  diagDir: string,
): Promise<{ outcome: "deleted" | "not-found" | "error"; reason?: string; url: string }> {
  const url = `https://x.com/${handle}/status/${id}`;
  const resp = await page
    .goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 })
    .catch(() => null);
  if (isLoggedOutUrl(page.url())) {
    return { outcome: "error", reason: "login-required", url };
  }
  if (resp && resp.status() === 404) return { outcome: "not-found", url };

  const article = page
    .locator(SELECTORS.tweet)
    .filter({ has: page.locator(`a[href="/${handle}/status/${id}"]`) })
    .first();
  try {
    await article.waitFor({ state: "attached", timeout: 15_000 });
  } catch {
    await capture(page, null, diagDir, { reason: "tweet-missing-on-permalink", url });
    return { outcome: "error", reason: "tweet-missing-on-permalink", url };
  }
  await sleep(800);
  const r = await deleteArticle(page, article, micro);
  if (r.outcome === "error") {
    await capture(page, article, diagDir, { reason: r.reason ?? "unknown", url });
    return { outcome: "error", reason: r.reason, url };
  }
  return { outcome: "deleted", url };
}

async function runDryRun(page: Page, state: State, opts: RunOpts) {
  opts.log("dry-run: enumerating my items (post/reply/quote/repost), no clicks...");
  let idleScrolls = 0;
  const seen = new Map<string, MyItem>();
  while (idleScrolls < MAX_IDLE_SCROLLS && seen.size < opts.maxIds) {
    const items = await enumerateMyItems(page, opts.handle);
    const before = seen.size;
    for (const it of items) {
      if (seen.size >= opts.maxIds) break;
      if (state.isTerminal(it.id)) continue;
      if (!seen.has(it.id)) seen.set(it.id, it);
    }
    if (seen.size === before) idleScrolls++;
    else idleScrolls = 0;
    if (seen.size >= opts.maxIds) break;
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    await sleep(opts.scrollPauseMs);
  }
  const lines: string[] = [];
  for (const it of seen.values()) lines.push(`  [${it.kind}] ${it.id}`);
  opts.log(`dry-run: would process ${seen.size}:\n${lines.join("\n")}`);
  return { summary: state.summary() };
}

const KIND_TO_MODE: Record<ItemKind, DeleteMode> = {
  post: "delete",
  reply: "delete",
  quote: "delete",
  repost: "undo-repost",
};

async function runInPlace(page: Page, state: State, diagDir: string, opts: RunOpts) {
  const attempts = new Map<string, number>();
  let idleScrolls = 0;
  let processed = 0;

  while (processed < opts.maxIds) {
    const step = await opts.scheduler.nextDelay();
    if (step.kind === "stop") {
      opts.log(`scheduler stopped: ${step.reason}`);
      break;
    }
    if (step.ms >= 15_000) {
      opts.log(`long break ${(step.ms / 1000).toFixed(0)}s...`);
    }
    if (step.ms > 0) await sleep(step.ms);

    const items = await enumerateMyItems(page, opts.handle);
    const next = items.find(
      (it) => !state.isTerminal(it.id) && (attempts.get(it.id) ?? 0) < MAX_ATTEMPTS_PER_ID,
    );

    if (!next) {
      idleScrolls++;
      if (idleScrolls >= MAX_IDLE_SCROLLS) {
        opts.log(`no more items found after ${MAX_IDLE_SCROLLS} idle scrolls — done.`);
        break;
      }
      if (idleScrolls === RELOAD_AFTER_IDLE) {
        opts.log("idle, reloading with_replies to refresh timeline...");
        await page.goto(`https://x.com/${opts.handle}/with_replies`, {
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
      .locator(SELECTORS.tweet)
      .filter({ has: page.locator(`a[href="${next.url}"]`) })
      .first();
    try {
      await articleLoc.scrollIntoViewIfNeeded({ timeout: 5000 });
    } catch {
      // ignore — deleteArticle will surface its own errors if visible click fails
    }

    const mode = KIND_TO_MODE[next.kind];
    let r = await deleteArticle(page, articleLoc, opts.micro, mode);
    // Permalink fallback only meaningful for "delete" mode (own permalink).
    if (
      r.outcome === "error" &&
      mode === "delete" &&
      r.reason === "delete-menuitem-missing"
    ) {
      opts.log(`${next.id} → menu missing on feed, trying permalink fallback`);
      const fb = await deleteViaPermalink(page, opts.handle, next.id, opts.micro, diagDir);
      if (fb.outcome === "deleted") {
        r = { outcome: "deleted" };
      } else {
        r = { outcome: "error", reason: fb.reason ?? "permalink-fallback-failed" };
      }
      await page.goto(`https://x.com/${opts.handle}/with_replies`, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await sleep(2000);
    }
    state.appendLog({ id: next.id, action: r.outcome, reason: r.reason, url: next.url });

    if (r.outcome === "error") {
      const n = (attempts.get(next.id) ?? 0) + 1;
      attempts.set(next.id, n);
      await capture(page, articleLoc, diagDir, { reason: r.reason ?? "unknown", url: next.url });
      if (n >= MAX_ATTEMPTS_PER_ID) {
        state.markProcessed(next.id, "skipped");
        opts.log(`${next.id} → skipped after ${n} errors (last: ${r.reason})`);
      } else {
        state.markProcessed(next.id, "error");
        opts.log(`${next.id} → error attempt ${n}/${MAX_ATTEMPTS_PER_ID}: ${r.reason}`);
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
      // reload feed to clear any half-open menu/modal state
      await page.goto(`https://x.com/${opts.handle}/with_replies`, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await sleep(2000);
    } else {
      state.markProcessed(next.id, r.outcome);
      opts.budget.recordSuccess();
      attempts.delete(next.id);
      processed++;
      opts.log(`${next.id} [${next.kind}] → ${r.outcome}`);
    }
    state.flushProcessed();

    await sleep(SETTLE_AFTER_DELETE_MS);
  }

  return { summary: state.summary() };
}
