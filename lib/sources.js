// Live sources from seed/source-registry.md + Tavily per-VC search. Lenient Atom/RSS parsing (Inc42 XML is malformed).

export const FEEDS = [
  { source: 'Google Alert #1 logistics funding', url: 'https://www.google.com/alerts/feeds/06384577686394607711/16324225994986073229' },
  { source: 'Google Alert #2 logistics led by', url: 'https://www.google.com/alerts/feeds/06384577686394607711/5845460547091410117' },
  { source: 'Google Alert #3 supply chain led by', url: 'https://www.google.com/alerts/feeds/06384577686394607711/18011395675215417816' },
  { source: 'Google Alert #4 logistics summit', url: 'https://www.google.com/alerts/feeds/06384577686394607711/5970751545951463051' },
  { source: 'Google Alert #5 B2B SaaS summit', url: 'https://www.google.com/alerts/feeds/06384577686394607711/5217872920218687222' },
  { source: 'Google Alert #6 new fund', url: 'https://www.google.com/alerts/feeds/06384577686394607711/12967125829986015310' },
  { source: 'Google Alert #7 applications open', url: 'https://www.google.com/alerts/feeds/06384577686394607711/14087817873688796835' },
  { source: 'Google Alert #8 logistics acquisition', url: 'https://www.google.com/alerts/feeds/06384577686394607711/11212238048955778917' },
  { source: 'Google Alert #9 LinkedIn pulse', url: 'https://www.google.com/alerts/feeds/06384577686394607711/1773295689312293942' },
  { source: 'Inc42', url: 'https://inc42.com/feed/' },
  { source: 'YourStory', url: 'https://yourstory.com/feed' },
  { source: 'Blume Field Notes (Substack)', url: 'https://blumefieldnotes.substack.com/feed', vc_id: 'VC01' },
  { source: 'All In Capital (Substack)', url: 'https://allindiacapital.substack.com/feed', vc_id: 'VC25' },
  { source: 'Omnivore (Substack)', url: 'https://omnivorevc.substack.com/feed', vc_id: 'VC31' },
  { source: 'Eximius Echo (Substack)', url: 'https://eximiusecho.substack.com/feed', vc_id: 'VC37' },
];

const decode = s => (s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#039;|&apos;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&')
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
};

export function parseFeed(xml) {
  const items = [];
  const blocks = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of blocks) {
    let link = (b.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || decode(tag(b, 'link')) || decode(tag(b, 'guid'));
    link = link.replace(/&amp;/g, '&');
    const date = decode(tag(b, 'published') || tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'dc:date'));
    items.push({
      title: decode(tag(b, 'title')),
      url: link,
      published: date ? toISODate(date) : null,
      snippet: decode(tag(b, 'content') || tag(b, 'description') || tag(b, 'summary') || tag(b, 'content:encoded')).slice(0, 1500),
    });
  }
  return items;
}

export function toISODate(s) {
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

// Google Alert links are google.com/url redirects: keep the real `url=` parameter.
export function unwrapUrl(u) {
  try {
    const x = new URL(u);
    if (/(^|\.)google\.[a-z.]+$/.test(x.hostname) && x.pathname === '/url') return x.searchParams.get('url') || x.searchParams.get('q') || u;
    return u;
  } catch { return u; }
}

export function normUrl(u) {
  try {
    const x = new URL(unwrapUrl(u));
    [...x.searchParams.keys()].forEach(k => { if (/^(utm_|fbclid|gclid|ref$|ved$|usg$|sa$|ct$|cd$)/.test(k)) x.searchParams.delete(k); });
    x.hash = '';
    x.hostname = x.hostname.replace(/^www\./, '').replace(/^m\./, '');
    return x.toString().replace(/\/$/, '');
  } catch { return u; }
}

async function fetchText(url, ms = 12000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'user-agent': 'Mozilla/5.0 (VC pipeline intelligence; RSS reader)' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(t); }
}

export async function fetchFeeds() {
  const out = [], errors = [], counts = {};
  await Promise.all(FEEDS.map(async f => {
    try {
      const items = parseFeed(await fetchText(f.url));
      counts[f.source] = items.length;
      for (const it of items) out.push({ ...it, url: unwrapUrl(it.url), source: f.source, vc_hint: f.vc_id || null });
    } catch (e) { counts[f.source] = 0; errors.push(`${f.source}: ${e.message}`); }
  }));
  return { items: out, errors, counts };
}

// One basic Tavily search per VC, last ~7 days, include_answer OFF. Only title/url/snippet/date are used.
export async function fetchTavily(vcs, concurrency = 10) {
  const out = [], errors = []; let credits = 0; let i = 0;
  async function worker() {
    while (i < vcs.length) {
      const v = vcs[i++];
      if (!v.guard_terms) continue;
      try {
        const r = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
          body: JSON.stringify({ query: v.guard_terms, search_depth: 'basic', topic: 'news', days: 7, max_results: 5, include_answer: false }),
        });
        credits += 1;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        for (const x of j.results || []) {
          out.push({ title: x.title, url: x.url, snippet: (x.content || '').slice(0, 1500), published: x.published_date ? toISODate(x.published_date) : null, source: 'Tavily', vc_hint: v.vc_id });
        }
      } catch (e) { errors.push(`Tavily ${v.vc_id}: ${e.message}`); }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { items: out, errors, credits };
}

// Pre-match items to VCs by firm name, aliases, quoted guard terms and partner name (word boundaries).
export function buildMatchers(vcs) {
  return vcs.map(v => {
    const terms = new Set();
    terms.add(v.firm.replace(/\s*\(.*\)\s*/g, ' ').trim());
    (v.aliases || '').split(/[;,]/).map(s => s.replace(/\(.*\)/, '').trim()).filter(Boolean).forEach(t => terms.add(t));
    for (const m of (v.guard_terms || '').matchAll(/(-?)"([^"]+)"/g)) if (!m[1]) terms.add(m[2]);
    if (v.partner_name) terms.add(v.partner_name);
    const res = [...terms].filter(t => t.length >= 3).map(t => new RegExp(`(^|[^A-Za-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-z0-9])`, 'i'));
    return { vc_id: v.vc_id, res };
  });
}

export function preMatch(item, matchers) {
  const text = `${item.title} ${item.snippet}`;
  const ids = new Set(item.vc_hint ? [item.vc_hint] : []);
  for (const m of matchers) if (m.res.some(r => r.test(text))) ids.add(m.vc_id);
  return [...ids];
}
