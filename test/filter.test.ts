import { describe, it, expect } from "vitest";
import type { TweetRecord } from "../src/archive.ts";
import { applyFilter, type FilterSpec } from "../src/filter.ts";

const make = (over: Partial<TweetRecord>): TweetRecord => ({
  id: "1",
  text: "hello",
  createdAt: new Date("2024-06-01T00:00:00Z"),
  favoriteCount: 0,
  retweetCount: 0,
  inReplyToStatusId: null,
  ...over,
});

const records: TweetRecord[] = [
  make({ id: "p1", text: "first post", createdAt: new Date("2024-01-01Z") }),
  make({ id: "r1", text: "@a a reply", inReplyToStatusId: "x", createdAt: new Date("2024-06-01Z") }),
  make({ id: "rt1", text: "RT @b: copied", createdAt: new Date("2024-09-01Z") }),
  make({ id: "p2", text: "popular post", favoriteCount: 500, createdAt: new Date("2024-12-01Z") }),
];

const ids = (rs: TweetRecord[]) => rs.map((r) => r.id);

describe("applyFilter — mode", () => {
  it("keeps only posts", () => {
    expect(ids(applyFilter(records, { mode: "posts" }))).toEqual(["p1", "p2"]);
  });

  it("keeps only replies", () => {
    expect(ids(applyFilter(records, { mode: "replies" }))).toEqual(["r1"]);
  });

  it("keeps only reposts", () => {
    expect(ids(applyFilter(records, { mode: "reposts" }))).toEqual(["rt1"]);
  });

  it("keeps everything when mode is all", () => {
    expect(ids(applyFilter(records, { mode: "all" }))).toEqual(["p1", "r1", "rt1", "p2"]);
  });
});

describe("applyFilter — date range", () => {
  it("olderThan removes recent items", () => {
    const cutoff = new Date("2024-07-01Z");
    expect(ids(applyFilter(records, { mode: "all", olderThan: cutoff }))).toEqual(["p1", "r1"]);
  });

  it("newerThan removes ancient items", () => {
    const cutoff = new Date("2024-07-01Z");
    expect(ids(applyFilter(records, { mode: "all", newerThan: cutoff }))).toEqual(["rt1", "p2"]);
  });
});

describe("applyFilter — likes / replies thresholds", () => {
  it("keepMinLikes excludes items at or above the threshold", () => {
    const out = applyFilter(records, { mode: "all", keepMinLikes: 100 });
    expect(ids(out)).toEqual(["p1", "r1", "rt1"]);
  });
});

describe("applyFilter — text patterns", () => {
  it("match keeps only items whose text matches", () => {
    const out = applyFilter(records, { mode: "all", match: /post/i });
    expect(ids(out)).toEqual(["p1", "p2"]);
  });

  it("exclude drops items whose text matches", () => {
    const out = applyFilter(records, { mode: "all", exclude: /^RT/ });
    expect(ids(out)).toEqual(["p1", "r1", "p2"]);
  });
});

describe("applyFilter — composition", () => {
  it("ANDs all conditions", () => {
    const out = applyFilter(records, {
      mode: "posts",
      olderThan: new Date("2024-07-01Z"),
      keepMinLikes: 100,
    });
    expect(ids(out)).toEqual(["p1"]);
  });

  it("returns empty when no records match", () => {
    const out = applyFilter(records, { mode: "replies", match: /never/ });
    expect(out).toEqual([]);
  });
});
