import type { Locator, Page } from "playwright";
import { SELECTORS } from "./selectors.ts";
import { jitter, type Rng } from "./pace.ts";
import { humanClick } from "./humanCursor.ts";

export type Outcome = "deleted" | "not-found" | "error" | "skipped";

export type DeleteResult = {
  outcome: Outcome;
  reason?: string;
};

export type MicroPace = { baseMs: number; fraction: number; rng: Rng };

export type DeleteMode = "delete" | "undo-repost";

const SHORT_TIMEOUT_MS = 5000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const wait = (p: MicroPace) => sleep(jitter(p.baseMs, p.fraction, p.rng));

export async function deleteArticle(
  page: Page,
  article: Locator,
  pace: MicroPace,
  mode: DeleteMode = "delete",
): Promise<DeleteResult> {
  if (mode === "undo-repost") return await undoRepost(page, article, pace);
  return await deleteOwn(page, article, pace);
}

async function deleteOwn(page: Page, article: Locator, pace: MicroPace): Promise<DeleteResult> {
  const caret = article.locator(SELECTORS.caret).first();
  if ((await caret.count()) === 0) {
    return { outcome: "error", reason: "caret-missing" };
  }
  try {
    await humanClick(page, caret, pace.rng);
  } catch {
    return { outcome: "error", reason: "caret-click-failed" };
  }
  await wait(pace);

  const deleteItem = page.locator(SELECTORS.menuitem, { hasText: /^Delete$/ }).first();
  try {
    await deleteItem.waitFor({ state: "visible", timeout: SHORT_TIMEOUT_MS });
  } catch {
    return { outcome: "error", reason: "delete-menuitem-missing" };
  }
  await humanClick(page, deleteItem, pace.rng);
  await wait(pace);

  const confirm = page.locator(SELECTORS.confirmDelete).first();
  try {
    await confirm.waitFor({ state: "visible", timeout: SHORT_TIMEOUT_MS });
  } catch {
    return { outcome: "error", reason: "confirm-button-missing" };
  }
  await humanClick(page, confirm, pace.rng);
  await wait(pace);

  return { outcome: "deleted" };
}

// Reposts: click the [data-testid="unretweet"] button on the article, then
// the [data-testid="unretweetConfirm"] item (rendered as "Undo repost").
async function undoRepost(page: Page, article: Locator, pace: MicroPace): Promise<DeleteResult> {
  const btn = article.locator('[data-testid="unretweet"]').first();
  if ((await btn.count()) === 0) {
    return { outcome: "error", reason: "unretweet-button-missing" };
  }
  try {
    await humanClick(page, btn, pace.rng);
  } catch {
    return { outcome: "error", reason: "unretweet-click-failed" };
  }
  await wait(pace);

  const confirm = page.locator(SELECTORS.unretweetConfirm).first();
  try {
    await confirm.waitFor({ state: "visible", timeout: SHORT_TIMEOUT_MS });
  } catch {
    return { outcome: "error", reason: "unretweet-confirm-missing" };
  }
  await humanClick(page, confirm, pace.rng);
  await wait(pace);

  return { outcome: "deleted" };
}
