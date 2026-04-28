import { describe, it, expect, afterAll } from "vitest";
import { closeBrowser, pageFor } from "./helpers/browser.ts";
import { scrapeReplies } from "../src/scrape.ts";

afterAll(closeBrowser);

describe("scrapeReplies", () => {
  it("walks paginated feed and collects every reply id", async () => {
    const { page, ctx } = await pageFor("with-replies-paginated.html");
    const ids = await scrapeReplies(page, {
      handle: "me",
      maxIdleScrolls: 3,
      scrollPauseMs: 200,
      maxIds: 100,
    });
    expect(ids).toEqual([
      "1700000000000000010",
      "1700000000000000030",
      "1700000000000000040",
    ]);
    await ctx.close();
  });

  it("respects maxIds cap", async () => {
    const { page, ctx } = await pageFor("with-replies-paginated.html");
    const ids = await scrapeReplies(page, {
      handle: "me",
      maxIdleScrolls: 3,
      scrollPauseMs: 200,
      maxIds: 2,
    });
    expect(ids).toHaveLength(2);
    await ctx.close();
  });

  it("stops after consecutive idle scrolls", async () => {
    const { page, ctx } = await pageFor("with-replies.html");
    const ids = await scrapeReplies(page, {
      handle: "me",
      maxIdleScrolls: 2,
      scrollPauseMs: 100,
      maxIds: 100,
    });
    expect(ids).toEqual([
      "1700000000000000010",
      "1700000000000000030",
      "1700000000000000040",
    ]);
    await ctx.close();
  });
});
