export type TweetRecord = {
  id: string;
  text: string;
  createdAt: Date;
  favoriteCount: number;
  retweetCount: number;
  inReplyToStatusId: string | null;
};

export type TweetKind = "post" | "reply" | "repost";

type RawEntry = {
  tweet: {
    id_str: string;
    full_text: string;
    created_at: string;
    favorite_count: string | number;
    retweet_count: string | number;
    in_reply_to_status_id_str: string | null | undefined;
  };
};

export function parseTweetsJs(source: string): TweetRecord[] {
  const cleaned = source.replace(/^﻿/, "").trimStart();
  if (!cleaned.startsWith("window.YTD.")) {
    throw new Error("parseTweetsJs: expected window.YTD.* assignment");
  }
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");
  if (firstBracket < 0 || lastBracket < 0 || lastBracket < firstBracket) {
    throw new Error("parseTweetsJs: array body not found");
  }
  const body = cleaned.slice(firstBracket, lastBracket + 1);
  let entries: RawEntry[];
  try {
    entries = JSON.parse(body) as RawEntry[];
  } catch (err) {
    throw new Error(`parseTweetsJs: invalid JSON body: ${(err as Error).message}`);
  }
  return entries.map(toRecord);
}

function toRecord(entry: RawEntry): TweetRecord {
  const t = entry.tweet;
  return {
    id: t.id_str,
    text: t.full_text,
    createdAt: new Date(t.created_at),
    favoriteCount: Number(t.favorite_count),
    retweetCount: Number(t.retweet_count),
    inReplyToStatusId: t.in_reply_to_status_id_str ?? null,
  };
}

export function classifyTweet(r: TweetRecord): TweetKind {
  if (r.inReplyToStatusId) return "reply";
  if (/^RT @\w+:/.test(r.text)) return "repost";
  return "post";
}
