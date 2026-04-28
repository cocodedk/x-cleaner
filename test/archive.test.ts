import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseTweetsJs, classifyTweet } from "../src/archive.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(here, "fixtures/tweets.sample.js"), "utf8");

describe("parseTweetsJs", () => {
  it("returns one record per tweet entry", () => {
    const records = parseTweetsJs(fixture);
    expect(records).toHaveLength(3);
  });

  it("extracts id, text, createdAt, counts, replyTo", () => {
    const [first] = parseTweetsJs(fixture);
    expect(first).toMatchObject({
      id: "1700000000000000001",
      text: "Hello world",
      favoriteCount: 5,
      retweetCount: 1,
      inReplyToStatusId: null,
    });
    expect(first!.createdAt).toBeInstanceOf(Date);
    expect(first!.createdAt.getUTCFullYear()).toBe(2023);
  });

  it("preserves null replyTo for originals", () => {
    const records = parseTweetsJs(fixture);
    expect(records[0]!.inReplyToStatusId).toBeNull();
    expect(records[1]!.inReplyToStatusId).toBe("1699999999999999999");
  });

  it("throws on missing window.YTD prefix", () => {
    expect(() => parseTweetsJs("not the right shape")).toThrow();
  });

  it("throws on malformed JSON body", () => {
    expect(() => parseTweetsJs("window.YTD.tweets.part0 = [{")).toThrow();
  });

  it("tolerates trailing whitespace and BOM", () => {
    const wrapped = "﻿" + fixture + "\n\n  ";
    expect(parseTweetsJs(wrapped)).toHaveLength(3);
  });
});

describe("classifyTweet", () => {
  it("labels original posts", () => {
    const [r] = parseTweetsJs(fixture);
    expect(classifyTweet(r!)).toBe("post");
  });

  it("labels replies by inReplyToStatusId", () => {
    const records = parseTweetsJs(fixture);
    expect(classifyTweet(records[1]!)).toBe("reply");
  });

  it("labels reposts by RT @ prefix", () => {
    const records = parseTweetsJs(fixture);
    expect(classifyTweet(records[2]!)).toBe("repost");
  });
});
