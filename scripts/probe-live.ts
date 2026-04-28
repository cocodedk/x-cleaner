// One-off live probe of x.com to confirm shell selectors before relying on them.
// Run with: npx tsx scripts/probe-live.ts
// Reports what was found at the unauthenticated landing + login page. No login.
import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();

  const findings: Record<string, unknown> = {};

  await page.goto("https://x.com/", { waitUntil: "networkidle", timeout: 45_000 }).catch(() => {});
  await page.waitForTimeout(2500);
  findings.landingUrl = page.url();
  findings.title = await page.title();
  findings.loginButton = await page.locator('[data-testid="loginButton"]').count();
  findings.signupButton = await page.locator('[data-testid="signupButton"]').count();
  findings.bodySnippet = (await page.locator("body").innerText()).slice(0, 400);

  await page
    .goto("https://x.com/i/flow/login", { waitUntil: "networkidle", timeout: 45_000 })
    .catch(() => {});
  await page.waitForTimeout(2500);
  findings.loginFlowUrl = page.url();
  findings.loginInputUsername = await page.locator('input[autocomplete="username"]').count();
  findings.loginFormButton = await page
    .locator('[data-testid="LoginForm_Login_Button"]')
    .count();

  const resp = await page
    .goto("https://x.com/x/with_replies", { waitUntil: "networkidle", timeout: 45_000 })
    .catch(() => null);
  await page.waitForTimeout(3000);
  findings.profileStatus = resp?.status();
  findings.profileUrl = page.url();
  findings.tweetCardCount = await page.locator('article[data-testid="tweet"]').count();

  console.log(JSON.stringify(findings, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
