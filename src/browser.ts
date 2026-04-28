import { chromium, type BrowserContext, type Page } from "playwright";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";

export type LaunchOpts = {
  profileDir: string;
  headless?: boolean;
};

export async function launchPersistent(opts: LaunchOpts): Promise<BrowserContext> {
  const profileDir = resolve(opts.profileDir);
  mkdirSync(profileDir, { recursive: true });
  return chromium.launchPersistentContext(profileDir, {
    headless: opts.headless ?? false,
    channel: "chrome",
    viewport: { width: 1280, height: 900 },
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--disable-blink-features=AutomationControlled"],
  });
}

export async function firstPage(ctx: BrowserContext): Promise<Page> {
  const existing = ctx.pages();
  if (existing[0]) return existing[0];
  return await ctx.newPage();
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  await page.goto("https://x.com/home", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(2000);
  const url = page.url();
  if (url.includes("/i/flow/login") || url.includes("/account/access")) return false;
  return url.startsWith("https://x.com/home");
}
