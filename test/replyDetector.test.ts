import { describe, it, expect, afterAll } from "vitest";
import { closeBrowser, pageFor } from "./helpers/browser.ts";
import { enumerateReplies } from "../src/replyDetector.ts";

afterAll(closeBrowser);

describe("enumerateReplies", () => {
  it("returns paired-with-parent, show-more-bridged, AND standalone replies — no originals/reposts/quotes/strangers", async () => {
    const { page, ctx } = await pageFor("with-replies.html");
    const replies = await enumerateReplies(page, "me");
    expect(replies.map((r) => r.id)).toEqual([
      "1700000000000000010",
      "1700000000000000030",
      "1700000000000000040",
    ]);
    await ctx.close();
  });

  it("attaches the canonical status URL to each reply", async () => {
    const { page, ctx } = await pageFor("with-replies.html");
    const replies = await enumerateReplies(page, "me");
    expect(replies[0]!.url).toBe("/me/status/1700000000000000010");
    await ctx.close();
  });

  it("returns nothing when handle does not match any author", async () => {
    const { page, ctx } = await pageFor("with-replies.html");
    const replies = await enumerateReplies(page, "nobody");
    expect(replies).toEqual([]);
    await ctx.close();
  });
});
