import { firstPage, isLoggedIn, launchPersistent } from "./browser.ts";
import { runDeleteReplies } from "./runner.ts";
import { runUnlike } from "./unlike.ts";
import { Scheduler } from "./scheduler.ts";
import { ErrorBudget } from "./errors.ts";
import { makeRng } from "./pace.ts";
import { resolve } from "node:path";

type Args = {
  cmd: "login" | "run" | "unlike" | "probe" | "help";
  handle?: string;
  dryRun: boolean;
  max: number;
  profileDir: string;
  stateDir: string;
  headless: boolean;
};

function parse(argv: string[]): Args {
  const a: Args = {
    cmd: "help",
    dryRun: false,
    max: 100,
    profileDir: ".profile",
    stateDir: "state",
    headless: false,
  };
  if (!argv[0]) return a;
  const cmd = argv[0];
  if (cmd === "login" || cmd === "run" || cmd === "unlike" || cmd === "probe" || cmd === "help") a.cmd = cmd;
  for (let i = 1; i < argv.length; i++) {
    const v = argv[i]!;
    if (v === "--dry-run") a.dryRun = true;
    else if (v === "--headless") a.headless = true;
    else if (v.startsWith("--handle=")) a.handle = v.slice(9);
    else if (v.startsWith("--max=")) a.max = Number(v.slice(6));
    else if (v.startsWith("--profile-dir=")) a.profileDir = v.slice(14);
    else if (v.startsWith("--state-dir=")) a.stateDir = v.slice(12);
  }
  return a;
}

const HELP = `x-cleaner — delete your own X.com replies, slowly.

Usage:
  x-cleaner login                     open Chromium so you can sign in
  x-cleaner probe                     check whether the saved profile is still logged in
  x-cleaner run --handle=<user>       delete replies from /<user>/with_replies
        [--dry-run]                   print what would be deleted, don't click
        [--max=N]                     hard cap on items in this run (default 100)
        [--profile-dir=./.profile]    where browser profile lives
        [--state-dir=./state]         where logs/diagnostics go
        [--headless]                  hide the browser (NOT recommended)

Defaults pace to ~6 deletes/minute (10s ± 40% jitter), with a long break every 30
deletes and an hourly cap of 360. See docs/rate-limits.md.`;

async function main() {
  const args = parse(process.argv.slice(2));

  if (args.cmd === "help") {
    console.log(HELP);
    return;
  }

  if (args.cmd === "login") {
    const ctx = await launchPersistent({ profileDir: args.profileDir, headless: false });
    const page = await firstPage(ctx);
    await page.goto("https://x.com/i/flow/login");
    console.log("Sign in in the open window. I'll auto-close when you reach the home timeline.");
    const deadline = Date.now() + 15 * 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      const url = page.url();
      if (
        url.startsWith("https://x.com/home") ||
        url === "https://x.com/" && !url.includes("/i/flow/login")
      ) {
        console.log("login detected — saving profile and closing.");
        break;
      }
    }
    await ctx.close();
    return;
  }

  if (args.cmd === "probe") {
    const ctx = await launchPersistent({ profileDir: args.profileDir, headless: args.headless });
    const page = await firstPage(ctx);
    const ok = await isLoggedIn(page);
    console.log(ok ? "logged in" : "NOT logged in");
    await ctx.close();
    return;
  }

  if (args.cmd === "unlike") {
    if (!args.handle) {
      console.error("--handle=<user> is required");
      process.exit(2);
    }
    const ctx = await launchPersistent({ profileDir: args.profileDir, headless: args.headless });
    const rng = makeRng(Date.now() & 0xffff);
    const scheduler = new Scheduler({
      baseDelayMs: 2_000,
      jitterFraction: 0.4,
      longBreakEvery: 60,
      longBreakMinMs: 10_000,
      longBreakMaxMs: 30_000,
      hourlyCap: 1500,
      dailyCap: 5000,
      rng,
    });
    const budget = new ErrorBudget({ pauseAt: 3, abortAt: 10 });
    const log = (m: string) => console.log(`[unlike ${new Date().toISOString()}] ${m}`);
    const { summary } = await runUnlike(ctx, {
      handle: args.handle,
      stateDir: resolve(args.stateDir),
      scheduler,
      budget,
      micro: { baseMs: 300, fraction: 0.4, rng },
      maxIds: args.max,
      scrollPauseMs: 4000,
      dryRun: args.dryRun,
      log,
    });
    console.log("unlike summary:", JSON.stringify(summary, null, 2));
    await ctx.close();
    return;
  }

  if (args.cmd === "run") {
    if (!args.handle) {
      console.error("--handle=<user> is required");
      process.exit(2);
    }
    const ctx = await launchPersistent({ profileDir: args.profileDir, headless: args.headless });
    const rng = makeRng(Date.now() & 0xffff);
    const scheduler = new Scheduler({
      baseDelayMs: 5_000,
      jitterFraction: 0.4,
      longBreakEvery: 30,
      longBreakMinMs: 15_000,
      longBreakMaxMs: 45_000,
      hourlyCap: 1000,
      dailyCap: 1500,
      rng,
    });
    const budget = new ErrorBudget({ pauseAt: 3, abortAt: 10 });
    const log = (m: string) => console.log(`[${new Date().toISOString()}] ${m}`);
    const { summary } = await runDeleteReplies(ctx, {
      handle: args.handle,
      stateDir: resolve(args.stateDir),
      scheduler,
      budget,
      micro: { baseMs: 600, fraction: 0.4, rng },
      maxIds: args.max,
      scrollPauseMs: 6000,
      dryRun: args.dryRun,
      log,
    });
    console.log("summary:", JSON.stringify(summary, null, 2));
    await ctx.close();
    return;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
