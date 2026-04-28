import type { Page } from "playwright";

export type ItemKind = "post" | "reply" | "quote" | "repost";

export type MyItem = {
  id: string;
  url: string;
  kind: ItemKind;
};

const PAGE_FN_BODY = `
  var handle = args.handle;
  var statusRe = new RegExp(args.statusReSrc);
  var replyingToRe = new RegExp(args.replyingToReSrc, 'i');
  var cells = Array.from(document.querySelectorAll('[data-testid="cellInnerDiv"]'));
  var items = [];
  var group = [];

  function flushGroup() {
    for (var i = 0; i < group.length; i++) {
      var item = group[i];
      if (!item.id || !item.url) continue;
      // Reposts: article is by other but socialContext says we reposted.
      if (item.isRepost) {
        items.push({ id: item.id, url: item.url, kind: 'repost' });
        continue;
      }
      if (item.author !== handle) continue; // not ours, skip
      var kind = 'post';
      if (item.replyingTo) {
        kind = 'reply';
      } else {
        var priorOther = false;
        for (var j = 0; j < i; j++) {
          if (group[j].author && group[j].author !== handle) { priorOther = true; break; }
        }
        if (priorOther) kind = 'reply';
        else if (item.isQuote) kind = 'quote';
      }
      items.push({ id: item.id, url: item.url, kind: kind });
    }
    group = [];
  }

  for (var c = 0; c < cells.length; c++) {
    var cell = cells[c];
    var article = cell.querySelector('article[data-testid="tweet"]');
    if (!article) {
      var truly_empty = cell.children.length === 0 && (cell.textContent || '').trim() === '';
      if (truly_empty) flushGroup();
      continue;
    }
    var nameLink = article.querySelector('[data-testid="User-Name"] a[role="link"]');
    var userHref = nameLink ? (nameLink.getAttribute('href') || '') : '';
    var author = userHref.charAt(0) === '/' ? userHref.slice(1).split('/')[0] : null;
    var isRepost = article.querySelector('[data-testid="socialContext"]') != null;
    var nestedArticle = article.querySelector('article[data-testid="tweet"]');
    var isQuote = nestedArticle != null;
    var statusEl = article.querySelector('a[href*="/status/"]');
    var statusHref = statusEl ? statusEl.getAttribute('href') : null;
    var m = statusHref ? statusRe.exec(statusHref) : null;
    var id = m ? m[1] : null;
    var bodyText = article.textContent || '';
    var replyingTo = replyingToRe.test(bodyText);
    group.push({
      author: author, isRepost: isRepost, isQuote: isQuote,
      id: id, url: statusHref, replyingTo: replyingTo
    });
  }
  flushGroup();

  var seen = {};
  var out = [];
  for (var k = 0; k < items.length; k++) {
    var it = items[k];
    if (seen[it.id]) continue;
    seen[it.id] = 1;
    out.push(it);
  }
  return out;
`;

const pageFn = new Function("args", PAGE_FN_BODY) as (a: unknown) => MyItem[];

export async function enumerateMyItems(page: Page, handle: string): Promise<MyItem[]> {
  return await page.evaluate(pageFn, {
    handle,
    statusReSrc: "/status/(\\d+)",
    replyingToReSrc: "Replying to",
  });
}

// Backward-compat wrapper used by older tests / scrape — replies only.
export async function enumerateReplies(page: Page, handle: string): Promise<MyItem[]> {
  const all = await enumerateMyItems(page, handle);
  return all.filter((i) => i.kind === "reply");
}
