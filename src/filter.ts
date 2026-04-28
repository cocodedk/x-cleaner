import { classifyTweet, type TweetKind, type TweetRecord } from "./archive.ts";

export type FilterMode = "posts" | "replies" | "reposts" | "all";

export type FilterSpec = {
  mode: FilterMode;
  olderThan?: Date;
  newerThan?: Date;
  keepMinLikes?: number;
  keepMinReplies?: number;
  match?: RegExp;
  exclude?: RegExp;
};

const KIND_FOR_MODE: Record<Exclude<FilterMode, "all">, TweetKind> = {
  posts: "post",
  replies: "reply",
  reposts: "repost",
};

export function applyFilter(records: TweetRecord[], spec: FilterSpec): TweetRecord[] {
  return records.filter((r) => matches(r, spec));
}

function matches(r: TweetRecord, spec: FilterSpec): boolean {
  if (spec.mode !== "all" && classifyTweet(r) !== KIND_FOR_MODE[spec.mode]) {
    return false;
  }
  if (spec.olderThan && r.createdAt >= spec.olderThan) return false;
  if (spec.newerThan && r.createdAt <= spec.newerThan) return false;
  if (spec.keepMinLikes !== undefined && r.favoriteCount >= spec.keepMinLikes) {
    return false;
  }
  if (spec.keepMinReplies !== undefined && r.retweetCount >= spec.keepMinReplies) {
    return false;
  }
  if (spec.match && !spec.match.test(r.text)) return false;
  if (spec.exclude && spec.exclude.test(r.text)) return false;
  return true;
}
